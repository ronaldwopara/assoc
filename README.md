# assoc

## Production (Vercel)

The Operations dashboard reads Google Sheets via OAuth refresh tokens stored in Cloudinary. See [`.env.example`](.env.example) for the full Production env checklist.

**Common live error:** `GOOGLE_MASTER_SHEET_ID is not configured` — set sheet IDs and other Google/Cloudinary vars on Vercel, redeploy, then connect Google once at `/api/google/connect` while signed into `/upgrade`.
