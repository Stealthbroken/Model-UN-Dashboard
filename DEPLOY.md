# Deploying the MUN Dashboard — free & drag-and-drop

This deploys the dashboard for **$0/month** using two free services:

| Piece | Service | Free tier |
|---|---|---|
| The app | **Render** | Free web service — connect your GitHub repo, it auto-builds & deploys |
| The database | **Neon** | Free Postgres — 0.5 GB storage, no credit card |

Neither asks for a credit card. Total setup time: **~15 minutes.**

> **Why not just drag the folder somewhere?** The app used to keep its data in
> a SQLite file and saved uploaded PDFs to disk. Free hosts wipe the disk on
> every deploy, so the code has already been changed (see below) to keep
> everything in the database instead. Now any host works.

---

## What already changed in the code

You don't need to do anything for these — they're done. Listed so you know:

- **Database:** switched from SQLite to Postgres (`prisma/schema.prisma`).
- **Uploads:** topic-guide PDFs and Instagram images are now stored *in the
  database* and served through API routes, instead of being written to disk.
  (8 MB max per file.)
- **Port:** `server.js` now binds to the host-assigned `$PORT`.
- **`render.yaml`:** a Blueprint file so Render can set the whole thing up in
  one click.

---

## Step 1 — Create the free database (Neon)

1. Go to <https://neon.tech> and sign up (the "Continue with GitHub" button is
   fastest).
2. It drops you into a **Create project** screen. Defaults are fine — give it a
   name like `mun-dashboard`, pick the region closest to you, click **Create**.
3. You'll land on a page with a **Connection string**. It looks like:

   ```
   postgresql://alex:AbC123@ep-cool-name-12345.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

4. **Turn OFF the "Connection pooling" toggle** if you see one — the plain
   ("direct") string is the most trouble-free with this app.
5. **Copy that string.** You'll paste it in two places below. Keep the tab open.

---

## Step 2 — Point your local copy at the new database

So local development keeps working after the SQLite → Postgres switch.

1. Open `.env.local` (in the project folder) and add these two lines:

   ```
   DATABASE_URL=postgresql://...paste the Neon string here...
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   ```

2. Create the tables in the new database:

   ```bash
   npx prisma db push
   ```

3. Start it up and confirm it works:

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000>, log in, click around. (Your old SQLite data
   doesn't carry over — meetings re-seed automatically; just re-add any execs.)

---

## Step 3 — Put the code on GitHub

Render deploys *from* a GitHub repo, so the code needs to be there.

If it isn't pushed yet:

```bash
git add -A
git commit -m "Prepare for Render + Neon deployment"
git push
```

The repo can be **private** — Render still connects to it.

---

## Step 4 — Deploy on Render (the drag-and-drop part)

1. Go to <https://render.com> and sign up with GitHub.
2. In the dashboard, click **New +** → **Blueprint**.
3. Pick your `mun_dash` repository. Render finds the `render.yaml` file in it
   and shows a service called **mun-dashboard**, plan **Free**.
4. Click **Apply** / **Create**. Render now asks you to fill in the environment
   variables (because `render.yaml` lists them but doesn't store secrets):

   | Variable | What to put |
   |---|---|
   | `DATABASE_URL` | The Neon connection string from Step 1 |
   | `SESSION_PASSWORD` | Your dashboard login password |
   | `SECGEN_PASSWORD` | Your Sec-Gen panel password |
   | `NEXT_PUBLIC_BASE_URL` | Leave blank for now — set in Step 5 |
   | `APPS_SCRIPT_URL` | Your Apps Script URL (or leave blank) |
   | `CLASSROOM_COURSE_ID` | Your Classroom course ID (or leave blank) |
   | `INSTAGRAM_ACCESS_TOKEN` | Leave blank unless you use Instagram auto-post |
   | `INSTAGRAM_USER_ID` | Leave blank unless you use Instagram auto-post |

5. Click **Deploy**. The first build takes 3–5 minutes (installing packages,
   creating database tables, building the app). Watch the log scroll by.

When it finishes, Render shows your live URL at the top of the page —
something like `https://mun-dashboard.onrender.com`.

---

## Step 5 — Tell the app its own URL

A couple of features (topic-guide attachments, Instagram) need to know the
app's public address.

1. In Render: your service → **Environment** (left sidebar).
2. Edit `NEXT_PUBLIC_BASE_URL` and set it to your Render URL, e.g.
   `https://mun-dashboard.onrender.com` (no trailing slash).
3. Save. Render redeploys automatically (~2 min).

---

## Step 6 — Keep it awake (recommended, free)

Render's free tier puts the app to sleep after 15 minutes of no visitors.
While asleep, the automatic announcement/reminder checks don't run. A free
uptime pinger keeps it awake:

1. Sign up at <https://uptimerobot.com> (free).
2. **Add New Monitor** → type **HTTP(s)** → URL = your Render URL →
   **Monitoring interval: 5 minutes** → Create.

That's it — the app now stays on 24/7 and scheduled announcements fire on
time. (One always-on free service fits inside Render's 750 free hours/month.)

---

## Step 7 — Final checks

- [ ] Visit your Render URL, log in with `SESSION_PASSWORD`
- [ ] Open **Sec-Gen Panel**, unlock with `SECGEN_PASSWORD`, add an executive
- [ ] Create a test meeting; refresh — it's still there (data persists ✅)
- [ ] Upload a topic guide PDF on a meeting; confirm it previews and downloads
- [ ] If you use Google Classroom: make sure `APPS_SCRIPT_URL`,
      `CLASSROOM_COURSE_ID`, and `NEXT_PUBLIC_BASE_URL` are all set so Apps
      Script can fetch attachments from your live URL

---

## Day-to-day

**To ship a change:** just `git push`. Render auto-deploys every push to
`main`. No commands, no CLI.

**To see logs:** Render dashboard → your service → **Logs**.

**To change a setting/secret:** Render dashboard → **Environment**.

---

## Cost & limits — the honest version

Everything here stays free for a school MUN dashboard:

- **Render free web service:** 750 instance-hours/month (enough for one app
  running 24/7). Sleeps after 15 min idle unless pinged (Step 6). Cold start
  is ~50 seconds.
- **Neon free Postgres:** 0.5 GB storage. Plenty for meetings, tasks, and
  execs. Uploaded PDFs/images also count toward this — at 8 MB max each,
  you'd need ~60 large files to use half of it. If it ever fills up, delete
  old topic guides or upgrade Neon (a few dollars/month).

You will **not** be charged unless you deliberately upgrade a plan.

---

## Troubleshooting

**Build fails with a database/Prisma error** — `DATABASE_URL` is wrong or
missing in Render's Environment tab. Re-copy it from Neon (no extra spaces).

**"Can't reach database server"** — make sure the Neon string ends with
`?sslmode=require`. If you see errors mentioning *prepared statements*, you
used the *pooled* connection string — switch to the direct one (Step 1.4).

**App is slow to load the first time** — that's the free-tier cold start after
sleeping. Step 6 (uptime pinger) prevents it.

**Topic guide won't attach to a Classroom post** — `NEXT_PUBLIC_BASE_URL` must
be your real Render URL (Step 5), and you must have redeployed after setting
it.

---

## If you outgrow the free tier later

The setup is standard Next.js + Postgres, so you're not locked in:

- **Render paid** ($7/mo) removes sleep and cold starts.
- **Neon paid** (a few $/mo) adds storage if PDFs pile up.
- The same repo deploys to Railway, Vercel (would need cron rework), or any
  Node host — nothing here is Render-specific except `render.yaml`.
