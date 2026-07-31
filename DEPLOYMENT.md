# Production deployment: Vercel frontend + Railway API

Deploy Clipper as two services: Vercel serves the Vite app, Railway serves the Node API and PostgreSQL.

## Happy path

### Railway: API + PostgreSQL

1. Create a Railway project from `https://github.com/Joseuno23/clipper`.
2. Add a PostgreSQL database in the same Railway project.
3. Configure the API service:

| Setting           | Value                   |
| ----------------- | ----------------------- |
| Build command     | `npm run railway:build` |
| Start command     | `npm run railway:start` |
| Health check path | `/api/health`           |

`npm run railway:start` runs `prisma migrate deploy` before starting the API. This is required for fresh Railway PostgreSQL databases so the schema exists before the server accepts traffic.

4. Set Railway variables:

| Variable               | Value                                                                 |
| ---------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`         | Railway PostgreSQL connection string                                  |
| `JWT_SECRET`           | Unique 32+ character secret                                           |
| `JWT_ISSUER`           | `clipper` unless intentionally changed                                |
| `JWT_AUDIENCE`         | `clipper-web` unless intentionally changed                            |
| `JWT_ACCESS_TOKEN_TTL` | Example: `2h`                                                         |
| `CORS_ORIGIN`          | Your Vercel frontend origin, for example `https://clipper.vercel.app` |

### Vercel: frontend

1. Import the same GitHub repo in Vercel.
2. Keep the default Vite build command: `npm run build`.
3. Keep `.vercelignore` committed so Vercel ignores the root `api/` handlers. The API runs on Railway, not Vercel Functions.
4. Set Vercel variables:

| Variable            | Value                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | Railway API public URL, without a trailing `/api`, for example `https://clipper-api.up.railway.app` |
| `DATABASE_URL`      | Required only because the current frontend build runs Prisma generate                               |

## Local development stays unchanged

Use the existing single-process workflow:

```bash
npm run dev
```

`vite dev` still mounts `/api/*` locally through the same Vercel-style handlers.

To run the Railway-style API locally as a separate process:

```bash
npm run dev:api
```

Then set `VITE_API_BASE_URL=http://localhost:3001` only if you want the Vite frontend to call that separate API process instead of the built-in local Vite API adapter.

## Notes

- `VITE_API_BASE_URL` must be an origin only, not a full route. Use `https://host`, not `https://host/api`.
- `CORS_ORIGIN` accepts comma-separated origins for preview/staging frontends.
- `npm run db:migrate:deploy` is the production-safe migration command. It applies committed Prisma migrations and does not create new migrations.
- The Railway server reuses the existing `api/**` Vercel handlers; business logic stays in `src/server/**`.
