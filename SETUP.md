# MUN Dashboard — Setup Guide

## Quick Start

```bash
npm install
npx prisma db push
npm run dev
```

Open http://localhost:3000 and log in with the password set in `.env.local`.

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Required | Description |
|---|---|---|
| `SESSION_PASSWORD` | Yes | Password for the dashboard login |
| `APPS_SCRIPT_URL` | For Classroom | Your deployed Apps Script web app URL |
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
   - **Drive API** (required for attaching topic guides — skip if you don't need attachments)
5. Click **Deploy** > **New Deployment**
   - Type: **Web App**
   - Execute as: **Me** (your school account)
   - Who has access: **Anyone**
6. Click **Deploy** and authorize when prompted
7. Copy the **Web App URL** — paste it into `.env.local` as `APPS_SCRIPT_URL`
8. Get your **Course ID**: open Google Classroom, go to your class, the ID is in the URL: `https://classroom.google.com/c/COURSE_ID_HERE`
9. Paste the Course ID into `.env.local` as `CLASSROOM_COURSE_ID`

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
