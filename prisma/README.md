## Local Prisma workflow

Run the database, apply migrations, then seed the local admin:

```bash
npm run db:up
npm run db:migrate
npm run seed:admin
```

The seed is idempotent. It upserts the `SEED_SHOP_SLUG` shop and the
`SEED_ADMIN_EMAIL` owner user, so rerunning it will not duplicate records.

Local reset/rollback:

```bash
docker compose down -v
```

Seed variables live in `.env.example`; `.env` may contain dev-only values.
