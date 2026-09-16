# Vaultex Advanced Features

## ✅ Implemented Features

### 1. Blockchain USDT Integration

**Location:** `frontend/src/services/blockchainService.ts`

- **Wallet Generation**: Automatically generates Ethereum-compatible wallet addresses for USDT
- **Network**: Polygon Mumbai testnet (easily configurable to mainnet)
- **Supported Operations**:
  - Get USDT balance
  - Send USDT to any address
  - Fetch transaction status
  - Get ETH balance for gas fees

**Usage:**

```typescript
import blockchainService from './services/blockchainService';

// Generate new wallet
const wallet = blockchainService.constructor.generateWallet();
// Returns: { address: '0x...', privateKey: '0x...' }

// Get balance
const balance = await blockchainService.getUSDTBalance(address);

// Send USDT
const txHash = await blockchainService.sendUSDT(toAddress, amount);
```

**Contract Info:**

- USDT Address: `0x1c89d6b3b2aad82f3519c5e4938e2e8976030b36` (Mumbai)
- Decimals: 6

---

### 2. OTP Verification Service

**Location:** `backend/src/services/otpService.ts`

- **OTP Generation**: Random 6-digit codes
- **Expiry**: 10 minutes
- **Retry Limit**: 3 attempts per code
- **Automatic Cleanup**: Old OTPs are removed

**Flow:**

1. User requests OTP via `/api/auth/request-otp`
2. System generates and logs OTP (in production, send via SMS)
3. User verifies OTP via `/api/auth/verify-otp`
4. Token can then be used for registration

**Integration:**

```typescript
// Frontend
await requestOTP(phone);
const verified = await verifyOTP(phone, otpCode);

// Backend
app.post('/api/auth/request-otp', (req, res) => {
  // Generate and send OTP
});
```

---

### 3. Encrypted Wallet Storage

**Location:** `frontend/src/services/encryptionService.ts`

- **Algorithm**: AES-256 encryption via CryptoJS
- **PIN-Based**: Private keys encrypted using user's PIN
- **Secure Hashing**: PBKDF2 with 1000 iterations
- **No Cleartext Storage**: Private keys never stored in plain text

**Security Features:**

```typescript
// Encrypt wallet private key
const encrypted = encryptionService.encryptWalletData(privateKey, userPin);

// Decrypt wallet (requires correct PIN)
const { privateKey, createdAt } = encryptionService.decryptWalletData(encrypted, userPin);

// Hash PIN for storage
const hashedPin = encryptionService.hashPIN(pin);

// Verify PIN during login
const isCorrect = encryptionService.verifyPIN(pin, hashedPin);
```

**Flow:**

1. User creates PIN during signup
2. Private key encrypted with PIN + secret key
3. Encrypted data stored in backend
4. On login, user provides PIN to decrypt wallet
5. Private key loaded into memory for transactions

---

### 4. User Authentication Backend

**Location:** `backend/src/services/authService.ts`

- **JWT Tokens**: Secure session management
- **Token Expiry**: 24 hours
- **Bcrypt Hashing**: PIN stored with salt (10 rounds)
- **Device Tracking**: Each login associates a device

**API Endpoints:**

```text
POST /api/auth/request-otp
  Body: { phone }
  Response: { message, expiresAt }

POST /api/auth/verify-otp
  Body: { phone, code }
  Response: { message, verified }

POST /api/auth/signup
  Body: { phone, pin, walletAddress, encryptedPrivateKey, deviceId, deviceName }
  Response: { user, token }

POST /api/auth/login
  Body: { phone, pin, deviceId, deviceName }
  Response: { user, token }

GET /api/wallet (Protected)
  Headers: { Authorization: Bearer <token> }
  Response: { address, verified, createdAt }

POST /api/wallet/send (Protected)
  Body: { to, amount }
  Response: { message, txHash, status }
```

**Protected Routes:**

All `/api/wallet/*` routes require valid JWT token in Authorization header

---

### 5. Device Authorization & Login Notifications

**Location:** `backend/src/services/database.ts` + middleware

**Features:**

- **Device Registration**: Auto-registers device on first login
- **Device Tracking**: Tracks IP, user agent, last activity
- **Login Notifications**: Creates notification for each login attempt
- **Authorization Status**: Devices can be marked as authorized/unauthorized

**Notification Types:**

```typescript
{
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  timestamp: Date;
  read: boolean;
}
```

**API Endpoints:**

```text
GET /api/devices (Protected)
  Response: Device[]

GET /api/notifications (Protected)
  Response: LoginNotification[]

PATCH /api/notifications/:id/read (Protected)
  Response: { ...notification, read: true }
```

**Frontend Integration:**

```typescript
// Load notifications
await getNotifications();

// Mark as read
await markNotificationAsRead(notificationId);

// View devices page
// Navigate to /devices to see all registered devices and login history
```

---

## Database Schema (In-Memory)

### Users Table

```text
id: UUID
phone: string (unique)
pinHash: string (bcrypt)
walletAddress: string (unique)
encryptedPrivateKey: string
verified: boolean
createdAt: Date
lastLogin: Date
```

### Devices Table

```text
id: UUID
userId: UUID (foreign key)
deviceId: string
deviceName: string
ipAddress: string
userAgent: string
authorized: boolean
lastActivity: Date
createdAt: Date
```

### OTP Table

```text
id: UUID
phone: string
code: string (6 digits)
expiresAt: Date
attempts: number (max 3)
createdAt: Date
```

### Notifications Table

```text
id: UUID
userId: UUID (foreign key)
deviceId: UUID (foreign key)
deviceName: string
ipAddress: string
timestamp: Date
read: boolean
```

---

## Security Considerations

### ✅ Implemented

- PIN hashing with bcryptjs (10 rounds salt)
- AES-256 encryption for private keys
- JWT tokens with 24h expiry
- Device tracking and authorization
- Login notifications
- OTP verification
- HTTPS-ready (use with reverse proxy)

### ⚠️ Production Recommendations

- Use real SMS service for OTP (Twilio, AWS SNS)
- Replace in-memory database with MongoDB/PostgreSQL
- Enable HTTPS/TLS
- Add rate limiting for auth endpoints
- Add 2FA (TOTP/authenticator app)
- Implement IP whitelist for devices
- Add suspicious activity detection
- Regular security audits
- Use environment variables for secrets
- Implement login attempt limits

---

## Environment Variables

Create `.env` file in root and backend folders:

```text
# Frontend (.env)
REACT_APP_API_URL=http://localhost:4000
REACT_APP_ENCRYPTION_KEY=your-secret-key

# Backend (.env)
JWT_SECRET=your-jwt-secret
PORT=4000
```

---

## Testing the Features

### 1. Test Signup with OTP

```text
1. Navigate to /signup
2. Enter phone number
3. Request OTP
4. Check backend logs for OTP code (e.g., "OTP 123456 sent to +1 555...")
5. Enter OTP
6. Create PIN
7. Wallet automatically generated and encrypted
```

### 2. Test Login

```text
1. Navigate to /login
2. Enter same phone and PIN
3. System verifies credentials and JWT token generated
4. Device registered and notification created
```

### 3. Test Device Tracking

```text
1. After login, navigate to /devices
2. View registered device with IP and last activity
3. View login notification showing device name and time
```

### 4. Test Encrypted Storage

```text
1. Private key is encrypted with user's PIN
2. Only accessible when correct PIN provided
3. Decryption happens in memory, never stored decrypted
```

---

## API Documentation

Full API docs available at `/api/health` (ping endpoint)

### Example Requests

```bash
# Request OTP
curl -X POST http://localhost:4000/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1 555 123 4567"}'

# Verify OTP
curl -X POST http://localhost:4000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1 555 123 4567", "code": "123456"}'

# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1 555 123 4567", "pin": "1234", "deviceId": "device_123", "deviceName": "My Phone"}'

# Get Wallet (with auth)
curl -X GET http://localhost:4000/api/wallet \
  -H "Authorization: Bearer <jwt_token>"

# Get Notifications
curl -X GET http://localhost:4000/api/notifications \
  -H "Authorization: Bearer <jwt_token>"
```

---

## File Structure

```text
frontend/
  src/
    services/
      blockchainService.ts (USDT integration)
      encryptionService.ts (Encryption & hashing)
    contexts/
      WalletContext.tsx (Enhanced with blockchain & auth)
    pages/
      Login.tsx (Updated for async auth)
      SignUp.tsx (Multi-step OTP flow)
      Devices.tsx (Device tracking & notifications)
      
backend/
  src/
    services/
      authService.ts (JWT & PIN hashing)
      otpService.ts (OTP generation & verification)
      database.ts (In-memory database)
    middleware/
      authMiddleware.ts (JWT validation)
    models/
      types.ts (TypeScript interfaces)
    index.ts (Express routes)
```

---

## Next Steps

For full production deployment:

1. Replace in-memory DB with PostgreSQL + Prisma
2. Add rate limiting (express-rate-limit)
3. Set up real SMS service (Twilio)
4. Configure CORS for production domain
5. Add logging (winston/pino)
6. Set up CI/CD pipeline
7. Add E2E tests
8. Deploy to cloud (AWS/Digital Ocean/Vercel)
