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

### Neon/PostgreSQL

The backend can use PostgreSQL when `DATABASE_DRIVER=postgres` and `DATABASE_URL` are configured. Startup initializes and checks the runtime schema; the core migration is also stored at `backend/sql/001_initial_neon_schema.sql`. Keep a verified database backup before production schema changes.

The supplied product tables for virtual cards, yield positions, and token portfolios are intentionally deferred until those features have backend routes and service logic.

### Column wires and webhook tracking

Live wire submission is disabled unless `COLUMN_LIVE_WIRES_ENABLED=true` is set in production. It also requires Column and PostgreSQL to be configured. Each request is persisted by user and `Idempotency-Key` before the upstream submission; reusing a key with different request details returns a conflict. Wire status is updated from deduplicated Column webhook events and refreshed from Column when an authorized user looks up their tracked transfer. These provider statuses are not independent confirmation that the recipient bank credited the funds. Webhook delivery failures return an error so Column can retry; monitor Column's delivery dashboard and the backend health endpoint after configuration.

Keep `COLUMN_LIVE_WIRES_ENABLED=false` in development and staging unless Column explicitly provides a sandbox with non-production credentials and endpoints. Do not enable production wires until credentials are rotated, the production database has a verified backup and restore, and signed webhook deliveries have succeeded.

Receipts use a customer-facing Vaultex reference and show only recipient display name, amount, rail, and provider status. They omit Column transfer IDs, idempotency keys, bank-account/counterparty IDs, and raw provider payload fields such as IMAD/OMAD. Do not display current account balance on a recipient receipt. Only show a bank logo or account suffix when sourced from a verified institution/counterparty record; the current wire API does not provide verified branding or recipient account details. A provider-completed wire status is not proof of recipient-bank posting.

### Staging deployment

The root `render.yaml` defines a blueprint for a separate, free Render staging
API. It uses `NODE_ENV=staging`, PostgreSQL, and explicitly disables Column
and live wires. Its public Polygon RPC endpoint is for read-only network
connectivity checks; mainnet transfers remain disabled.
Create a **new staging database**, such as a separate Neon project; never point
staging at the production database. Render's free Postgres databases expire
after 30 days and do not support backups, so they are not suitable for staging
([Render free-tier limits](https://render.com/docs/free#free-postgres-instances)).

When creating the Blueprint in Render, provide `DATABASE_URL`, `JWT_SECRET`,
and `ENCRYPTION_KEY` directly in Render's environment settings.
Use staging-only database credentials and independently generated secrets at
least 64 characters long. Do not put secret values in this repository or chat.
Keep `COLUMN_ENABLED=false` and `COLUMN_LIVE_WIRES_ENABLED=false` until Column
confirms the sandbox API endpoint and sandbox credentials are configured only
in the staging service.

The staging blueprint uses a public Polygon RPC endpoint to verify chain
connectivity without an API key. Public RPC availability and rate limits are
not guaranteed; replace it with a staging-only provider URL in Render if it
becomes unreliable. Do not enable Polygon mainnet transfers in staging.

The staging environment can validate startup, database readiness, and
read-only health checks. The current wire-submission gate intentionally rejects
wire submissions outside production, so a Column sandbox transfer cannot be
sent from staging until a separate, explicitly sandbox-only submission gate is
implemented and tested. Never turn on the production live-wire setting to work
around this restriction. Free Render services can sleep when idle; do not treat
them as production or as proof of dependable webhook delivery.

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
ENCRYPTION_KEY=change-in-production
DATABASE_DRIVER=postgres
DATABASE_URL=postgresql://...
OTP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_PHONE=+15550000000
PORT=4000
```

Use `OTP_PROVIDER=console` only for local development. Production must use `twilio` with all three Twilio settings configured; never commit these values.

## Blockchain Integration

- **Network**: Polygon Mainnet
- **USDT Address**: `0xc2132D05D31c914a87C6611C10748AEb04B58e8F`
- **Decimals**: 6
- **RPC**: configured through `POLYGON_RPC_URL`

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
