# Smart Anganwadi Monitoring System

Responsive React and Express application for Anganwadi center operations. The worker dashboard follows the supplied mobile reference. Attendance and child growth measurements in the dashboard save through the API; other modules expose their REST endpoints for the next UI screens.

## Project folders

- `frontend/` contains the React/Vite app and static assets.
- `backend/` contains the Express API.
- `database/` contains the PostgreSQL-backed data models and sample data seeder.
- `supabase/migrations/` contains the database schema managed by the Supabase CLI.
- `api/` contains the Vercel function entry point that forwards `/api/*` requests to Express.

## Requirements

- Node.js 20 or newer
- Docker Desktop (for the local Supabase stack)
- A Supabase project, or the local Supabase stack started by the CLI

## Start locally

1. Set `SUPABASE_DB_URL` in `.env`. The checked-in local value connects to the local Supabase database; for a hosted database, copy a connection string from **Supabase Dashboard → Connect**. For Vercel, use the transaction pooler connection string. See [Supabase connection options](https://supabase.com/docs/guides/database/connecting-to-postgres).
2. Install dependencies with `npm install`.
3. Start the local Supabase stack with `npm run supabase:start`, then apply the local migrations with `npm run supabase:migrate`.
4. In one terminal, run `npm run server`.
5. In another terminal, run `npm run dev` and open the Vite URL shown in the terminal.

Vite proxies `/api` requests to the Express server on port 5000. The API waits for Supabase Postgres before it starts listening. The local Supabase CLI stack requires Docker. Run `npm run supabase:stop` when you want to stop it.

## Deploy to Vercel

The Vite frontend and Express API are both deployed from this project. Vercel serves `api/[...path].js` for `/api/*` requests and the function connects to Supabase Postgres before handling each request. Configure these environment variables in the Vercel project for **Production** (and Preview if needed):

- `SUPABASE_DB_URL`: the Supabase transaction pooler connection string for serverless functions
- `JWT_SECRET`: a long, random signing secret
- `ADMIN_BOOTSTRAP_KEY`: a long, one-time key for creating the first administrator
- `CLIENT_ORIGIN`: the deployed site origin, such as `https://your-project.vercel.app`

Redeploy after setting the variables. Check `/api/health` on the deployed domain; it should return `{"status":"ok","database":"connected"}`. If it reports a database error, check the Supabase connection string and database password. Apply pending migrations to the hosted project with `npx supabase link` followed by `npx supabase db push --remote`. Create the first administrator using the bootstrap endpoint and `ADMIN_BOOTSTRAP_KEY`; do not use local demo credentials unless you separately seeded a production database.

## Deploy to Render

Create a **Web Service** from this repository with the root directory left blank. Set the build command to `npm install && npm run build` and the start command to `npm start`. Add `SUPABASE_DB_URL`, `JWT_SECRET`, and `ADMIN_BOOTSTRAP_KEY` as Render environment variables. The Express service serves the built frontend and API from the same Render URL.

## Sample dashboard data

Run `npm run seed` to add sample schools, children, Anganwadi workers, supervisors, and example attendance, meal, growth, and upcoming activity records. The seeder does not overwrite existing records and skips repeat runs after the sample schools have been created.

Sample worker accounts use the password `SamplePass123!`; for example, `sample.worker.1.1@anganwadi.demo`. The administrator demo sign-in is `administration` / `administration123`.

## Create the first administrator

Public registration is disabled. After the server starts, create the first admin once using PowerShell (replace the values):

```powershell
$headers = @{ 'x-bootstrap-key' = 'YOUR_ADMIN_BOOTSTRAP_KEY' }
$body = @{ name = 'System Administrator'; email = 'admin@example.org'; password = 'Use-a-long-unique-password' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/auth/bootstrap-admin -Headers $headers -ContentType 'application/json' -Body $body
```

Sign in through the app with that email and password. In the administrator sidebar, create a center first, then open **Users** to create worker and supervisor accounts and assign each account to a center. Give each user their email and temporary password so they can sign in through the same login page.

## API overview

All endpoints except health, login, and the gated first-admin bootstrap require `Authorization: Bearer <token>`.

- `POST /api/auth/login`, `GET /api/auth/me`
- `GET|POST|PATCH|DELETE /api/centers` (write access: admin)
- `GET|POST|PATCH|DELETE /api/users` (write access: admin)
- `GET|POST|PATCH|DELETE /api/children`
- `GET|PUT /api/attendance` (`PUT` creates or replaces a center's date record)
- `GET|POST|DELETE /api/meals`
- `GET|POST|DELETE /api/growth`
- `GET|POST|DELETE /api/activities`
- `GET|POST|DELETE /api/operations`
- `GET /api/dashboard`, `GET /api/health`

Workers are limited to assigned centers. Supervisors can read records for assigned centers. Administrator endpoints manage centers and users. Passwords are hashed, sessions use expiring JWTs, and the API validates roles and center access.
