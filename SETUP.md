# MUN Dashboard — Setup Guide

## Quick Start

The app uses **Appwrite** (Database + Storage). Create an Appwrite project
(cloud or self-hosted), then:

```bash
npm install
# put your Appwrite env vars in .env.local first
npm run appwrite:setup
npm run dev
```

Open http://localhost:3000 and log in with the password set in `.env.local`.

To put the app online for free, see **[DEPLOY.md](DEPLOY.md)**.

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Required | Description |
|---|---|---|
| `APPWRITE_ENDPOINT` | Yes | Appwrite API endpoint (cloud default is https://cloud.appwrite.io/v1) |
| `APPWRITE_PROJECT_ID` | Yes | Appwrite project ID |
| `APPWRITE_API_KEY` | Yes | Server API key with database + storage access |
| `APPWRITE_DATABASE_ID` | Optional | Appwrite database ID (default: mun_dashboard) |
| `APPWRITE_BUCKET_TOPIC_GUIDES` | Optional | Topic guide bucket ID (default: topic_guides) |
| `APPWRITE_BUCKET_INSTAGRAM_POSTS` | Optional | Instagram bucket ID (default: instagram_posts) |
| `SESSION_PASSWORD` | Yes | Signs the session cookie, and doubles as the shared team password. Sec-Gen access is granted per account, not by a password — see [Accounts & access](#accounts--access). |
| `NEXT_PUBLIC_BASE_URL` | Yes | Public URL of the app (`http://localhost:3000` locally). Account invite links are built from this, so a wrong value sends people to the wrong host. |
| `APPS_SCRIPT_URL` | For Classroom, invites, Docs | Your deployed Apps Script web app URL. Also sends account invite emails and generates topic-guide Docs. |
| `CLASSROOM_COURSE_ID` | For Classroom | The Google Classroom course ID |
| `INSTAGRAM_ACCESS_TOKEN` | For auto-post | Meta Graph API long-lived token |
| `INSTAGRAM_USER_ID` | For auto-post | Your Instagram Business account user ID |

---

## Google Classroom Setup (Apps Script)

This uses Google Apps Script so the announcement posts using your school account's OAuth — no API keys needed on the dashboard side.

### Steps

1. Go to https://script.google.com and sign in with your **school Google account**
2. Click **New Project**
3. Delete the default code and paste the contents of `appscript/ClassroomPoster.gs`
4. In the left sidebar, click **Services** (+) and add:
   - **Google Classroom API** (required for posting announcements)
   - **Drive API** (required for attaching topic guides, minutes Docs, and generated topic-guide Docs)
5. Click **Deploy** > **New Deployment**
   - Type: **Web App**
   - Execute as: **Me** (your school account)
   - Who has access: **Anyone**
6. Click **Deploy** and authorize when prompted
7. Copy the **Web App URL** — paste it into `.env.local` as `APPS_SCRIPT_URL`
8. Get your **Course ID**: open Google Classroom, go to your class, the ID is in the URL: `https://classroom.google.com/c/COURSE_ID_HERE`
9. Paste the Course ID into `.env.local` as `CLASSROOM_COURSE_ID`

### Meeting Minutes Docs (Apps Script)

When a meeting is created, the dashboard calls Apps Script to generate a templated Google Doc in your shared drive, pre-filled with date, time, location, attendance table, agenda, weekly tasks per executive, and an action-items table. A link to the doc appears on the meeting page.

To configure:

1. In the dashboard, open the **Sec-Gen Panel** (sidebar → 🔑 Sec-Gen Panel) using an account that has Sec-Gen access
2. In the **Meeting Minutes Doc** card:
   - Toggle **Use a Shared Drive** on
   - Paste your **Shared Drive ID** (the part of the URL after `drive.google.com/drive/folders/`)
3. In your Apps Script project, make sure **Drive API** (the advanced service) is enabled, then redeploy

If the toggle is off — or the shared drive ID is blank — the doc falls back to the script owner's personal Drive. If Apps Script is unreachable when a meeting is created, the meeting is still saved; you can click "Create minutes doc" on the meeting page to retry.

### How It Works

- You write an announcement in the dashboard and set a schedule time
- A background job checks every minute for due announcements
- When one is due, the dashboard sends a POST request to your Apps Script URL
- Apps Script uses your school account's permissions to create the announcement in Google Classroom
- If a topic guide has been uploaded to the meeting, Apps Script downloads it into Drive and attaches it to the announcement (requires the Drive API service to be enabled, and a publicly reachable dashboard URL — see below)

### Topic Guide Attachments

When the dashboard runs on **localhost**, Apps Script can't reach `http://localhost:3000/uploads/...` to fetch the PDF. The announcement will still post — just without the attachment. Once the dashboard is hosted with a public URL (and `NEXT_PUBLIC_BASE_URL` set in `.env.local`), attachments will work automatically.

### Reminder Emails (Missing Announcement Alerts)

If a meeting has a **Responsible person email** set in its detail page, and no announcement has been scheduled by ~18 hours before the meeting (i.e. the night before), the dashboard sends that person an email reminder via Apps Script (using `MailApp.sendEmail` from the school account). Each meeting only gets one reminder.

This uses the same Apps Script deployment — no extra setup beyond the Classroom poster.

### Topic Guide Docs (Apps Script)

Each Topic Bank entry can link to a Google Docs topic guide, either by pasting a link or by clicking **📄 Create guide doc**. Generated Docs use the same navy theme as the minutes and come pre-sectioned: The Question, Background, Current Situation, Key Questions for Debate, Bloc Positions, Points to Research, Sources, Glossary.

Generated guides land in the first of these that's set:

1. The topic-guide folder (`topicGuideFolderId` setting, or the `TOPIC_GUIDE_FOLDER_ID` script property)
2. The minutes shared drive, if **Use a Shared Drive** is on
3. The Apps Script owner's My Drive

Unlike minutes Docs, topic guides are **never re-synced** — once created the Doc belongs entirely to whoever is researching it. "Unlink" only removes the dashboard's reference; it never deletes the Doc.

If `APPS_SCRIPT_URL` isn't set, the Create button is hidden and you can still paste links by hand.

---

## Accounts & access

Everyone on the roster can be given their own login, and **Sec-Gen access is a permanent property of that account** — there's no PIN or shared password to unlock it.

### Access levels

| Level | Can do |
|---|---|
| **Member** | Meetings, tasks, topics, Instagram, stats |
| **Sec-Gen** | Everything above, plus the roster, accounts, and integration settings |
| **Owner** | Everything above, plus granting/revoking Sec-Gen and owner on other accounts |

### First-time setup

The dashboard starts *unclaimed*: no accounts exist, so nobody could create the first one. To bridge that:

1. Sign in with the shared `SESSION_PASSWORD`. While no Sec-Gen account exists this grants **owner** rights.
2. Open **🔑 Sec-Gen Panel → Accounts & access** and create your own account, choosing **Sec-Gen** or **Owner**.
3. Follow the emailed link to set your password, then sign in with it.
4. Optional but recommended: switch **Shared team password** off, so personal accounts are required.

Once at least one Sec-Gen account exists, the shared password automatically drops to **member-level** — it can never grant Sec-Gen again.

### Adding people

1. Add them to the roster in the Sec-Gen Panel (name, role, email).
2. Under **No login yet**, click **Create account**, pick a username and access level.
3. They get an email with a one-time link (valid 7 days) to choose their own password.

If the email can't send — no `APPS_SCRIPT_URL`, or no email on file — the link is shown in a toast with a **Copy link** button so you can share it over Slack instead.

### Changing or removing access

- **Grant/revoke Sec-Gen** — change the access dropdown on their row. It applies immediately, even to someone already signed in, because privileged actions re-check the database rather than trusting the session cookie.
- **Reset a password** — click **Reset password** to email a fresh setup link. Their current password keeps working until the new link is used.
- **Disable** — blocks sign-in but keeps the account.
- **Remove** — deletes the login only. The person stays on the roster with all their task history intact.

The dashboard refuses any change that would leave nobody holding Sec-Gen access, so the team can't lock itself out.

---

## Instagram Auto-Post Setup (Optional)

If you only want to use the preview feature, skip this section entirely. The preview works without any API setup.

### Prerequisites

- An Instagram **Business** or **Creator** account
- A Facebook Page linked to the Instagram account

### Steps

1. Go to https://developers.facebook.com and create a new app (type: Business)
2. Add the **Instagram Graph API** product
3. In the API settings, generate a **User Token** with these permissions:
   - `instagram_basic`
   - `instagram_content_publish`
4. Convert the short-lived token to a **long-lived token** (valid ~60 days):
   ```
   GET https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_LIVED_TOKEN
   ```
5. Get your Instagram User ID:
   ```
   GET https://graph.facebook.com/v19.0/me/accounts?access_token=LONG_LIVED_TOKEN
   ```
   Then:
   ```
   GET https://graph.facebook.com/v19.0/PAGE_ID?fields=instagram_business_account&access_token=LONG_LIVED_TOKEN
   ```
6. Paste both into `.env.local`:
   ```
   INSTAGRAM_ACCESS_TOKEN=your_long_lived_token
   INSTAGRAM_USER_ID=your_ig_user_id
   ```

### Important Notes

- The image must be publicly accessible via URL for Meta's API to fetch it. This means auto-post only works when the dashboard is hosted online (not localhost).
- Long-lived tokens expire after ~60 days. You'll need to refresh them periodically.
- For localhost testing, use the **preview + manual post** workflow instead.
