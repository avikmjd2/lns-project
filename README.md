# Voices & Speaking Styles: matched-guise survey

Participant form at `/s/hindi` (`/` redirects there). Admin panel at `/admin`.
Built to host more studies later (e.g. Bangla): create one from **Admin > Overview**, then upload its clips.

## Deploy on Vercel (free tier)
1. Push this folder to GitHub and import it in Vercel (or run `npx vercel`).
2. In the project's **Storage** tab, add **Neon Postgres** and **Blob**. This sets `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN`.
3. In **Settings > Environment Variables** add `ADMIN_PASSWORD` and `SESSION_SECRET` (random string, e.g. `openssl rand -hex 32`). Redeploy.
4. Open `/admin`, log in, click **Set up database** (creates tables and the default `hindi` study).
5. **Questions**: edit the questions participants answer (scale 1-5, 1-10 or any range, or free text; after every clip or once at the end).
6. **Recordings**: put the 8 audio-only .mp4 files in the `Recording/` folder (F1_H, F1_N, F2_H, F2_N, M1_H, M1_N, M2_H, M2_N; H = Hindi only, N = Hindi + English), deploy, then open **Admin > Recordings** and click **Sync recordings**. The page turns green when all 8 are found and registered.
   Convert phone videos to audio first: `ffmpeg -i in.mp4 -vn -c:a aac -b:a 96k out.mp4`. Keep each file under 4 MB.
7. **Overview**: set the study status to **open**, then share `https://<your-site>/s/hindi`.
8. Before real collection, test the form yourself, then **Responses > Clear all test data**.

## Local dev
`cp .env.example .env.local`, fill it in (`vercel env pull .env.local` works after linking), then `npm run dev`.

## Notes
- Each listener hears 4 clips, one per speaker. Within the female pair and within the male pair the two clips have opposite styles. Female option FA = F1_N + F2_H or FB = F1_H + F2_N; male option MA = M1_N + M2_H or MB = M1_H + M2_N. Combos: A = FA+MA, B = FA+MB, C = FB+MA, D = FB+MB. The least-filled combo (within the listener's gender) is assigned; clip order is shuffled.
- Audio is streamed from `/api/audio/<clipId>` so participants never see filenames. If a clip fails to load, the listener can still continue (its `played_pct` is saved, so you can filter such ratings out).
- The five study questions (intelligence, friendliness, sense of humor, trustworthiness, likelihood of talking to the person; all 1 to 10) replace the original default questions automatically if those are untouched and no answers exist yet. Otherwise add them in Admin > Questions.
- Questions are managed in the admin panel. Re-running **Set up database** is safe and upgrades an older schema.
- Ratings unlock after 80% of a clip has been played. Progress is saved after every clip and resumes on refresh.
- Results page: cell means, bar charts, paired/Welch t-tests and suggested verdicts for H1/H2. CSV export is one row per rating.
- All participant text is in `locales/en.ts`; add `locales/bn.ts` and register it in `locales/index.ts` for a Bangla UI.
