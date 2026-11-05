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
- Live wire submission remains hard-disabled in code pending operational verification and explicit approval. The `COLUMN_LIVE_WIRES_ENABLED` flag cannot enable it.
- Keep both Column flags disabled in staging. Do not use production credentials or enable live wires for testing.
- The future wire request treats `amount` as gross USD cents and allocates 20% to the server-configured Wells Fargo reserve counterparty and the remaining 80% to the authorized recipient. The reserve is rounded down to a whole cent; any remainder stays with the recipient. Column fees are separate.
- Both legs use distinct idempotency keys and are submitted concurrently. They are separate transfers, not an atomic transaction; `PARTIAL` or `SUBMISSION_UNKNOWN` requires reconciliation, while `PROCESSING` means Column accepted the legs but they are not both complete. Never automatically retry an uncertain leg, and a provider status does not mean funds arrived immediately at a bank.
- Recipient counterparty and source bank-account authorizations are stored server-side in `column_wire_authorizations`; the request cannot choose an arbitrary source account. Provision mappings through the controlled database-operator process only after verifying ownership. The Wells Fargo Column counterparty ID belongs in the server-only `COLUMN_RESERVE_COUNTERPARTY_ID` setting, never in the browser.
- The wire endpoint currently accepts USD only. Confirm corridors, currencies, beneficiary fields, fees, FX, and sandbox availability with Column before claiming international support.
- A provider-completed status is not proof that the recipient bank credited funds.
- The health endpoint reports database readiness only; blockchain health is not part of this product.
- Do not retry an uncertain payment. Reconcile its status with Column and the receiving bank first.

### Authorized hold review and escalation

When a wire reports `HOLD`, `PRE_REVIEW`, or `MANUAL_REVIEW`:

1. Stop further attempts for that payment. Do not submit a replacement, call a clear/release endpoint, alter the transfer payload, or use another identity to evade the review.
2. In Column's authorized dashboard, find each transfer by its provider transfer ID. For split payments, inspect both legs under the same split reference; one leg can advance while the other is held.
3. Record the status, provider transfer ID, split reference and leg, amount/currency, submission time, and any provider-supplied reason or reference. Keep account and identity data in approved secure systems; never put credentials, full bank details, or sensitive customer documents in logs, tickets, or chat.
4. Ask the authorized Column reviewer or support contact for the specific reason, required evidence, expected review timing, and any permitted next step. Provide only the documentation requested through Column's approved secure channel. Keep a record of the reviewer, case/reference number, response, and decision.
5. Escalate through Column's official support/compliance channel if the reason or timing is unclear or the review exceeds the provider's stated window. Do not promise immediate approval or bank receipt.
6. Reconcile both legs with Column and, where needed, the receiving bank before treating the payment as complete or taking corrective action. A held, rejected, or uncertain leg may coexist with a completed other leg; never automatically retry or roll back either leg.

Only a Column-authorized reviewer may make review decisions in the provider's approved workflow. The application does not clear holds, influence reviewer decisions, or pay for approval. Any legitimate fee or commission must be contractually authorized, transparently disclosed, and accounted for separately from the transfer and reserve allocation.

The startup schema includes the nullable-wallet change and the split-wire authorization/tracking fields. The changes are documented in `backend/sql/002_bank_wire_only_auth.sql` and `backend/sql/003_column_wire_authorizations.sql`. Back up production data before deployment. Existing wallet data is intentionally retained until it can be safely reconciled; do not clear it as part of this product conversion.

An authorization row must be provisioned by a trusted database operator and kept disabled until the customer, source account, recipient, and Column counterparty have been verified:

```sql
INSERT INTO column_wire_authorizations
  (user_id, counterparty_id, bank_account_id, recipient_name, enabled)
VALUES
  ('<internal-user-id>', '<approved-recipient-counterparty-id>',
   '<approved-source-bank-account-id>', '<verified-recipient-name>', FALSE);
```

The client submits only the authorized recipient counterparty ID. The backend obtains the source account from this table; an optional client-supplied source account must match it. Do not expose a self-service path to enable or edit these records.

## Staging

The root `render.yaml` defines an isolated staging service with a separately configured PostgreSQL URL. Keep `COLUMN_ENABLED=false` and `COLUMN_LIVE_WIRES_ENABLED=false`. The staging API can validate startup, database readiness, authentication, and transfer tracking, but it must not submit live wires.

Configure `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `CORS_ORIGIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_PHONE` privately in the Render staging service. Set `CORS_ORIGIN` to the exact customer-app Vercel Preview origin (scheme and hostname only, no path); update it if the preview hostname changes. The blueprint selects Twilio OTP because console OTP is not supported for customer account linking outside automated tests. Do not deploy the staging service until its required values have been entered. Use sandbox/test identities and phone numbers you control; never put credentials in this repository or chat.

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
GET  /api/environment
POST /api/auth/request-otp
POST /api/auth/verify-otp
POST /api/auth/signup       # requires and consumes a valid phone OTP
POST /api/auth/request-link-otp
POST /api/auth/link-customer
POST /api/auth/login
GET  /api/column/transfers
GET  /api/column/transfers/:id
POST /api/column/transfers
POST /api/webhooks/column
GET  /api/wallet       # HTTP 410; not offered
POST /api/wallet/*     # HTTP 410; not offered
```
