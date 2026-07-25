# Server/API foundation

Server code lives under `src/server/**`; Vercel adapters live in root `api/**` and should stay thin.

## Boundaries

- Browser routes/components must not import Prisma, `src/server/db/client`, or `src/server/repositories/**`.
- Prisma access belongs only in `src/server/db/client.ts` and repository modules.
- Domain services receive injectable repositories so tests do not need a live database.
- Shop date logic must use an explicit shop timezone through `src/server/timezone`, never the browser timezone.

The guard in `src/server/server-boundary.test.ts` fails if browser-facing `src/**` code imports server DB/repository modules.
