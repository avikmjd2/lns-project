# Voices & Speaking Styles: matched-guise survey

Participant form at `/s/hindi` (`/` redirects there). Admin panel at `/admin`.
Built to host more studies later (e.g. Bangla): create one from **Admin > Overview**, then upload its clips.

## Deploy on Vercel (free tier)
1. Push this folder to GitHub and import it in Vercel (or run `npx vercel`).
2. In the project's **Storage** tab, add **Neon Postgres** and **Blob**. This sets `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN`.
3. In **Settings > Environment Variables** add `ADMIN_PASSWORD` and `SESSION_SECRET` (random string, e.g. `openssl rand -hex 32`). Redeploy.
4. Open `/admin`, log in, click **Set up database** (creates tables and the default `hindi` study).
5. **Recordings**: upload the 8 clips. Form A = M1 mixed, M2 pure, F1 mixed, F2 pure. Form B = the opposite guises.
   The checklist turns green when both forms are complete.
6. **Overview**: set the study status to **open**, then share `https://<your-site>/s/hindi`.
7. Before real collection, test the form yourself, then **Responses > Clear all test data**.

## Local dev
`cp .env.example .env.local`, fill it in (`vercel env pull .env.local` works after linking), then `npm run dev`.

## Notes
- Listener form is auto-assigned per listener gender so Form A/B stay balanced; clip order is shuffled.
- Ratings unlock after 80% of a clip has been played. Progress is saved after every clip and resumes on refresh.
- Results page: cell means, bar charts, paired/Welch t-tests and suggested verdicts for H1/H2. CSV export is one row per rating.
- All participant text is in `locales/en.ts`; add `locales/bn.ts` and register it in `locales/index.ts` for a Bangla UI.
