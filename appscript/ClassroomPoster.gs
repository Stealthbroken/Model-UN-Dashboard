/**
 * MUN Dashboard — Apps Script Worker
 *
 * Handles these actions from the dashboard:
 *  1. action: "announce"           — Post a Google Classroom announcement,
 *                                    optionally attaching a PDF.
 *  2. action: "email"              — Send a reminder email from the school account.
 *  3. action: "createMinutesDoc"   — Create a Google Doc from the meeting-minutes
 *                                    template inside the configured shared drive
 *                                    and return its id + url.
 *
 * SETUP:
 * 1. Create a new project at https://script.google.com (sign in with the
 *    school account).
 * 2. Paste this entire file.
 * 3. In the left sidebar, click Services (+) and add:
 *      - Google Classroom API
 *      - Drive API  (advanced service — required for shared-drive file creation)
 * 4. The shared drive is now configured from the dashboard's Sec-Gen panel,
 *    not Apps Script. If the dashboard sends a sharedDriveId it is used;
 *    otherwise the doc is created in the script owner's My Drive.
 * 5. Deploy → New Deployment → Web App
 *      Execute as: Me
 *      Who has access: Anyone
 * 6. Copy the deployment URL into your dashboard's .env.local as APPS_SCRIPT_URL.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action || "announce";

    if (action === "email") return handleEmail(data);
    if (action === "createMinutesDoc") return handleCreateMinutesDoc(data);
    if (action === "updateMinutesDoc") return handleUpdateMinutesDoc(data);
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

/* ───────── Meeting Minutes Doc creation ───────── */

function handleCreateMinutesDoc(data) {
  if (!data.title || !data.date) {
    return jsonResponse({ ok: false, error: "Missing title or date" });
  }

  // Per-request shared drive id takes precedence; Script Property is kept
  // as a legacy fallback for setups that already configured it.
  var sharedDriveId = (data.sharedDriveId || "").trim();
  if (!sharedDriveId) {
    sharedDriveId = (
      (PropertiesService.getScriptProperties().getProperty("SHARED_DRIVE_ID") || "").trim()
    );
  }

  var meetingDate = new Date(data.date);
  var tz = Session.getScriptTimeZone();
  var dateLong = Utilities.formatDate(meetingDate, tz, "EEEE, MMMM d, yyyy");
  var timeStr = Utilities.formatDate(meetingDate, tz, "h:mm a");
  var docName = "MUN Minutes — " + Utilities.formatDate(meetingDate, tz, "yyyy-MM-dd") +
                " — " + data.title;

  var doc;

  // Create the Doc. If a SHARED_DRIVE_ID is configured, create it directly
  // there via the Advanced Drive service so it lives in the team drive.
  if (sharedDriveId) {
    try {
      var driveFile = Drive.Files.create(
        { name: docName, mimeType: "application/vnd.google-apps.document", parents: [sharedDriveId] },
        null,
        { supportsAllDrives: true }
      );
      doc = DocumentApp.openById(driveFile.id);
    } catch (driveErr) {
      // Fall back to root Drive if shared-drive creation fails (e.g. permissions)
      doc = DocumentApp.create(docName);
    }
  } else {
    doc = DocumentApp.create(docName);
  }

  var body = doc.getBody();
  body.clear();

  // Header
  var header = body.appendParagraph(data.title);
  header.setHeading(DocumentApp.ParagraphHeading.TITLE);

  var subtitle = body.appendParagraph(dateLong + " • " + timeStr + " • " + (data.location || ""));
  subtitle.setHeading(DocumentApp.ParagraphHeading.SUBTITLE);

  body.appendParagraph("");

  // Attendance
  body.appendParagraph("Attendance").setHeading(DocumentApp.ParagraphHeading.HEADING1);
  var execs = Array.isArray(data.executives) ? data.executives : [];
  if (execs.length === 0) {
    body.appendParagraph("(Add executives in the dashboard to populate this section.)")
      .setItalic(true);
  } else {
    var attendanceTable = body.appendTable([["Name", "Role", "Present?"]]);
    var headerRow = attendanceTable.getRow(0);
    for (var hc = 0; hc < 3; hc++) {
      headerRow.getCell(hc).editAsText().setBold(true);
    }
    for (var i = 0; i < execs.length; i++) {
      attendanceTable.appendTableRow().appendTableCell(execs[i].name || "")
        .getParentRow().appendTableCell(execs[i].role || "")
        .getParentRow().appendTableCell("☐");
    }
  }

  body.appendParagraph("");

  // Agenda
  body.appendParagraph("Agenda").setHeading(DocumentApp.ParagraphHeading.HEADING1);
  if (data.agenda) {
    var agendaLines = String(data.agenda).split(/\r?\n/);
    for (var a = 0; a < agendaLines.length; a++) {
      if (agendaLines[a].trim()) {
        body.appendListItem(agendaLines[a]).setGlyphType(DocumentApp.GlyphType.BULLET);
      }
    }
  } else {
    body.appendParagraph("(No agenda set.)").setItalic(true);
  }

  body.appendParagraph("");

  // Weekly tasks per executive
  body.appendParagraph("Weekly Tasks").setHeading(DocumentApp.ParagraphHeading.HEADING1);
  if (execs.length === 0) {
    body.appendParagraph("(No executives on roster.)").setItalic(true);
  } else {
    for (var e = 0; e < execs.length; e++) {
      var ex = execs[e];
      var label = ex.name + (ex.role ? " — " + ex.role : "");
      body.appendParagraph(label).setHeading(DocumentApp.ParagraphHeading.HEADING2);
      var tasks = Array.isArray(ex.tasks) ? ex.tasks : [];
      if (tasks.length === 0) {
        body.appendParagraph("(No tasks assigned yet.)").setItalic(true);
      } else {
        for (var t = 0; t < tasks.length; t++) {
          var prefix = tasks[t].completed ? "☑ " : "☐ ";
          body.appendListItem(prefix + tasks[t].description)
            .setGlyphType(DocumentApp.GlyphType.BULLET);
        }
      }
    }
  }

  body.appendParagraph("");

  // Discussion / Notes
  body.appendParagraph("Discussion Notes").setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph("(Take notes here during the meeting.)").setItalic(true);

  body.appendParagraph("");

  // Action Items
  body.appendParagraph("New Action Items").setHeading(DocumentApp.ParagraphHeading.HEADING1);
  var actionTable = body.appendTable([["Owner", "Action item", "Due"]]);
  var ah = actionTable.getRow(0);
  for (var ac = 0; ac < 3; ac++) ah.getCell(ac).editAsText().setBold(true);
  for (var k = 0; k < 3; k++) {
    actionTable.appendTableRow().appendTableCell("")
      .getParentRow().appendTableCell("")
      .getParentRow().appendTableCell("");
  }

  body.appendParagraph("");

  // Footer
  var footer = body.appendParagraph("Generated by MUN Dashboard on " +
    Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH:mm"));
  footer.setItalic(true).setFontSize(9);

  doc.saveAndClose();

  return jsonResponse({
    ok: true,
    docId: doc.getId(),
    docUrl: doc.getUrl()
  });
}

/* ───────── Live Minutes update ───────── */

/**
 * Rewrites just the "Weekly Tasks" section of an existing minutes Doc, leaving
 * the rest (Discussion Notes typed during the meeting, etc.) untouched.
 */
function handleUpdateMinutesDoc(data) {
  if (!data.docId) {
    return jsonResponse({ ok: false, error: "Missing docId" });
  }

  var doc;
  try {
    doc = DocumentApp.openById(data.docId);
  } catch (e) {
    return jsonResponse({ ok: false, error: "Cannot open doc: " + e });
  }

  var body = doc.getBody();
  var execs = Array.isArray(data.executives) ? data.executives : [];

  // Find the "Weekly Tasks" HEADING1 and the next HEADING1 after it.
  var startIdx = -1;
  var endIdx = -1;
  var count = body.getNumChildren();
  for (var i = 0; i < count; i++) {
    var child = body.getChild(i);
    if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
      var para = child.asParagraph();
      if (para.getHeading() === DocumentApp.ParagraphHeading.HEADING1) {
        if (startIdx === -1 && para.getText() === "Weekly Tasks") {
          startIdx = i;
        } else if (startIdx !== -1 && i > startIdx) {
          endIdx = i;
          break;
        }
      }
    }
  }

  if (startIdx === -1) {
    return jsonResponse({ ok: false, error: "Weekly Tasks section not found" });
  }
  if (endIdx === -1) endIdx = count;

  // Remove the old section (heading + body), bottom-up to keep indices stable.
  for (var j = endIdx - 1; j >= startIdx; j--) {
    body.removeChild(body.getChild(j));
  }

  // Insert the refreshed section at the same position.
  var idx = startIdx;
  body.insertParagraph(idx++, "Weekly Tasks")
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);

  if (execs.length === 0) {
    body.insertParagraph(idx++, "(No executives on roster.)")
      .setHeading(DocumentApp.ParagraphHeading.NORMAL)
      .setItalic(true);
  } else {
    for (var e = 0; e < execs.length; e++) {
      var ex = execs[e];
      var label = ex.name + (ex.role ? " — " + ex.role : "");
      body.insertParagraph(idx++, label)
        .setHeading(DocumentApp.ParagraphHeading.HEADING2);
      var tasks = Array.isArray(ex.tasks) ? ex.tasks : [];
      if (tasks.length === 0) {
        body.insertParagraph(idx++, "(No tasks assigned yet.)")
          .setHeading(DocumentApp.ParagraphHeading.NORMAL)
          .setItalic(true);
      } else {
        for (var t = 0; t < tasks.length; t++) {
          var prefix = tasks[t].completed ? "☑ " : "☐ ";
          body.insertListItem(idx++, prefix + tasks[t].description)
            .setGlyphType(DocumentApp.GlyphType.BULLET);
        }
      }
    }
  }
  body.insertParagraph(idx++, "");

  doc.saveAndClose();
  return jsonResponse({ ok: true });
}

/* ───────── Helpers ───────── */

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
