# Vaultex - USDT Wallet

Vaultex is a secure USDT wallet application for storing, sending, receiving, and converting USDT easily with enterprise-grade security features.

## Key Features

### 🔐 Security

- **OTP Verification**: Phone-based OTP for registration and sensitive actions
- **Encrypted Wallet Storage**: AES-256 encrypted private keys (PIN-protected)
- **User Authentication**: JWT token-based auth with 24-hour expiry
- **Device Authorization**: Device tracking and login notifications
- **Secure PIN**: Bcryptjs hashing with 10-round salts

### 💰 Wallet Features

- **Blockchain USDT Integration**: Send and receive USDT on Polygon network
- **Automatic Wallet Generation**: Ethereum-compatible wallet addresses
- **Transaction History**: Complete deposit and withdrawal tracking
- **Real-time Balance**: Live USDT balance from blockchain

### 📱 User Features

- **Multi-step Registration**: Phone → OTP → PIN → Wallet
- **Device Management**: View registered devices and login history
- **Login Notifications**: Get alerts for new device logins
- **Responsive Design**: Works on desktop and mobile

## Quick Start

### Prerequisites

- Docker Desktop installed and running
- Node.js 24+ (if running without Docker)

### Run with Docker

```bash
cd VAULTEX
docker compose up --build
```

Services available at:

- **Frontend**: `http://localhost:5173`
- **Backend**: `http://localhost:4000`

### Run Locally (Node.js)

```bash
# Install frontend dependencies
cd frontend
npm install
npm run dev

# In another terminal, install backend dependencies
cd ../backend
npm install
npm run dev
```

## Architecture

### Frontend Stack

- React 19 + TypeScript
- Vite for fast development
- Ethers.js for blockchain interaction
- React Router for navigation
- CryptoJS for encryption

### Backend Stack

- Express.js + TypeScript
- JWT for authentication
- Bcryptjs for password hashing
- Ethers.js for blockchain
- In-memory database (easily swappable with PostgreSQL)

## Project Structure

```text
VAULTEX/
├── frontend/          # React web app
│   ├── src/
│   │   ├── pages/     # All pages (Login, SignUp, Dashboard, etc.)
│   │   ├── services/  # Blockchain & encryption services
│   │   ├── contexts/  # Wallet context provider
│   │   └── components/# Reusable components
│   └── package.json
├── backend/          # Express API server
│   ├── src/
│   │   ├── services/ # Auth, OTP, blockchain services
│   │   ├── models/   # TypeScript interfaces
│   │   ├── middleware/ # Auth middleware
│   │   └── index.ts  # Main server file
│   └── package.json
├── docker-compose.yml
├── Dockerfile
└── ADVANCED_FEATURES.md  # Detailed feature documentation
```

## API Endpoints

### Authentication

```text
POST /api/auth/request-otp     # Request OTP
POST /api/auth/verify-otp      # Verify OTP code
POST /api/auth/signup          # Create account
POST /api/auth/login           # Sign in
```

### Wallet (Protected)

```text
GET /api/wallet                # Get wallet info
POST /api/wallet/send          # Send USDT
```

### Devices & Notifications (Protected)

```text
GET /api/devices               # List registered devices
GET /api/notifications         # Get login notifications
PATCH /api/notifications/:id/read  # Mark as read
```

## User Workflow

### 1. Sign Up

1. Go to `/signup`
2. Enter phone number
3. Request OTP
4. Enter OTP code (check backend logs for demo OTP)
5. Create PIN
6. ✅ Wallet automatically generated

### 2. Login

1. Go to `/login`
2. Enter phone and PIN
3. Device authorized and registered
4. ✅ Access wallet

### 3. Send USDT

1. Click "Send" on dashboard
2. Enter recipient address
3. Enter amount
4. Confirm with PIN
5. ✅ Transaction initiated

### 4. Receive USDT

1. Click "Receive" on dashboard
2. Share wallet address
3. Share QR code (placeholder)
4. ✅ Wait for transaction

### 5. Monitor Devices

1. Click "Devices"
2. View all registered devices
3. Check login notifications
4. Mark notifications as read

## Documentation

- **[ADVANCED_FEATURES.md](./ADVANCED_FEATURES.md)** - Comprehensive guide to all security and blockchain features
- **[DOCKER.md](./DOCKER.md)** - Docker setup and deployment instructions

## Security Notes

⚠️ **Development Only**: This demo uses:

- In-memory database (data lost on restart)
- Hardcoded secrets (change in production)
- Testnet USDT (no real value)
- Console OTP logging (security risk)

**Production Ready**:

- ✅ Encrypted storage
- ✅ JWT authentication
- ✅ OTP verification
- ✅ Device tracking
- ✅ PIN hashing
- ⚠️ Needs: Real database, SMS service, HTTPS, rate limiting

## Environment Variables

```bash
# Frontend (.env)
REACT_APP_API_URL=http://localhost:4000
REACT_APP_ENCRYPTION_KEY=change-in-production

# Backend (.env)
JWT_SECRET=change-in-production
PORT=4000
```

## Blockchain Integration

- **Network**: Polygon Mumbai Testnet
- **USDT Address**: `0x1c89d6b3b2aad82f3519c5e4938e2e8976030b36`
- **Decimals**: 6
- **RPC**: `https://rpc-mumbai.maticvigil.com`

Get test MATIC for gas fees: <https://faucet.polygon.technology/>

## Testing

### Test Credentials

```text
Phone: +1 555 123 4567
OTP: (check backend console logs)
PIN: 1234
```

### API Testing

Use Postman/curl to test endpoints:

```bash
curl -X POST http://localhost:4000/api/health
```

## Contributing

1. Create a branch
2. Make changes
3. Test locally with Docker
4. Submit PR

## License

MIT

## Support

See [Support](http://localhost:5173/support) page in app for in-app help.

For issues or questions, check [ADVANCED_FEATURES.md](./ADVANCED_FEATURES.md) for detailed technical documentation.
