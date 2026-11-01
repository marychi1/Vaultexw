# VAULTEX bank-wire backend

VAULTEX is being narrowed to bank wires. This backend currently models USD wires through Column; it does not establish that international corridors or a Fedwire settlement path are available. The customer app now supports linking a confirmed Supabase login to an existing backend account, but wire submission remains disabled.

Crypto wallets, blockchain transfers, cards, and token products are not part of the current product. New accounts are created without wallets. Legacy wallet/key columns and records are preserved; the migration makes those columns nullable and does not erase existing data. The legacy wallet API returns HTTP 410.

## Run and test

Requirements: Node.js and npm.

```powershell
cd backend
npm install
npm run dev
npm test
npm run build
```

The API listens on port 3000 by default. Local authentication and the file-backed database are development defaults; use PostgreSQL and a real OTP provider for deployed environments.

## Wire status and safety

- Column integration is disabled unless `COLUMN_ENABLED=true` and valid provider credentials are configured.
- Live wire submission additionally requires `COLUMN_LIVE_WIRES_ENABLED=true`, `NODE_ENV=production`, and PostgreSQL.
- Keep both Column flags disabled in staging. Do not use production credentials or enable live wires for testing.
- The wire endpoint currently accepts USD only. Confirm corridors, currencies, beneficiary fields, fees, FX, and sandbox availability with Column before claiming international support.
- A provider-completed status is not proof that the recipient bank credited funds.
- The health endpoint reports database readiness only; blockchain health is not part of this product.
- Do not retry an uncertain payment. Reconcile its status with Column and the receiving bank first.

The startup schema includes the nullable-wallet change. The same change is documented in `backend/sql/002_bank_wire_only_auth.sql`. Back up production data before deployment. Existing wallet data is intentionally retained until it can be safely reconciled; do not clear it as part of this product conversion.

## Staging

The root `render.yaml` defines an isolated staging service with a separately configured PostgreSQL URL. Keep `COLUMN_ENABLED=false` and `COLUMN_LIVE_WIRES_ENABLED=false`. The staging API can validate startup, database readiness, authentication, and transfer tracking, but it must not submit live wires.

Configure `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_PHONE` privately in the Render staging service. The blueprint selects Twilio OTP because console OTP is not supported for customer account linking outside automated tests. Do not deploy the staging service until its required values have been entered. Use sandbox/test identities and phone numbers you control; never put credentials in this repository or chat.

### Pull request preview databases

`.github/workflows/neon-preview-branches.yml` creates an isolated Neon branch
named `preview/pr-<number>` for same-repository pull requests, based on the
Neon `production` branch. Preview branches expire after 14 days and are deleted
when the pull request closes. Fork pull requests are skipped so Neon credentials
are never exposed to untrusted workflows.

Before enabling the workflow, configure the GitHub repository variable
`NEON_PROJECT_ID` with the staging Neon project ID and the Actions secret
`NEON_API_KEY` with a Neon API key scoped to that project. Do not set the
production project ID or grant this key access to production data. The workflow
does not pass connection strings into logs or run migrations; preview databases
are not connected to the application until a separate migration/test job is
explicitly configured.

## Customer app

`frontend-next` presents wire-service status only. The separate customer app has a link-only flow that binds a confirmed Supabase identity to an existing backend account after phone OTP and PIN verification. Wire initiation and tracking are not enabled in that app. Do not expose transfer records or enable submission until Column account ownership, counterparty controls, sandbox support, and rail/limit details are verified.

The customer app is maintained in a separate repository. Its legal and compliance pages are drafts and require qualified review before launch.

## API

```text
GET  /api/health
POST /api/auth/request-otp
POST /api/auth/request-link-otp
POST /api/auth/verify-otp
POST /api/auth/link-customer
POST /api/auth/signup
POST /api/auth/login
GET  /api/column/transfers
GET  /api/column/transfers/:id
POST /api/column/transfers
POST /api/column/webhook
GET  /api/wallet       # HTTP 410; not offered
POST /api/wallet/*     # HTTP 410; not offered
```
