# VAULTEX bank-wire backend

VAULTEX is being narrowed to bank wires. Column has confirmed that its outgoing domestic USD wires use Fedwire, as reported by the account holder. This code does not establish that VAULTEX is enabled for production Fedwire transfers or that international corridors are available. The separate customer app supports linking a confirmed Supabase login to an existing backend account, but customer-app wire submission remains disabled.

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

The API listens on port 3002 by default in development (Render supplies its own `PORT`). This keeps it separate from the customer app on port 3000 and the backend frontend on port 3001. Set `NEXT_PUBLIC_API_URL=http://localhost:3002` for the backend frontend. Local authentication and the file-backed database are development defaults; use PostgreSQL and a real OTP provider for deployed environments.

### Column sandbox wire testing

The authenticated `frontend-next` app includes a test-wire form at `/send`.
Sandbox submission is disabled unless all of the following are true:

- The backend is not running with `NODE_ENV=production`.
- `COLUMN_ENABLED=true` and `COLUMN_SANDBOX_WIRES_ENABLED=true`.
- `COLUMN_API_KEY` is a Column `test_` key and `COLUMN_BASE_URL` is exactly `https://api.column.com`.
- PostgreSQL is configured for durable idempotency and transfer tracking.
- The signed-in test account uses valid Column sandbox bank-account and counterparty IDs.

Configure these only in an isolated, non-production environment. Use a
configured `JWT_SECRET` (at least 64 characters) and `ENCRYPTION_KEY` (at least
32 characters); development-only fallback keys are random and process-local.
Keep `COLUMN_LIVE_WIRES_ENABLED` unset/false. A sandbox response is not a real payment
or evidence that a beneficiary bank credited funds. The separate
`vaultex-customer-app` is not connected to this submission route; its Supabase
account-link flow does not authorize wire submission.
The visible environment banner reads a public, secret-free status from the
backend. It distinguishes development, staging, and production from whether
wire submission is enabled. In development it identifies the app as sandbox
and only claims Column test mode when the explicit sandbox flag, test key, and
approved Column API URL are configured. The frontend requires a configured
HTTPS backend origin outside local development; it does not fall back to a
localhost API in deployed environments.

## Wire status and safety

- Column integration is disabled unless `COLUMN_ENABLED=true` and valid provider credentials are configured.
- Live wire submission remains hard-blocked pending production, Column, compliance, and operational approval. Setting `COLUMN_LIVE_WIRES_ENABLED=true` fails production startup; do not remove this block.
- The customer app's beneficiary workflow is sandbox-only and disabled by default. It requires `COLUMN_CUSTOMER_COUNTERPARTIES_ENABLED=true`, a Column test key, PostgreSQL, and a non-production backend. The backend verifies each created counterparty with Column and stores only its owner, provider ID, display name, account suffix, and an HMAC fingerprint; uncertain creations are held for reconciliation and cannot be retried automatically.
- Live platform-funded wires must use `COLUMN_WIRE_BANK_ACCOUNT_ID` and `COLUMN_PLATFORM_ENTITY_ID`, verified against Column's bank-account response. The submitted counterparty must be registered to the authenticated backend user; the client cannot choose the funding account or override the registered beneficiary name.
- Keep both Column flags disabled in staging. Do not use production credentials or enable live wires for testing.
- The wire endpoint currently accepts USD only. Column has confirmed its outgoing domestic USD wires use Fedwire; VAULTEX's production enablement, limits, and authorization remain to be confirmed. Confirm corridors, currencies, beneficiary fields, fees, FX, and sandbox availability with Column before claiming international support.
- A provider-completed status is not proof that the recipient bank credited funds.
- The health endpoint reports database readiness only; blockchain health is not part of this product.
- Do not retry an uncertain payment. Reconcile its status with Column and the receiving bank first.

The startup schema includes the nullable-wallet change. The same change is documented in `backend/sql/002_bank_wire_only_auth.sql`. Back up production data before deployment. Existing wallet data is intentionally retained until it can be safely reconciled; do not clear it as part of this product conversion.

## Staging

The root `render.yaml` defines an isolated staging service with a separately configured PostgreSQL URL. Column and all wire/counterparty feature flags default to `false`. Keep `COLUMN_LIVE_WIRES_ENABLED=false` permanently; the production live-wire path is hard-blocked in code.

Configure `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `CORS_ORIGIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_PHONE` privately in the Render staging service. Set `CORS_ORIGIN` to the exact customer-app Vercel Preview origin (scheme and hostname only, no path); update it if the preview hostname changes. The blueprint selects Twilio OTP because console OTP is not supported for customer account linking outside automated tests. Do not deploy the staging service until its required values have been entered. Use sandbox/test identities and phone numbers you control; never put credentials in this repository or chat.
For an explicitly approved sandbox E2E run only, first confirm the service points to a dedicated non-production database and health reports `environment: "staging"` with `wireSubmissions: "disabled"`. Configure a Column `test_` API key and sandbox webhook values in Render's secret store, then enable `COLUMN_ENABLED=true`, `COLUMN_CUSTOMER_COUNTERPARTIES_ENABLED=true`, and `COLUMN_SANDBOX_WIRES_ENABLED=true` only for the test window. Never set `COLUMN_LIVE_WIRES_ENABLED=true`; do not configure production funding-account identifiers in staging. Use Column-provided sandbox account/beneficiary fixtures or synthetic test details, never real customer bank details. Run the beneficiary create/list, sandbox wire, idempotency, and status-reconciliation checks, then restore all three opt-in flags to `false`. Do not run migration `backend/sql/003_column_customer_counterparties.sql` against production.

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

`frontend-next` provides an authenticated, explicitly gated Column sandbox test flow. The separate customer app has a link-only flow that binds a confirmed Supabase identity to an existing backend account after phone OTP and PIN verification. Wire initiation and tracking are not enabled in that customer app. Do not expose transfer records or enable submission until Column account ownership, counterparty controls, sandbox support, and rail/limit details are verified.

The customer app is maintained in a separate repository. Its current availability is shown in the environment banner and service page; it should not be buried as a one-off statement in draft Terms. The legal and compliance pages are drafts and require qualified review before launch.

## API

```text
GET  /api/health
GET  /api/environment
POST /api/auth/request-otp
POST /api/auth/request-link-otp
POST /api/auth/verify-otp
POST /api/auth/link-customer
POST /api/auth/signup       # requires and consumes a valid phone OTP
POST /api/auth/login
GET  /api/column/transfers
GET  /api/column/transfers/:id
POST /api/column/transfers/wire
POST /api/column/transfers/wire/sandbox
POST /api/column/webhook
GET  /api/wallet       # HTTP 410; not offered
POST /api/wallet/*     # HTTP 410; not offered
```
