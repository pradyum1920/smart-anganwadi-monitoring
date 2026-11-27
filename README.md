# Smart Anganwadi Monitoring System

Responsive React and Express application for Anganwadi center operations. The worker dashboard follows the supplied mobile reference. Attendance and child growth measurements in the dashboard save through the API; other modules expose their REST endpoints for the next UI screens.

## Requirements

- Node.js 20 or newer
- MongoDB Community Server or a MongoDB Atlas connection string

## Start locally

1. Copy `.env.example` to `.env` and set `MONGODB_URI`, a long random `JWT_SECRET`, and an `ADMIN_BOOTSTRAP_KEY` of your choice.
2. Install dependencies with `npm install`.
3. In one terminal, run `npm run server`.
4. In another terminal, run `npm run dev` and open the Vite URL shown in the terminal.

Vite proxies `/api` requests to the Express server on port 5000. The API waits for MongoDB before it starts listening.

## Deploy to Vercel

The Vite frontend and Express API are both deployed from this project. Vercel serves `api/[...path].js` for `/api/*` requests and the function connects to MongoDB before handling each request. Configure these environment variables in the Vercel project for **Production** (and Preview if needed):

- `MONGODB_URI`: a MongoDB Atlas connection string reachable from Vercel
- `JWT_SECRET`: a long, random signing secret
- `ADMIN_BOOTSTRAP_KEY`: a long, one-time key for creating the first administrator
- `CLIENT_ORIGIN`: the deployed site origin, such as `https://your-project.vercel.app`

Redeploy after setting the variables. Check `/api/health` on the deployed domain; it should return `{"status":"ok","database":"connected"}`. If it reports a database error, check the Atlas network access list and the `MONGODB_URI` value. Create the first administrator using the bootstrap endpoint and `ADMIN_BOOTSTRAP_KEY`; do not use local demo credentials unless you separately seeded a production database.

## Sample dashboard data

Run `npm run seed` to add 10 sample schools, 1,700 children, 154 Anganwadi workers, 20 supervisors, and example attendance, meal, growth, and upcoming activity records. The seeder does not overwrite existing records and skips repeat runs after the sample schools have been created.

Sample worker accounts use the password `SamplePass123!`; for example, `sample.worker.1.1@anganwadi.demo`. The administrator demo sign-in is `administration` / `administration123`.

## Create the first administrator

Public registration is disabled. After the server starts, create the first admin once using PowerShell (replace the values):

```powershell
$headers = @{ 'x-bootstrap-key' = 'YOUR_ADMIN_BOOTSTRAP_KEY' }
$body = @{ name = 'System Administrator'; email = 'admin@example.org'; password = 'Use-a-long-unique-password' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/auth/bootstrap-admin -Headers $headers -ContentType 'application/json' -Body $body
```

Sign in through the app with that email and password. In the administrator sidebar, create a center first, then open **Users** to create worker and supervisor accounts and assign each account to a center. Give the new user their email and temporary password so they can sign in through the same login page.

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
