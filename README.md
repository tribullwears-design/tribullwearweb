# tribullwearweb

## Render backend deployment

The backend and its dependencies are part of this repository-root pnpm project; do not set Render's root directory to `backend/`.

Render serves the backend API only. `GET /health` is the health-check endpoint, `/api/*` serves the backend routes, and other paths return a JSON 404. The Vite storefront remains deployed separately on Vercel; the backend does not serve `dist/public`.

After pushing this change, deploy the latest commit to Render and set its health-check path to `/health`. No Vercel frontend or rewrite changes are needed; keep `CATEGORY_API_URL` pointed at the Render service and rebuild Vercel only when that value changes.

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

Set `CATEGORY_API_URL` in the Vercel project's production environment to the Render service's HTTPS base URL (without a trailing slash), then rebuild the frontend. Keep localhost URLs out of production configuration. The Vercel project is not changed automatically.

Admin API access requires an authenticated customer record with `adminRole: "admin"` in the existing `user-credentials` collection. Before deploying these backend changes, provision at least one administrator so existing operators are not locked out: verify the account owner out of band, identify the exact pre-existing customer record in Atlas, and set that single record's `adminRole` field to `"admin"`. Do not grant the role based only on a self-registered email address; customer signup does not verify email ownership and does not accept role fields. The admin must sign in through the existing storefront so its authenticated customer session cookie is available. Without an explicitly provisioned role, protected admin operations return 403.

After this initial bootstrap, active administrators with Settings edit access can grant or update admin access from `/admin26/settings/admin-users`, but only for existing customer records. Admin roles and section-level view/edit permissions are stored on those records and checked by protected backend routes. This screen does not create customer accounts, issue invitations, or expose customer credentials; the first administrator still requires out-of-band provisioning.