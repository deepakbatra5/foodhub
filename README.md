# Zomato Full-Stack App

This repo is prepared for a single-project Vercel deployment:

- `server.js` exports the Express backend for Vercel.
- the frontend builds into the root `public/` directory for static hosting.
- API requests default to same-origin, so the frontend and backend can share one Vercel domain.

## Local development

Install dependencies once:

```bash
npm install
```

Run the apps separately during local development:

```bash
npm --prefix backend run dev
npm --prefix frontend run dev
```

## Vercel deployment

1. Import the repository into Vercel as one project.
2. Keep the project root at the repository root.
3. Add these environment variables in Vercel:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `ALLOWED_ORIGINS`
   - `OPENAI_API_KEY` (optional)
   - `SEED_SAMPLE_DATA=true` (optional)
   - `DB_SYNC_ALTER=false`
   - `DB_SYNC_FORCE=false`
4. Deploy.

Recommended values:

- `ALLOWED_ORIGINS=https://your-project.vercel.app`
- `SEED_SAMPLE_DATA=true` for the first deployment if you want the sample restaurant catalog loaded automatically.

## Production notes

- Use a managed PostgreSQL database such as Vercel Postgres, Neon, Supabase, or RDS and set its connection string as `DATABASE_URL`.
- `sequelize.sync()` is still used to create the current schema automatically, but destructive sync options are disabled by default.
- The frontend can still target a separate backend by setting `VITE_API_BASE`, but it is no longer required for Vercel.
