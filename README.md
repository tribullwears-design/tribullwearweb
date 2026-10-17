# tribullwearweb

## Render backend deployment

The backend and its dependencies are part of this repository-root pnpm project; do not set Render's root directory to `backend/`.

Render serves the backend API only. `GET /health` is the health-check endpoint, `/api/*` serves the backend routes, and other paths return a JSON 404. The Vite storefront remains deployed separately on Vercel; the backend does not serve `dist/public`.

After pushing this change, deploy the latest commit to Render and set its health-check path to `/health`. The Vercel frontend proxies `/api/*` to the Render service so browser session cookies remain same-origin; deploy the frontend after changing `vercel.json` or the client.

- **Root Directory:** repository root (`.`; leave the field blank if Render uses the repository root by default)
- **Build Command:** `pnpm install --frozen-lockfile && pnpm run build`
- **Start Command:** `pnpm run start`

Set these Render environment variables:

- `NODE_ENV` — set to `production`
- `MONGODB_URI` — MongoDB Atlas connection string
- `MONGODB_DB` — database name (defaults to `tribull`)
- `JWT_SECRET` — at least 32 bytes of secret material
- `AUTH_COOKIE_SAME_SITE` — set to `none` for the HTTPS Vercel frontend calling the Render API
- `FRONTEND_URL` — exact allowed frontend origin(s), comma-separated if needed
- `GOOGLE_CLIENT_ID` — required for Google sign-in
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — required for password-reset email
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` — required for online checkout; use test credentials until live mode is approved
- `RAZORPAY_WEBHOOK_SECRET` — optional, required only when webhook reconciliation is configured

Set `CATEGORY_API_URL` to the Render service's HTTPS base URL (without a trailing slash) for the Vite development proxy. Keep localhost URLs out of production configuration. Vercel production requests use the checked-in `/api/*` rewrite; the Vercel project is not changed automatically.

## Admin sign-in and provisioning

`ADMIN_LOGIN_EMAIL` is an email allowlist for the dedicated email-and-password login at `/admin26`. It does not create an account, set a password, or grant an admin role. Login requires an existing customer record with a valid password hash and an active admin grant. Google login and the customer session are separate from this admin login.

To enable password login for an existing account that has no password credential:

1. Confirm the account owner and ensure password-reset email is configured for the intended environment.
2. Use the existing password-recovery flow to request an OTP for the account's registered email, verify the emailed OTP, then submit a new password before the reset authorization expires. The backend enforces an 8-to-72-byte password and stores a bcrypt hash; it adds the `password` auth provider and invalidates existing customer sessions.
3. An already-authorized active Super Admin signs in at `/admin26`, opens `/admin26/settings/admin-users`, and grants the existing customer the intended role and permissions. Only a Super Admin may grant or assign the Super Admin role. The allowlisted email alone never authorizes this action.
4. The account can then sign in at `/admin26` with that password.

If no active Super Admin exists, the Admin Users workflow must not be used to bootstrap one. An owner must follow the separately controlled initial-provisioning procedure for the intended database after verifying the account out of band. Do not use a production database for local testing. The automated admin HTTP tests use an isolated in-memory account/storage boundary and do not connect to MongoDB; interactive local testing requires an explicitly isolated development database and account. No bootstrap endpoint or production credentials are provided by this repository.

### Local Super Admin test account

The opt-in `admin:test-account` script creates or updates only the email explicitly set in `ADMIN_TEST_EMAIL`. It requires `NODE_ENV=development`, `MONGODB_DB=tribull_local`, a MongoDB URI on `127.0.0.1` or `::1`, `ADMIN_TEST_EMAIL`, `ADMIN_TEST_PASSWORD`, and a matching `ADMIN_LOGIN_EMAIL`. The URI cannot use `mongodb+srv://`, a remote host, or another database path. It uses the same bcrypt password helper and full admin permission set as the application, and increments both token versions when updating the test account to invalidate existing sessions. It never prints the password or hash. The script requires the local MongoDB Community Server; it never falls back to Atlas, staging, or production.

#### Install and check local MongoDB on Windows

Install MongoDB Community Server yourself using the official Windows installer from [MongoDB Community Server downloads](https://www.mongodb.com/try/download/community), selecting the option to install MongoDB as a Windows service. This is a system-level installation; review and approve the installer prompts yourself. Do not run the account setup until the local service is available. In PowerShell:

```powershell
Get-Service MongoDB
```

If the service is installed but stopped, start it from an Administrator PowerShell:

```powershell
Start-Service MongoDB
```

Verify the local listener before account setup:

```powershell
Test-NetConnection 127.0.0.1 -Port 27017
```

Continue only when `TcpTestSucceeded` is `True`. If `Get-Service MongoDB` reports that the service does not exist, install MongoDB Community Server first. These commands do not configure or connect to any remote database.

#### Configure and create the local account

The following PowerShell commands set process-only values and do not edit `.env.local` or production configuration. Use a unique password of at least 16 characters; enter it at the secure prompt. The setup script itself requires all listed local variables and rejects any database other than `tribull_local`.

```powershell
$cd = "D:\tribull"
Set-Location $cd
$env:NODE_ENV = "development"
$env:MONGODB_URI = "mongodb://127.0.0.1:27017"
$env:MONGODB_DB = "tribull_local"
$env:ADMIN_TEST_EMAIL = Read-Host "Local test admin email"
$env:ADMIN_LOGIN_EMAIL = $env:ADMIN_TEST_EMAIL
$securePassword = Read-Host -Prompt "Local test admin password" -AsSecureString
$env:ADMIN_TEST_PASSWORD = [System.Net.NetworkCredential]::new("", $securePassword).Password
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$secretBytes = New-Object byte[] 32
$rng.GetBytes($secretBytes)
$env:JWT_SECRET = [Convert]::ToBase64String($secretBytes)
$rng.Dispose()
[Array]::Clear($secretBytes, 0, $secretBytes.Length)
corepack pnpm run admin:test-account
Remove-Item Env:ADMIN_TEST_PASSWORD
corepack pnpm dev
```

When the dev launcher reports Vite at `http://localhost:3001`, sign in at `http://localhost:3001/admin26` with the email and password entered above. The account is stored only in the dedicated local `tribull_local` database. Keep the same PowerShell session running for the dev server; its environment supplies the local database, allowlisted email, and ephemeral JWT secret. The backend loads its environment files when it starts, but the explicit process environment set above takes precedence and ensures this workflow targets only local MongoDB.

### Hosted Atlas testing Super Admin (explicit setup only)

The existing admin login uses `POST /api/admin/auth/login`, bcrypt password verification, and the signed `tribull_admin` HttpOnly cookie. Regular admins remain in `user-credentials`. The optional testing Super Admin is stored separately in `admin-datas`; its session token identifies that source so session restoration, permission checks, and logout token invalidation use the normal admin middleware. `ADMIN_LOGIN_EMAIL` continues to allow the existing regular admin, while `ADMIN_TEST_EMAIL` independently allows the designated testing account in `admin-datas`. The test-account password is used only by the explicit setup command and is not needed in the hosted runtime environment.

The explicit Atlas setup command creates a new test account for the normalized email in `ADMIN_TEST_EMAIL` in the `tribull` database, inside collection `admin-datas`. Before writing, it checks both `user-credentials` and `admin-datas` and refuses any email already present in either collection; it will not update or overwrite an existing account. The script requires `MONGODB_DB=tribull` and an Atlas `mongodb+srv://...mongodb.net` URI; if the URI includes a database path, that path must also be `tribull`. It creates a unique case-insensitive email index if needed, stores a hash made with the existing bcrypt helper, assigns the new document the Super Admin role and full permissions, and initializes its token versions. It does not run on application startup, build, or deployment. It never drops a collection or changes other users.

If the test-account password is compromised, use the separate `admin:rotate-test-password` command. It requires the configured email to identify an existing active Super Admin in `admin-datas`, refuses if that email also exists in `user-credentials`, changes only that test account's bcrypt hash and token versions, and never creates an account. It uses the same Atlas/database validation, local env loading, and explicit email confirmation as account setup.

Do not run the Atlas setup until you have chosen a new email absent from both account collections and explicitly decided to create that exact test account in the configured Atlas database. The command requires a matching email confirmation argument and accepts only a MongoDB Atlas `mongodb+srv://...mongodb.net` URI. Use an authorized Atlas database user and verify the named database is the intended target. Do not put the password or MongoDB URI into shell history or source control.

Setup variables are `MONGODB_URI`, `MONGODB_DB`, `ADMIN_TEST_EMAIL`, and `ADMIN_TEST_PASSWORD` (12-72 UTF-8 bytes). `ADMIN_TEST_NAME` is optional. `ADMIN_LOGIN_EMAIL` remains the regular admin's allowlisted email and does not need to match `ADMIN_TEST_EMAIL`. The existing regular admin and the configured test Super Admin can each log in through `/api/admin/auth/login`; if the same email exists in both collections, login is rejected as ambiguous. After setup, configure the hosted backend with both `ADMIN_TEST_EMAIL` and the existing `ADMIN_LOGIN_EMAIL`; do not configure `ADMIN_TEST_PASSWORD` on the hosted runtime. Keep the Atlas URI, database name, and JWT secret in server-only environment settings, never frontend/Vite-prefixed variables.

After you have reviewed and chosen the exact account email and verified the Atlas cluster is the intended target, run the following intentionally from a secure PowerShell session. The script loads only `backend/.env.local` (never `backend/.env.production`); variables already set in the process environment take precedence. Set `MONGODB_DB` to `tribull`.

```powershell
$env:ADMIN_TEST_EMAIL = (Read-Host "Configured email of the existing test account in admin-datas").Trim().ToLowerInvariant()
$securePassword = Read-Host -Prompt "Unique testing Super Admin password" -AsSecureString
$env:ADMIN_TEST_PASSWORD = [System.Net.NetworkCredential]::new("", $securePassword).Password

try {
  corepack pnpm run admin:rotate-test-password -- --confirm-atlas-account-email $env:ADMIN_TEST_EMAIL
} finally {
  Remove-Item Env:ADMIN_TEST_PASSWORD -ErrorAction SilentlyContinue
  $securePassword.Dispose()
}

# Keep ADMIN_TEST_EMAIL set in this PowerShell session for the backend restart below.
```

After successful setup, ensure the hosted backend has `ADMIN_TEST_EMAIL` and the separate existing `ADMIN_LOGIN_EMAIL`, then sign in at `/admin26` using either account's own password. Tests, builds, and application startup do not perform Atlas writes.

## Razorpay Standard Checkout

Online UPI, card, and net-banking checkout uses Razorpay Standard Checkout. The backend calculates totals from current catalog records, creates the Razorpay order, persists a pending order in the existing `orders` collection, verifies the checkout callback signature with HMAC-SHA256, and confirms the provider payment's order ID, amount, currency, and status before marking it paid. The `/api/razorpay/webhook` endpoint also verifies Razorpay's `x-razorpay-signature` against the exact raw request body using `RAZORPAY_WEBHOOK_SECRET`; it reconciles authorized and captured payment events and safely acknowledges duplicate events. Configure that webhook URL and the same dedicated webhook secret in the Razorpay Dashboard to enable asynchronous status reconciliation. Only the public key ID is sent to the browser. The key secret and webhook secret must be configured on the backend only; never use a `VITE_` variable for either. Razorpay requests are rate-limited, provider errors are returned without logging credentials, and invalid signatures do not change order records.

Cash on Delivery is recorded as an order with payment status `Pending collection`; it does not mark the order paid or claim that money was collected. Existing development-only simulated checkout remains available only through its separate development route.

For local testing, obtain a Razorpay **test-mode** key pair from the Razorpay Dashboard. Since credentials were included in a chat, rotate the exposed key secret before using the integration. Do not paste keys into source files or commit them. The following commands set the values only in the current PowerShell process and start the existing local dev stack; keep that window open while testing at `http://localhost:3001/checkout`.

The backend loads `backend/.env.local` from the repository root (or `backend/.env.production`) before startup; `backend/.env.example` is documentation only and is never loaded. Put the rotated key ID and key secret in the ignored `backend/.env.local`, and set the webhook signing secret there only if webhook reconciliation is enabled. These values are read when the backend process starts, so restart the local backend after changing them. The dev launcher reuses an already-running backend and will not reload environment files until that backend is stopped and started again. Startup diagnostics report only whether each variable is present.

```powershell
Set-Location "D:\tribull"
$env:RAZORPAY_KEY_ID = Read-Host "Razorpay test key ID"
$secureRazorpaySecret = Read-Host -Prompt "Razorpay test key secret" -AsSecureString
$env:RAZORPAY_KEY_SECRET = [System.Net.NetworkCredential]::new("", $secureRazorpaySecret).Password
try {
  corepack pnpm dev
} finally {
  Remove-Item Env:RAZORPAY_KEY_ID, Env:RAZORPAY_KEY_SECRET -ErrorAction SilentlyContinue
  $secureRazorpaySecret.Dispose()
}
```

Use Razorpay's documented test payment details in the modal; do not use real card or bank details for a test key. Online payment requires the backend to be running with both server-side variables. For webhook testing, configure a webhook in the Razorpay Dashboard pointing to a publicly reachable HTTPS URL ending in `/api/razorpay/webhook`, then securely configure the matching `RAZORPAY_WEBHOOK_SECRET` on the backend. Do not expose a local backend publicly without an approved secure tunnel. The frontend does not require a public key build variable because the API returns only the configured key ID when creating the order. For deployment, configure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in the backend service's secret environment settings; this repository change does not alter Render settings or deploy anything. Configure `RAZORPAY_WEBHOOK_SECRET` only if webhook reconciliation is enabled. Rotate to live keys only through the approved deployment process.

## Customer account data

Customer addresses and wishlists are stored as additive `addresses` and `wishlist` fields in `user-datas`, keyed by the authenticated `user-credentials` MongoDB `_id` copied into the server-owned `userId` field. The collection also records creation and update timestamps; it does not contain passwords, session tokens, or payment secrets. Protected account endpoints use the existing `tribull_customer` HttpOnly session and never accept a browser-supplied customer ID:

- `GET`, `POST /api/customer/addresses`; `PATCH`, `DELETE /api/customer/addresses/:id`
- `GET /api/customer/wishlist`; `PUT`, `DELETE /api/customer/wishlist/:productId`; `POST /api/customer/wishlist/merge`
- `GET /api/customer/orders?page=1` (20 orders per page)

Authenticated checkout orders store the server-derived `customerId` in `orders` and an address/recipient snapshot in `shippingAddress`. The customer order-history endpoint filters by that ID and omits it from responses. Account order tracking refreshes while the section is open; there is no server push channel. Razorpay-captured payments are marked `Paid`, provider-reported failures are marked `Failed`, and pending/authorized and COD collection states remain distinct. Orders created before a stable customer ID was recorded are not assigned to an account by matching unverified browser-provided contact details.
