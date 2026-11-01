import express, { Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import authMiddleware from './middleware/authMiddleware';
import AuthService from './services/authService';
import OTPService from './services/otpService';
import rateLimit from 'express-rate-limit';
import Database, { ColumnWireIdempotencyConflictError } from './services/database';
import WebAuthnService from './services/webauthnService';
import PostgresService from './services/postgresService';
import ColumnService from './services/columnService';
import SupabaseAuthService from './services/supabaseAuthService';
import { toColumnWireReceipt } from './services/columnWireReceipt';
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
  if (config.nodeEnv === 'production' && !config.postgresEnabled) {
    return res.status(503).json({ error: 'Persistent webhook storage is unavailable' });
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

  try {
    const recorded = await Database.recordColumnWebhookEvent({
      id: event.id,
      type: event.type,
      transferId: typeof event.data?.id === 'string' ? event.data.id : undefined,
      payload: event,
    });
    return res.status(200).json({ received: true, duplicate: !recorded });
  } catch (error) {
    console.error('[Column webhook] Event persistence failed:', error);
    return res.status(500).json({ error: 'Column webhook persistence failed' });
  }
});
app.use(express.json());

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

const columnWireLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many wire attempts. Try again later.' },
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
  if (typeof phone !== 'string' || !phone.trim()) {
    return res.status(400).json({ error: 'Phone number required' });
  }

  try {
    const config = getBackendConfig();
    if (config.nodeEnv === 'production' && config.otpProvider !== 'twilio') {
      return res.status(503).json({ error: 'Phone verification delivery is not configured' });
    }
    const result = await OTPService.sendOTPToPhone(phone.trim());
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

app.post('/api/auth/request-link-otp', async (req: Request, res: Response) => {
  const accessToken = req.header('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
  if (!accessToken) return res.status(401).json({ error: 'Supabase sign-in is required' });
  if (!phone) return res.status(400).json({ error: 'Phone number required' });

  try {
    const config = getBackendConfig();
    if ((!config.postgresEnabled && config.nodeEnv !== 'test') ||
        (config.nodeEnv !== 'test' && config.otpProvider !== 'twilio')) {
      return res.status(503).json({ error: 'Persistent account linking and phone verification are not configured' });
    }

    const customer = await SupabaseAuthService.getCustomer(accessToken);
    if (!customer) return res.status(401).json({ error: 'Supabase session is invalid or expired' });
    if (!customer.emailConfirmedAt) {
      return res.status(403).json({ error: 'A verified Supabase email is required to link this account' });
    }

    const existingUser = await Database.getUserByPhone(phone);
    if (existingUser && !existingUser.supabaseUserId) {
      await OTPService.sendOTPToPhone(phone);
    }
    return res.status(200).json({ message: 'If the account is eligible, a verification code was sent' });
  } catch (error) {
    console.error('[Auth] Supabase customer phone verification request failed:', error);
    return res.status(503).json({ error: 'Phone verification service is unavailable' });
  }
});

app.post('/api/auth/link-customer', async (req: Request, res: Response) => {
  const authorization = req.header('Authorization');
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const { phone, pin, code } = req.body;

  if (!accessToken) return res.status(401).json({ error: 'Supabase sign-in is required' });
  if (typeof phone !== 'string' || !phone.trim() ||
      typeof pin !== 'string' || !/^\d{4,8}$/.test(pin) ||
      typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Phone, 4–8 digit PIN, and 6-digit OTP are required' });
  }

  try {
    const config = getBackendConfig();
    if (!config.postgresEnabled && config.nodeEnv !== 'test') {
      return res.status(503).json({ error: 'Persistent account-link storage is unavailable' });
    }
    if (config.nodeEnv !== 'test' && config.otpProvider !== 'twilio') {
      return res.status(503).json({ error: 'Phone verification delivery is not configured' });
    }

    const customer = await SupabaseAuthService.getCustomer(accessToken);
    if (!customer) return res.status(401).json({ error: 'Supabase session is invalid or expired' });
    if (!customer.emailConfirmedAt) {
      return res.status(403).json({ error: 'A verified Supabase email is required to link this account' });
    }

    const linkedUser = await Database.getUserBySupabaseId(customer.id);
    if (linkedUser) return res.status(409).json({ error: 'This customer account is already linked' });

    const normalizedPhone = phone.trim();
    const existingUser = await Database.getUserByPhone(normalizedPhone);
    if (existingUser?.supabaseUserId) {
      return res.status(409).json({ error: 'This backend account is already linked to a customer login' });
    }
    if (!(await OTPService.verifyOTP(normalizedPhone, code))) {
      return res.status(401).json({ error: 'Phone verification failed' });
    }

    const ipAddress = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.header('user-agent') || '';
    const deviceId = `supabase:${customer.id}`;
    const login = await AuthService.authenticateUser(
      normalizedPhone,
      pin,
      deviceId,
      'VAULTEX customer app',
      ipAddress,
      userAgent
    );

    if (!(await OTPService.consumeOTP(normalizedPhone, code))) {
      return res.status(401).json({ error: 'Phone verification expired or was already used; request a new code' });
    }
    if (!(await Database.linkSupabaseUserId(login.user.id, customer.id))) {
      return res.status(409).json({ error: 'This account could not be linked; contact support' });
    }

    return res.status(201).json({
      linked: true,
      phone: `***${normalizedPhone.slice(-4)}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Account linking failed';
    const status = message === 'Supabase authentication is not configured' ? 503
      : message === 'Invalid PIN' || message === 'User not found' || message === 'PIN locked. Try later' ? 401
        : 500;
    if (status === 500) console.error('[Auth] Supabase customer account linking failed:', error);
    return res.status(status).json({
      error: status === 401 ? 'Account verification failed' : status === 503 ? message : 'Account linking failed',
    });
  }
});

app.get('/api/auth/customer-link', async (req: Request, res: Response) => {
  const accessToken = req.header('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return res.status(401).json({ error: 'Supabase sign-in is required' });

  try {
    const config = getBackendConfig();
    if (!config.postgresEnabled && config.nodeEnv !== 'test') {
      return res.status(503).json({ error: 'Persistent account-link storage is unavailable' });
    }

    const customer = await SupabaseAuthService.getCustomer(accessToken);
    if (!customer) return res.status(401).json({ error: 'Supabase session is invalid or expired' });
    if (!customer.emailConfirmedAt) {
      return res.status(403).json({ error: 'A verified Supabase email is required' });
    }

    const user = await Database.getUserBySupabaseId(customer.id);
    return res.json({
      linked: Boolean(user),
      phone: user ? `***${user.phone.slice(-4)}` : undefined,
    });
  } catch (error) {
    console.error('[Auth] Supabase customer account-link status lookup failed:', error);
    return res.status(503).json({ error: 'Account-link status is unavailable' });
  }
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
    return res.json({ authenticated: true, token: loginResult.token, user: { id: loginResult.user.id, phone: loginResult.user.phone } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Authentication failed';
    return res.status(400).json({ error: message });
  }
});

// ===== Auth Routes =====
app.post('/api/auth/signup', async (req: Request, res: Response) => {
  const { phone, pin, deviceId, deviceName } = req.body;

  if (!phone || !pin) {
    return res.status(400).json({ error: 'Phone and PIN required' });
  }

  try {
    const hashedPin = await AuthService.hashPIN(pin);
    const user = await AuthService.registerUser(phone, hashedPin);

    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.connection.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const result = await AuthService.authenticateUser(phone, pin, deviceId || uuidv4(), deviceName || 'Unknown Device', ipAddress, userAgent);

    return res.status(201).json({
      message: 'User registered',
      user: { id: user.id, phone: user.phone },
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
      },
      token: result.token,
    });
  } catch (error) {
    return res.status(401).json({ error: (error as Error).message });
  }
});

// Legacy crypto wallet routes stay explicitly disabled while existing records
// are preserved for review; they are not part of the bank-wire product.
app.all(['/api/wallet', '/api/wallet/*'], (_req: Request, res: Response) => {
  return res.status(410).json({ error: 'Crypto wallet functionality is not offered' });
});

// ===== Column Transfer Routes (Protected) =====
app.get('/api/column/transfers', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const transfers = await Database.listColumnWireTransfersForUser(req.userId!);
    return res.json(transfers.map((transfer) => toColumnWireReceipt(transfer)));
  } catch (error) {
    console.error('[Column] Transfer list failed:', error);
    return res.status(503).json({ error: 'Column transfer tracking is unavailable' });
  }
});

app.get('/api/column/transfers/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!getBackendConfig().columnEnabled) {
    return res.status(503).json({ error: 'Column integration is disabled' });
  }

  const transferId = req.params.id;
  if (!/^wire_[A-Za-z0-9]+$/.test(transferId)) {
    return res.status(400).json({ error: 'A valid Column wire transfer ID is required' });
  }

  try {
    const tracked = await Database.getColumnWireTransferForUser(req.userId!, transferId);
    if (!tracked) return res.status(404).json({ error: 'Column transfer not found' });

    const transfer = await ColumnService.getTransfer(transferId);
    if (typeof transfer.status === 'string') {
      await Database.updateColumnWireTransferStatus(transferId, transfer.status);
    }
    return res.json(toColumnWireReceipt(tracked, typeof transfer.status === 'string' ? transfer.status : tracked.status));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Column transfer lookup failed';
    const status = message === 'Column integration is disabled' ||
      message === 'Persistent PostgreSQL is required for Column wire tracking.' ? 503 : 502;
    return res.status(status).json({ error: message });
  }
});

app.post('/api/column/transfers/wire', authMiddleware, columnWireLimiter, async (req: AuthRequest, res: Response) => {
  const config = getBackendConfig();
  const { amount, currencyCode, recipientName, bankAccountId, counterpartyId, description, pin } = req.body;
  const idempotencyKey = req.header('Idempotency-Key');
  const numericAmount = typeof amount === 'number' || typeof amount === 'string' ? Number(amount) : NaN;

  if (!Number.isSafeInteger(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive integer in cents' });
  }
  if (currencyCode !== 'USD' ||
      typeof bankAccountId !== 'string' || bankAccountId.length === 0 ||
      typeof counterpartyId !== 'string' || counterpartyId.length === 0) {
    return res.status(400).json({ error: 'USD currency, bank account, and counterparty are required' });
  }
  if (typeof recipientName !== 'string' || !recipientName.trim() || recipientName.trim().length > 100) {
    return res.status(400).json({ error: 'Recipient name is required and must be 100 characters or fewer' });
  }
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 255) {
    return res.status(400).json({ error: 'An Idempotency-Key header between 16 and 255 characters is required' });
  }
  if (typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) {
    return res.status(400).json({ error: 'A valid PIN is required' });
  }
  if (!config.columnLiveWiresEnabled) {
    return res.status(503).json({ error: 'Live Column wire submissions are disabled' });
  }
  if (!config.postgresEnabled) {
    return res.status(503).json({ error: 'Persistent Column wire tracking is unavailable' });
  }

  try {
    const user = await Database.getUserById(req.userId!);
    if (!user || !(await AuthService.verifyPIN(pin, user.pinHash))) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }

    const normalizedDescription = typeof description === 'string' ? description.slice(0, 140) : undefined;
    const tracked = await Database.prepareColumnWireTransfer({
      userId: req.userId!,
      idempotencyKey,
      amountCents: numericAmount,
      currencyCode,
      recipientName: recipientName.trim(),
      bankAccountId,
      counterpartyId,
      description: normalizedDescription,
    });
    if (tracked.transferId) {
      const transfer = await ColumnService.getTransfer(tracked.transferId);
      if (typeof transfer.status === 'string') {
        await Database.updateColumnWireTransferStatus(tracked.transferId, transfer.status);
      }
      return res.status(200).json(toColumnWireReceipt(
        tracked,
        typeof transfer.status === 'string' ? transfer.status : tracked.status
      ));
    }

    let transfer: Record<string, unknown>;
    try {
      transfer = await ColumnService.createWire({
        amount: numericAmount,
        currencyCode,
        bankAccountId,
        counterpartyId,
        description: normalizedDescription,
        idempotencyKey,
      });
    } catch (error) {
      await Database.markColumnWireSubmissionUnknown(idempotencyKey, 'UPSTREAM_REQUEST_FAILED');
      throw error;
    }
    if (typeof transfer.id !== 'string' || typeof transfer.status !== 'string') {
      await Database.markColumnWireSubmissionUnknown(idempotencyKey, 'INVALID_UPSTREAM_RESPONSE');
      return res.status(502).json({ error: 'Column returned an incomplete wire response; reconcile before retrying' });
    }
    await Database.recordColumnWireSubmission(idempotencyKey, {
      id: transfer.id,
      status: transfer.status,
    });
    return res.status(201).json(toColumnWireReceipt(tracked, transfer.status));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Column wire creation failed';
    if (error instanceof ColumnWireIdempotencyConflictError) {
      return res.status(409).json({ error: error.message });
    }
    const status = message === 'Column integration is disabled' ||
      message === 'Persistent PostgreSQL is required for Column wire tracking.' ? 503 : 502;
    return res.status(status).json({ error: status === 503 ? message : 'Column wire submission failed; check tracked status before retrying' });
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
  const databaseConnected = postgresEnabled ? await PostgresService.checkReady() : true;
  return res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'ok' : 'degraded',
    message: 'Vaultex bank-transfer backend is running',
    databaseDriver,
    postgresEnabled,
    databaseConnected,
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
    if (config.nodeEnv === 'production' && !(await PostgresService.checkReady())) {
      console.error('Production database schema is unavailable');
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
