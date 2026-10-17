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
