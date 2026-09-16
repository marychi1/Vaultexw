import express, { Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import authMiddleware from './middleware/authMiddleware';
import AuthService from './services/authService';
import OTPService from './services/otpService';
import rateLimit from 'express-rate-limit';
import Database from './services/database';
import WebAuthnService from './services/webauthnService';
import BlockchainService from './services/blockchainService';
import CryptoService from './services/cryptoService';
import { getBackendConfig } from './config';

const app = express();
app.use(cors());
app.use(express.json());

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
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
    const result = OTPService.sendOTPToPhone(phone);
    // In production, don't return the actual OTP code
    return res.status(200).json({ message: 'OTP sent to phone', expiresAt: result.expiresAt });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
});

app.post('/api/auth/verify-otp', (req: Request, res: Response) => {
  const { phone, code } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone and code required' });
  }

  const isValid = OTPService.verifyOTP(phone, code);
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
    const user = Database.getUserByPhone(phone);
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

    const user = AuthService.registerUser(phone, hashedPin, generatedWallet.walletAddress, generatedWallet.encryptedPrivateKey);

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
  const user = Database.getUserById(userId!);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const balance = await BlockchainService.getUSDTBalance(user.walletAddress);
  const transactions = Array.isArray(user.transactions) && user.transactions.length > 0
    ? user.transactions
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

app.post('/api/wallet/send', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { to, amount } = req.body;

  if (!to || !amount) {
    return res.status(400).json({ error: 'To address and amount required' });
  }

  try {
    const user = Database.getUserById(req.userId!);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const privateKey = CryptoService.decrypt(user.encryptedPrivateKey);
    const result = await BlockchainService.sendUSDT(to, Number(amount), privateKey);

    const tx = {
      id: result.txHash,
      type: 'withdrawal' as const,
      amount: Number(amount),
      date: new Date().toISOString().slice(0, 10),
      status: result.status,
    };

    user.transactions = [tx, ...(user.transactions || [])];
    user.balance = Math.max(0, Number(user.balance || 0) - Number(amount));

    return res.status(200).json({
      message: 'Transfer initiated',
      txHash: result.txHash,
      to,
      amount,
      status: result.status,
    });
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

// ===== Device Routes (Protected) =====
app.get('/api/devices', authMiddleware, (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const devices = Database.getUserDevices(userId!);

  return res.json(devices);
});

app.delete('/api/devices/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId;
  const device = Database.getDeviceById(id);

  if (!device || device.userId !== userId) {
    return res.status(404).json({ error: 'Device not found' });
  }

  const revoked = Database.revokeDevice(id);
  if (!revoked) {
    return res.status(500).json({ error: 'Failed to revoke device' });
  }

  return res.json({ message: 'Device revoked', device: revoked });
});

// ===== Notification Routes (Protected) =====
app.get('/api/notifications', authMiddleware, (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const notifications = Database.getNotifications(userId!);

  return res.json(notifications);
});

app.patch('/api/notifications/:id/read', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const notification = Database.markNotificationAsRead(id);
  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  return res.json(notification);
});

// ===== Health Check =====
app.get('/api/health', (_req: Request, res: Response) => {
  return res.json({ status: 'ok', message: 'Vaultex backend is running' });
});

if (require.main === module) {
  const { port } = getBackendConfig();
  app.listen(port, () => {
    console.log(`Vaultex backend running on http://localhost:${port}`);
  });
}

export default app;
