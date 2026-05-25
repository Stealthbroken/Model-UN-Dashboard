# Deploying the MUN Dashboard - free and drag-and-drop

This deploys the dashboard for $0/month using two free services:

| Piece | Service | Free tier |
|---|---|---|
| The app | Render | Free web service - connect your GitHub repo, auto-builds and deploys |
| Database + storage | Appwrite Cloud | Free tier (check current limits on Appwrite pricing) |

If you already have Appwrite self-hosted, you can use that instead.

---

## What already changed in the code

You do not need to do anything for these - they are already done:

- Database + storage: moved to Appwrite (Database + Storage)
- Uploads: topic guides and Instagram images live in Appwrite Storage and are streamed via API routes
- Port: server.js binds to the host-assigned $PORT
- render.yaml: blueprint file so Render can set everything up in one click

---

## Step 1 - Create an Appwrite project

1. Go to https://cloud.appwrite.io and create a project.
2. Copy the project ID and note the API endpoint (cloud default is https://cloud.appwrite.io/v1).
3. Create an API key with these scopes (needed for setup):
   - databases.read, databases.write
   - collections.read, collections.write
   - attributes.read, attributes.write
   - indexes.read, indexes.write
   - buckets.read, buckets.write
   - files.read, files.write

You can reuse this key in production or create a smaller runtime-only key later.

---

## Step 2 - Provision the database and buckets

On your local machine:

1. Copy .env.example to .env.local and set the Appwrite variables:

   APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
   APPWRITE_PROJECT_ID=...
   APPWRITE_API_KEY=...
   APPWRITE_DATABASE_ID=mun_dashboard
   APPWRITE_BUCKET_TOPIC_GUIDES=6a108eda0039e358222e
   APPWRITE_BUCKET_INSTAGRAM_POSTS=6a108eea00263c9cc230

2. Run the setup script once:

   npm run appwrite:setup

This creates the database, collections, indexes, and storage buckets.

---

## Step 3 - Put the code on GitHub

Render deploys from GitHub, so the repo needs to be there.

If it is not pushed yet:

git add -A

git commit -m "Prepare for Render deployment"

git push

---

## Step 4 - Deploy on Render (the drag-and-drop part)

1. Go to https://render.com and sign up with GitHub.
2. In the dashboard, click New + -> Blueprint.
3. Pick your mun_dash repository. Render finds render.yaml and shows a service called mun-dashboard.
4. Click Apply / Create. Render will ask for environment variables:

   - APPWRITE_ENDPOINT
   - APPWRITE_PROJECT_ID
   - APPWRITE_API_KEY
   - APPWRITE_DATABASE_ID
   - APPWRITE_BUCKET_TOPIC_GUIDES
   - APPWRITE_BUCKET_INSTAGRAM_POSTS
   - SESSION_PASSWORD
   - SECGEN_PASSWORD
   - NEXT_PUBLIC_BASE_URL (leave blank for now, set in Step 5)
   - APPS_SCRIPT_URL
   - CLASSROOM_COURSE_ID
   - INSTAGRAM_ACCESS_TOKEN
   - INSTAGRAM_USER_ID

5. Click Deploy. The first build takes a few minutes.

When it finishes, Render shows your live URL at the top of the page.

---

## Step 5 - Tell the app its own URL

Some features (topic guide attachments, Instagram) need the public URL.

1. Render -> your service -> Environment.
2. Set NEXT_PUBLIC_BASE_URL to your Render URL, for example:
   https://mun-dashboard.onrender.com
3. Save. Render redeploys automatically.

---

## Step 6 - Keep it awake (recommended, free)

Render free tier sleeps after 15 minutes of no traffic. While asleep, the
scheduled announcement and reminder checks do not run. A free uptime pinger
keeps it awake:

1. Sign up at https://uptimerobot.com (free).
2. Add New Monitor -> type HTTP(s) -> URL = your Render URL -> interval 5 min.

---

## Step 7 - Final checks

- Visit your Render URL and log in with SESSION_PASSWORD
- Open the Sec-Gen Panel and unlock with SECGEN_PASSWORD
- Create a test meeting; refresh and confirm it persists
- Upload a topic guide PDF and confirm it previews/downloads
- If you use Google Classroom: set APPS_SCRIPT_URL, CLASSROOM_COURSE_ID, and NEXT_PUBLIC_BASE_URL

---

## Troubleshooting

Build fails with an Appwrite error
- Check APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, and APPWRITE_API_KEY.
- Make sure the API key has database + storage permissions.
- Re-run npm run appwrite:setup if collections are missing.

Topic guide will not attach to a Classroom post
- NEXT_PUBLIC_BASE_URL must be your real Render URL, and the service must be deployed.

---

## Cost and limits

- Render free web service has sleep/cold starts unless you keep it awake.
- Appwrite Cloud has a free tier with limits. Check the current Appwrite pricing page for details.

You will not be charged unless you deliberately upgrade a plan.
