import express, { Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { ethers } from 'ethers';
import authMiddleware from './middleware/authMiddleware';
import AuthService from './services/authService';
import OTPService from './services/otpService';
import rateLimit from 'express-rate-limit';
import Database from './services/database';
import WebAuthnService from './services/webauthnService';
import BlockchainService from './services/blockchainService';
import CryptoService from './services/cryptoService';
import PostgresService from './services/postgresService';
import ColumnService from './services/columnService';
import { getBackendConfig, getProductionConfigErrors } from './config';

const app = express();
const backendConfig = getBackendConfig();
app.use(cors({
  origin: (origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) => {
    if (!origin || backendConfig.corsOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed by CORS'));
  },
}));

app.post('/api/webhooks/column', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const config = getBackendConfig();
  if (!config.columnEnabled || !config.columnWebhookSecret || !config.columnWebhookEndpointId) {
    return res.status(503).json({ error: 'Column integration is disabled' });
  }

  const signature = req.header('Column-Signature');
  const endpointId = req.header('Webhook-Endpoint-Id');
  if (!signature || endpointId !== config.columnWebhookEndpointId || !Buffer.isBuffer(req.body)) {
    return res.status(401).json({ error: 'Invalid Column webhook' });
  }

  const expected = crypto.createHmac('sha256', config.columnWebhookSecret).update(req.body).digest();
  const received = Buffer.from(signature, 'hex');
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    return res.status(401).json({ error: 'Invalid Column webhook signature' });
  }

  let event: { id?: unknown; type?: unknown; data?: { id?: unknown } };
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  if (typeof event.id !== 'string' || typeof event.type !== 'string') {
    return res.status(400).json({ error: 'Column webhook event is missing an ID or type' });
  }

  const recorded = await Database.recordColumnWebhookEvent({
    id: event.id,
    type: event.type,
    transferId: typeof event.data?.id === 'string' ? event.data.id : undefined,
    payload: event,
  });

  return res.status(200).json({ received: true, duplicate: !recorded });
});
app.use(express.json());

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

const walletSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many transfer attempts. Try again later.' },
});

// Don't apply rate limiter during automated tests
if (process.env.NODE_ENV !== 'test') {
  app.use('/api/auth', authLimiter);
}

interface AuthRequest extends Request {
  userId?: string;
  deviceId?: string;
}

// ===== OTP Routes =====
app.post('/api/auth/request-otp', async (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number required' });
  }

  try {
    const result = await OTPService.sendOTPToPhone(phone);
    // In production, don't return the actual OTP code
    return res.status(200).json({ message: 'OTP sent to phone', expiresAt: result.expiresAt });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
});

app.post('/api/auth/verify-otp', async (req: Request, res: Response) => {
  const { phone, code } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone and code required' });
  }

  const isValid = await OTPService.verifyOTP(phone, code);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid OTP' });
  }

  return res.status(200).json({ message: 'OTP verified', verified: true });
});

// ===== PIN Verification (for quick checks) =====
app.post('/api/auth/verify-pin', async (req: Request, res: Response) => {
  const { phone, pin } = req.body;
  if (!phone || !pin) {
    return res.status(400).json({ error: 'Phone and PIN required' });
  }

  try {
    const user = await Database.getUserByPhone(phone);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const ok = await AuthService.verifyPIN(pin, user.pinHash);
    if (!ok) return res.status(401).json({ error: 'Invalid PIN' });

    return res.json({ verified: true });
  } catch (err) {
    return res.status(500).json({ error: 'PIN verification failed' });
  }
});

// WebAuthn registration and authentication endpoints (using fido2-lib)
app.post('/api/auth/webauthn/register-options', async (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone required' });
  try {
    const opts = await WebAuthnService.generateRegistrationOptions(phone);
    return res.json(opts);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate registration options' });
  }
});

app.post('/api/auth/webauthn/register', async (req: Request, res: Response) => {
  const { phone, attestation } = req.body;
  if (!phone || !attestation) return res.status(400).json({ error: 'phone and attestation required' });
  try {
    const result = await WebAuthnService.verifyRegistration(phone, attestation);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: 'Registration verification failed' });
  }
});

app.post('/api/auth/webauthn/assertion-options', async (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone required' });
  try {
    const opts = await WebAuthnService.generateAssertionOptions(phone);
    return res.json(opts);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate assertion options' });
  }
});

app.post('/api/auth/webauthn/authenticate', async (req: Request, res: Response) => {
  const { phone, assertion, deviceId, deviceName } = req.body;
  if (!phone || !assertion) return res.status(400).json({ error: 'phone and assertion required' });
  try {
    await WebAuthnService.verifyAssertion(phone, assertion);
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.connection.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const loginResult = await AuthService.authenticateUserByPhone(phone, deviceId || uuidv4(), deviceName || 'Web Browser', ipAddress, userAgent);
    return res.json({ authenticated: true, token: loginResult.token, user: { walletAddress: loginResult.user.walletAddress, encryptedPrivateKey: loginResult.user.encryptedPrivateKey, phone: loginResult.user.phone } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Authentication failed';
    return res.status(400).json({ error: message });
  }
});

// ===== Auth Routes =====
app.post('/api/auth/signup', async (req: Request, res: Response) => {
  const { phone, pin, walletAddress, encryptedPrivateKey, deviceId, deviceName } = req.body;

  if (!phone || !pin) {
    return res.status(400).json({ error: 'Phone and PIN required' });
  }

  try {
    const hashedPin = await AuthService.hashPIN(pin);
    const generatedWallet = walletAddress && encryptedPrivateKey
      ? { walletAddress, encryptedPrivateKey }
      : BlockchainService.generateWallet();

    const user = await AuthService.registerUser(phone, hashedPin, generatedWallet.walletAddress, generatedWallet.encryptedPrivateKey);

    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.connection.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const result = await AuthService.authenticateUser(phone, pin, deviceId || uuidv4(), deviceName || 'Unknown Device', ipAddress, userAgent);

    return res.status(201).json({
      message: 'User registered',
      user: { id: user.id, phone: user.phone, walletAddress: user.walletAddress, encryptedPrivateKey: user.encryptedPrivateKey },
      token: result.token,
    });
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { phone, pin, deviceId, deviceName } = req.body;

  if (!phone || !pin) {
    return res.status(400).json({ error: 'Phone and PIN required' });
  }

  try {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.connection.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const result = await AuthService.authenticateUser(phone, pin, deviceId || uuidv4(), deviceName || 'Unknown Device', ipAddress, userAgent);

    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: result.user.id,
        phone: result.user.phone,
        walletAddress: result.user.walletAddress,
        encryptedPrivateKey: result.user.encryptedPrivateKey,
      },
      token: result.token,
    });
  } catch (error) {
    return res.status(401).json({ error: (error as Error).message });
  }
});

// ===== Wallet Routes (Protected) =====
app.get('/api/wallet', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const user = await Database.getUserById(userId!);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const balance = await BlockchainService.getUSDTBalance(user.walletAddress);
  const storedTransactions = await Database.getTransactions(user.id);
  const transactions = storedTransactions.length > 0
    ? storedTransactions
    : [{ id: `tx-${Date.now()}`, type: 'deposit', amount: balance, date: new Date().toISOString().slice(0, 10), status: 'completed' }];

  return res.json({
    address: user.walletAddress,
    verified: user.verified,
    createdAt: user.createdAt,
    balance: Number(balance ?? user.balance ?? 0),
    transactions,
    phone: user.phone,
  });
});

app.post('/api/wallet/send', walletSendLimiter, authMiddleware, async (req: AuthRequest, res: Response) => {
  const { to, amount, pin } = req.body;
  const numericAmount = typeof amount === 'number' || typeof amount === 'string' ? Number(amount) : NaN;

  if (typeof to !== 'string' || !ethers.isAddress(to)) {
    return res.status(400).json({ error: 'A valid recipient address is required' });
  }

  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 1_000_000) {
    return res.status(400).json({ error: 'Amount must be greater than 0 and no more than 1,000,000 USDT' });
  }

  if (!/^\d+(\.\d{1,6})?$/.test(String(amount).trim())) {
    return res.status(400).json({ error: 'Amount supports up to 6 decimal places' });
  }

  if (typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) {
    return res.status(400).json({ error: 'A valid PIN is required' });
  }

  try {
    const user = await Database.getUserById(req.userId!);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!(await AuthService.verifyPIN(pin, user.pinHash))) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }

    if (!getBackendConfig().allowMainnetTransfers) {
      return res.status(403).json({ error: 'Mainnet transfers are disabled in this environment' });
    }

    const { maxDailyTransferUsdt } = getBackendConfig();
    const dailyTotal = await Database.getDailyWithdrawalTotal(user.id);
    if (dailyTotal + numericAmount > maxDailyTransferUsdt) {
      return res.status(400).json({ error: `Daily transfer limit exceeded (${maxDailyTransferUsdt} USDT)` });
    }

    const liveBalance = await BlockchainService.getUSDTBalance(user.walletAddress);
    if (numericAmount > liveBalance) {
      return res.status(400).json({ error: 'Insufficient USDT balance' });
    }

    const privateKey = CryptoService.decrypt(user.encryptedPrivateKey);
    const result = await BlockchainService.sendUSDT(to, numericAmount, privateKey);

    const tx = {
      id: result.txHash,
      type: 'withdrawal' as const,
      amount: numericAmount,
      date: new Date().toISOString().slice(0, 10),
      status: result.status,
    };

    await Database.createTransaction(user.id, tx, result.txHash);
    await Database.updateUser(user.id, { balance: Math.max(0, Number(user.balance || 0) - numericAmount) });

    return res.status(200).json({
      message: 'Transfer initiated',
      txHash: result.txHash,
      to,
      amount: numericAmount,
      status: result.status,
    });
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

// ===== Column Transfer Routes (Protected) =====
app.get('/api/column/transfers/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const transferId = req.params.id;
  if (!/^wire_[A-Za-z0-9]+$/.test(transferId)) {
    return res.status(400).json({ error: 'A valid Column wire transfer ID is required' });
  }

  try {
    const transfer = await ColumnService.getTransfer(transferId);
    return res.json(transfer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Column transfer lookup failed';
    const status = message === 'Column integration is disabled' ? 503 : 502;
    return res.status(status).json({ error: message });
  }
});

app.post('/api/column/transfers/wire', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { amount, currencyCode, bankAccountId, counterpartyId, description, pin } = req.body;
  const idempotencyKey = req.header('Idempotency-Key');
  const numericAmount = typeof amount === 'number' || typeof amount === 'string' ? Number(amount) : NaN;

  if (!Number.isSafeInteger(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive integer in cents' });
  }
  if (currencyCode !== 'USD' || typeof bankAccountId !== 'string' || typeof counterpartyId !== 'string') {
    return res.status(400).json({ error: 'USD currency, bank account, and counterparty are required' });
  }
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 255) {
    return res.status(400).json({ error: 'An Idempotency-Key header between 16 and 255 characters is required' });
  }
  if (typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) {
    return res.status(400).json({ error: 'A valid PIN is required' });
  }

  try {
    const user = await Database.getUserById(req.userId!);
    if (!user || !(await AuthService.verifyPIN(pin, user.pinHash))) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }

    const transfer = await ColumnService.createWire({
      amount: numericAmount,
      currencyCode,
      bankAccountId,
      counterpartyId,
      description: typeof description === 'string' ? description.slice(0, 140) : undefined,
      idempotencyKey,
    });
    return res.status(201).json(transfer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Column wire creation failed';
    const status = message === 'Column integration is disabled' ? 503 : 502;
    return res.status(status).json({ error: message });
  }
});

// ===== Device Routes (Protected) =====
app.get('/api/devices', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const devices = await Database.getUserDevices(userId!);

  return res.json(devices);
});

app.delete('/api/devices/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId;
  const device = await Database.getDeviceById(id);

  if (!device || device.userId !== userId) {
    return res.status(404).json({ error: 'Device not found' });
  }

  const revoked = await Database.revokeDevice(id);
  if (!revoked) {
    return res.status(500).json({ error: 'Failed to revoke device' });
  }

  return res.json({ message: 'Device revoked', device: revoked });
});

// ===== Notification Routes (Protected) =====
app.get('/api/notifications', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const notifications = await Database.getNotifications(userId!);

  return res.json(notifications);
});

app.patch('/api/notifications/:id/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const notification = await Database.markNotificationAsRead(id);
  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  return res.json(notification);
});

// ===== Health Check =====
app.get('/api/health', async (_req: Request, res: Response) => {
  const { postgresEnabled, databaseDriver } = getBackendConfig();
  const databaseConnected = postgresEnabled ? await PostgresService.ping() : true;
  const blockchain = await BlockchainService.getNetworkStatus();
  return res.json({
    status: 'ok',
    message: 'Vaultex backend is running',
    databaseDriver,
    postgresEnabled,
    databaseConnected,
    blockchainConnected: blockchain.connected,
    blockchainChainId: blockchain.chainId ?? null,
  });
});

if (require.main === module) {
  const config = getBackendConfig();
  const productionErrors = getProductionConfigErrors(config);
  if (productionErrors.length > 0) {
    console.error(`Production configuration invalid:\n- ${productionErrors.join('\n- ')}`);
    process.exit(1);
  }

  const start = async () => {
    if (config.nodeEnv === 'production' && !(await PostgresService.ping())) {
      console.error('Production database is unavailable');
      process.exit(1);
    }

    const { port } = config;
    app.listen(port, () => {
      console.log(`Vaultex backend running on http://localhost:${port}`);
    });
  };

  void start();
}

export default app;
