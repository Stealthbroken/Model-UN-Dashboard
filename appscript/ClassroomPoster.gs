/**
 * MUN Dashboard — Apps Script Worker
 *
 * Handles two actions from the dashboard:
 *  1. action: "announce" — Post an announcement to Google Classroom,
 *     optionally attaching a PDF (downloaded from a public URL into Drive).
 *  2. action: "email"    — Send a reminder email from the school account.
 *
 * SETUP:
 * 1. Create a new project at https://script.google.com (sign in with the
 *    school account).
 * 2. Paste this entire file.
 * 3. In the left sidebar, click Services (+) and add:
 *      - Google Classroom API
 *      - Drive API     (only needed for topic guide attachments)
 * 4. Deploy → New Deployment → Web App
 *      Execute as: Me
 *      Who has access: Anyone
 * 5. Copy the deployment URL into your dashboard's .env.local as APPS_SCRIPT_URL.
 *
 * NOTE: Attaching a topic guide requires the dashboard to be reachable from
 * Apps Script (i.e. hosted online with a public URL). On localhost, the
 * announcement will still post — just without the attachment.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // Backwards compat: old payload had no `action` field and just posted.
    var action = data.action || "announce";

    if (action === "email") {
      return handleEmail(data);
    }

    return handleAnnouncement(data);

  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

function doGet() {
  return jsonResponse({ status: "MUN Dashboard worker running" });
}

/* ───────── Announcement posting ───────── */

function handleAnnouncement(data) {
  var courseId = data.courseId;
  var body = data.body;

  if (!courseId || !body) {
    return jsonResponse({ ok: false, error: "Missing courseId or body" });
  }

  var payload = { text: body };
  var attachmentNote = "";

  // Optional: attach a topic guide
  if (data.materialUrl) {
    try {
      var response = UrlFetchApp.fetch(data.materialUrl, { muteHttpExceptions: true });
      if (response.getResponseCode() === 200) {
        var blob = response.getBlob().setName(data.materialName || "Topic Guide.pdf");
        var file = DriveApp.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        payload.materials = [{
          driveFile: {
            driveFile: { id: file.getId(), title: file.getName() },
            shareMode: "VIEW"
          }
        }];
      } else {
        attachmentNote = "(material URL unreachable: HTTP " + response.getResponseCode() + ")";
      }
    } catch (fetchErr) {
      attachmentNote = "(could not fetch material: " + fetchErr + ")";
    }
  }

  Classroom.Courses.Announcements.create(payload, courseId);
  return jsonResponse({ ok: true, attachmentNote: attachmentNote });
}

/* ───────── Email sending ───────── */

function handleEmail(data) {
  if (!data.to || !data.subject || !data.body) {
    return jsonResponse({ ok: false, error: "Missing to, subject, or body" });
  }

  MailApp.sendEmail({
    to: data.to,
    subject: data.subject,
    htmlBody: data.body
  });

  return jsonResponse({ ok: true });
}

/* ───────── Helpers ───────── */

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
