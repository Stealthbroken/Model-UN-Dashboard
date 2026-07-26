/**
 * MUN Dashboard — Apps Script Worker
 *
 * Handles these actions from the dashboard:
 *  1. action: "announce"          — Post a Google Classroom announcement.
 *  2. action: "email"             — Send an email from the school account.
 *  3. action: "createMinutesDoc"  — Create a themed meeting-minutes Google Doc.
 *  4. action: "updateMinutesDoc"  — Re-sync the managed region of a minutes Doc
 *                                   (header, attendance, agenda, tasks) while
 *                                   leaving the human-written notes untouched.
 *  5. action: "createTopicGuideDoc" — Create a pre-formatted topic guide Doc
 *                                   for a Topic Bank entry (background, key
 *                                   questions, bloc positions, sources).
 *
 * SETUP:
 * 1. Create a new project at https://script.google.com (school account).
 * 2. Paste this entire file.
 * 3. Services (+): add Google Classroom API and Drive API (advanced service).
 * 4. The shared drive is configured from the dashboard's Sec-Gen panel.
 * 5. Deploy → New Deployment → Web App (Execute as: Me, Access: Anyone).
 * 6. Copy the deployment URL into the dashboard's APPS_SCRIPT_URL.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action || "announce";

    if (action === "email") return handleEmail(data);
    if (action === "createMinutesDoc") return handleCreateMinutesDoc(data);
    if (action === "updateMinutesDoc") return handleUpdateMinutesDoc(data);
    if (action === "createTopicGuideDoc") return handleCreateTopicGuideDoc(data);
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

/* ═════════════════ Meeting Minutes Doc ═════════════════ */

// Theme palette
var MIN_ACCENT = "#1e3a8a";       // navy — title, headings, table headers
var MIN_ACCENT_SOFT = "#eef2ff";  // pale indigo — zebra striping
var MIN_MUTED = "#6b7280";        // gray — subtitles / meta
var MIN_BORDER = "#d1d5db";       // light gray — table borders
var MIN_PRESENT = "#15803d";      // green — present
var MIN_ABSENT = "#9ca3af";       // gray — absent / completed
var MIN_BODY = "#111827";         // near-black — body text
// Heading text that marks the boundary between the auto-synced region and the
// human-written region. Everything ABOVE this is rebuilt on every sync.
var MIN_BOUNDARY = "Discussion Notes";

function handleCreateMinutesDoc(data) {
  if (!data.title || !data.date) {
    return jsonResponse({ ok: false, error: "Missing title or date" });
  }

  var sharedDriveId = (data.sharedDriveId || "").trim();
  if (!sharedDriveId) {
    sharedDriveId = (
      PropertiesService.getScriptProperties().getProperty("SHARED_DRIVE_ID") || ""
    ).trim();
  }

  var tz = Session.getScriptTimeZone();
  // Doc title: day-first date, then the meeting title.
  var docName =
    Utilities.formatDate(new Date(data.date), tz, "dd/MM/yyyy") + " — " + data.title;

  var doc;
  if (sharedDriveId) {
    try {
      var driveFile = Drive.Files.create(
        { name: docName, mimeType: "application/vnd.google-apps.document", parents: [sharedDriveId] },
        null,
        { supportsAllDrives: true }
      );
      doc = DocumentApp.openById(driveFile.id);
    } catch (driveErr) {
      doc = DocumentApp.create(docName);
    }
  } else {
    doc = DocumentApp.create(docName);
  }

  var body = doc.getBody();
  body.clear();
  applyMinutesTheme(body);

  var idx = insertManagedSections(body, 0, data);
  insertHumanRegion(body, idx);

  doc.saveAndClose();
  return jsonResponse({ ok: true, docId: doc.getId(), docUrl: doc.getUrl() });
}

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
  applyMinutesTheme(body);

  // Find the "Discussion Notes" heading — the start of the human-owned region.
  var boundary = -1;
  var count = body.getNumChildren();
  for (var i = 0; i < count; i++) {
    var child = body.getChild(i);
    if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
      var para = child.asParagraph();
      if (para.getHeading() === DocumentApp.ParagraphHeading.HEADING1 &&
          para.getText() === MIN_BOUNDARY) {
        boundary = i;
        break;
      }
    }
  }

  if (boundary === -1) {
    // Unknown / legacy layout — rebuild the whole document.
    body.clear();
    applyMinutesTheme(body);
    var ni = insertManagedSections(body, 0, data);
    insertHumanRegion(body, ni);
  } else {
    // Replace only the managed region [0, boundary); keep the rest verbatim.
    for (var j = boundary - 1; j >= 0; j--) {
      body.removeChild(body.getChild(j));
    }
    insertManagedSections(body, 0, data);
  }

  doc.saveAndClose();
  return jsonResponse({ ok: true });
}

/* Consistent heading styling applied to the whole doc. */
function applyMinutesTheme(body) {
  body.setHeadingAttributes(
    DocumentApp.ParagraphHeading.TITLE,
    headingAttrs(MIN_ACCENT, 22, true, 0, 2)
  );
  body.setHeadingAttributes(
    DocumentApp.ParagraphHeading.SUBTITLE,
    headingAttrs(MIN_MUTED, 13, false, 0, 6)
  );
  body.setHeadingAttributes(
    DocumentApp.ParagraphHeading.HEADING1,
    headingAttrs(MIN_ACCENT, 13, true, 16, 4)
  );
  body.setHeadingAttributes(
    DocumentApp.ParagraphHeading.HEADING2,
    headingAttrs("#374151", 11, true, 10, 2)
  );
}

function headingAttrs(color, size, bold, before, after) {
  var a = {};
  a[DocumentApp.Attribute.FOREGROUND_COLOR] = color;
  a[DocumentApp.Attribute.FONT_SIZE] = size;
  a[DocumentApp.Attribute.BOLD] = bold;
  a[DocumentApp.Attribute.SPACING_BEFORE] = before;
  a[DocumentApp.Attribute.SPACING_AFTER] = after;
  return a;
}

/* Inserts the auto-synced region at startIndex; returns the next free index. */
function insertManagedSections(body, startIndex, data) {
  var tz = Session.getScriptTimeZone();
  var idx = startIndex;
  var execs = Array.isArray(data.executives) ? data.executives : [];
  var meetingDate = new Date(data.date);

  // ── Header ──
  body.insertParagraph(idx++, "Meeting Minutes")
    .setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.insertParagraph(idx++, data.title || "MUN Meeting")
    .setHeading(DocumentApp.ParagraphHeading.SUBTITLE);

  var metaLine =
    Utilities.formatDate(meetingDate, tz, "EEEE  dd/MM/yyyy") + "      " +
    Utilities.formatDate(meetingDate, tz, "h:mm a") + "      " +
    (data.location || "—");
  mutedLine(body, idx++, metaLine, 10, false);

  mutedLine(
    body, idx++,
    "Auto-synced from the MUN Dashboard · last updated " +
      Utilities.formatDate(new Date(), tz, "dd/MM/yyyy 'at' h:mm a"),
    8, true
  );

  body.insertHorizontalRule(idx++);

  // ── Attendance ──
  body.insertParagraph(idx++, "Attendance")
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);

  if (execs.length === 0) {
    mutedLine(body, idx++, "No executives on the roster yet.", 10, true);
  } else {
    var rows = [["Name", "Role", "Status"]];
    var presentCount = 0;
    for (var i = 0; i < execs.length; i++) {
      var present = !!execs[i].present;
      if (present) presentCount++;
      rows.push([
        execs[i].name || "",
        execs[i].role || "—",
        present ? "Present" : "Absent"
      ]);
    }
    var attTable = body.insertTable(idx++, rows);
    styleTable(attTable);
    for (var r = 1; r < attTable.getNumRows(); r++) {
      var statusCell = attTable.getRow(r).getCell(2);
      var isPresent = statusCell.getText() === "Present";
      statusCell.editAsText()
        .setForegroundColor(isPresent ? MIN_PRESENT : MIN_ABSENT)
        .setBold(true);
    }
    mutedLine(body, idx++,
      presentCount + " of " + execs.length + " executives present", 9, true);
  }

  // ── Agenda ──
  body.insertParagraph(idx++, "Agenda")
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  if (data.agenda && String(data.agenda).trim()) {
    var lines = String(data.agenda).split(/\r?\n/);
    for (var a = 0; a < lines.length; a++) {
      if (lines[a].trim()) {
        body.insertListItem(idx++, lines[a].trim())
          .setGlyphType(DocumentApp.GlyphType.BULLET);
      }
    }
  } else {
    mutedLine(body, idx++, "No agenda set.", 10, true);
  }

  // ── Weekly Tasks ──
  body.insertParagraph(idx++, "Weekly Tasks")
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  if (execs.length === 0) {
    mutedLine(body, idx++, "No executives on the roster yet.", 10, true);
  } else {
    for (var e = 0; e < execs.length; e++) {
      var ex = execs[e];
      body.insertParagraph(idx++, ex.name + (ex.role ? "      " + ex.role : ""))
        .setHeading(DocumentApp.ParagraphHeading.HEADING2);
      var tasks = Array.isArray(ex.tasks) ? ex.tasks : [];
      if (tasks.length === 0) {
        mutedLine(body, idx++, "No tasks assigned.", 10, true);
      } else {
        var done = 0;
        for (var c = 0; c < tasks.length; c++) if (tasks[c].completed) done++;
        mutedLine(body, idx++, done + " of " + tasks.length + " complete", 8, false);
        for (var t = 0; t < tasks.length; t++) {
          idx = insertTaskLine(body, idx, tasks[t], tz);
        }
      }
    }
  }

  body.insertHorizontalRule(idx++);
  return idx;
}

/* One task: a checkbox bullet with priority / label / due date; struck out if done. */
function insertTaskLine(body, idx, task, tz) {
  var box = task.completed ? "☑  " : "☐  ";
  var extras = [];
  if (task.priority === "high") extras.push("High priority");
  if (task.label) extras.push(task.label);
  if (task.dueDate) {
    extras.push("due " + Utilities.formatDate(new Date(task.dueDate), tz, "dd/MM"));
  }
  var suffix = extras.length ? "      (" + extras.join("  ·  ") + ")" : "";

  var li = body.insertListItem(idx++, box + task.description + suffix);
  li.setGlyphType(DocumentApp.GlyphType.BULLET);
  var text = li.editAsText();
  text.setFontSize(10);
  if (task.completed) {
    text.setStrikethrough(true).setForegroundColor(MIN_ABSENT);
  } else {
    text.setForegroundColor(MIN_BODY);
  }
  return idx;
}

/* The human-owned region — created once, never overwritten by a sync. */
function insertHumanRegion(body, startIndex) {
  var idx = startIndex;

  body.insertParagraph(idx++, MIN_BOUNDARY)
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  mutedLine(
    body, idx++,
    "Type the meeting discussion here — this section is yours and is never " +
      "overwritten by the dashboard.",
    10, true
  );
  body.insertParagraph(idx++, "");

  body.insertParagraph(idx++, "Action Items")
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  var rows = [["Owner", "Action item", "Due"]];
  for (var k = 0; k < 4; k++) rows.push(["", "", ""]);
  styleTable(body.insertTable(idx++, rows));

  return idx;
}

/* A small muted (gray) helper paragraph. */
function mutedLine(body, idx, textValue, size, italic) {
  var p = body.insertParagraph(idx, textValue);
  p.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  p.editAsText()
    .setForegroundColor(MIN_MUTED)
    .setFontSize(size)
    .setBold(false)
    .setItalic(!!italic);
  return p;
}

/* Navy header row, padded cells, zebra striping, hairline borders. */
function styleTable(table) {
  table.setBorderColor(MIN_BORDER);
  table.setBorderWidth(0.5);

  var header = table.getRow(0);
  for (var c = 0; c < header.getNumCells(); c++) {
    var hc = header.getCell(c);
    hc.setBackgroundColor(MIN_ACCENT);
    hc.setPaddingTop(5).setPaddingBottom(5).setPaddingLeft(8).setPaddingRight(8);
    hc.editAsText().setForegroundColor("#ffffff").setBold(true)
      .setFontSize(10).setItalic(false);
  }

  for (var r = 1; r < table.getNumRows(); r++) {
    var row = table.getRow(r);
    for (var rc = 0; rc < row.getNumCells(); rc++) {
      var cell = row.getCell(rc);
      cell.setPaddingTop(4).setPaddingBottom(4).setPaddingLeft(8).setPaddingRight(8);
      cell.editAsText().setFontSize(10).setBold(false).setItalic(false)
        .setForegroundColor(MIN_BODY);
      if (r % 2 === 0) cell.setBackgroundColor(MIN_ACCENT_SOFT);
      else cell.setBackgroundColor("#ffffff");
    }
  }
}

/* ═════════════════ Topic Guide Doc ═════════════════ */

/**
 * Creates a research-ready topic guide Doc for a Topic Bank entry.
 *
 * Deliberately avoids DocumentApp. Drive converts an uploaded HTML file into a
 * native Google Doc, so this needs only the Drive scope — the same one the
 * Classroom attachment path already uses. The earlier DocumentApp version
 * required https://www.googleapis.com/auth/documents on top of that, and when
 * that scope isn't granted it fails *after* the empty file exists, leaving an
 * orphan behind. One Drive call either fully succeeds or creates nothing.
 *
 * The dashboard never re-syncs this Doc, so a create-only path loses nothing:
 * once it exists it belongs to whoever is researching the topic.
 *
 * Expects: { title, description, category, difficulty, notes, folderId }
 */
function handleCreateTopicGuideDoc(data) {
  if (!data.title) {
    return jsonResponse({ ok: false, error: "Missing title" });
  }

  var folderId = (data.folderId || "").trim();
  if (!folderId) {
    folderId = (
      PropertiesService.getScriptProperties().getProperty("TOPIC_GUIDE_FOLDER_ID") || ""
    ).trim();
  }

  var docName = "Topic Guide — " + data.title;
  var blob = Utilities.newBlob(buildTopicGuideHtml(data), "text/html", docName + ".html");
  var note = "";

  var file;
  try {
    file = createConvertedDoc(docName, blob, folderId);
  } catch (err) {
    // A bad/inaccessible folder id shouldn't cost the whole guide — retry in
    // the script owner's My Drive and tell the dashboard where it landed.
    if (folderId) {
      try {
        file = createConvertedDoc(docName, blob, "");
        note = "Couldn't write to the configured folder, so the guide was created in My Drive instead.";
      } catch (fallbackErr) {
        return jsonResponse({ ok: false, error: String(fallbackErr) });
      }
    } else {
      return jsonResponse({ ok: false, error: String(err) });
    }
  }

  return jsonResponse({
    ok: true,
    docId: file.id,
    docUrl: file.webViewLink || "https://docs.google.com/document/d/" + file.id + "/edit",
    note: note
  });
}

/* Uploads an HTML blob and asks Drive to store it as a native Google Doc. */
function createConvertedDoc(docName, blob, folderId) {
  var resource = { name: docName, mimeType: "application/vnd.google-apps.document" };
  if (folderId) resource.parents = [folderId];
  return Drive.Files.create(resource, blob, {
    supportsAllDrives: true,
    fields: "id,webViewLink"
  });
}

/**
 * The guide skeleton as HTML. Drive's converter honours headings, lists, bold,
 * italics and inline colours, which covers everything the DocumentApp version
 * styled by hand. Prompts are grey italics so typed-over text reads normally.
 */
function buildTopicGuideHtml(data) {
  var tz = Session.getScriptTimeZone();
  var h = [];

  h.push('<meta charset="utf-8">');
  h.push('<h1 style="color:' + MIN_ACCENT + '">Topic Guide</h1>');
  h.push('<h2 style="color:' + MIN_MUTED + ';font-weight:normal">' + esc(data.title) + '</h2>');

  var meta = [];
  if (data.category) meta.push(esc(data.category));
  if (data.difficulty) meta.push(esc(titleCase(data.difficulty)) + " level");
  meta.push("Created " + Utilities.formatDate(new Date(), tz, "dd/MM/yyyy"));
  h.push('<p style="color:' + MIN_MUTED + ';font-size:10pt">' + meta.join(" &nbsp;·&nbsp; ") + "</p>");
  h.push("<hr>");

  if (data.description && String(data.description).trim()) {
    h.push('<h2 style="color:' + MIN_ACCENT + '">The Question</h2>');
    h.push("<p>" + esc(String(data.description).trim()) + "</p>");
  }
  if (data.notes && String(data.notes).trim()) {
    h.push('<h2 style="color:' + MIN_ACCENT + '">Chair Notes</h2>');
    h.push('<p style="color:' + MIN_MUTED + '"><i>' + esc(String(data.notes).trim()) + "</i></p>");
  }

  var sections = [
    ["Background", [
      "How did this issue arise? Give delegates the 5-minute version.",
      "Key dates and turning points.",
      "Which bodies or treaties already govern it?"
    ]],
    ["Current Situation", [
      "What is the state of play right now?",
      "What has been tried, and why hasn't it settled the matter?"
    ]],
    ["Key Questions for Debate", ["", "", ""]],
    ["Bloc Positions", [
      "Bloc / country — position, motivation, red lines.",
      "", ""
    ]],
    ["Points to Research", [
      "Statistics or precedents worth having on hand.",
      "Likely counter-arguments to prepare for."
    ]],
    ["Sources", ["Link — one line on why it's useful.", ""]],
    ["Glossary", ["Term — plain-English definition."]]
  ];

  for (var i = 0; i < sections.length; i++) {
    h.push('<h2 style="color:' + MIN_ACCENT + '">' + sections[i][0] + "</h2>");
    h.push("<ul>");
    var bullets = sections[i][1];
    for (var b = 0; b < bullets.length; b++) {
      if (bullets[b]) {
        h.push('<li style="color:' + MIN_MUTED + '"><i>' + esc(bullets[b]) + "</i></li>");
      } else {
        h.push("<li></li>");
      }
    }
    h.push("</ul>");
  }

  return h.join("\n");
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ───────── Helpers ───────── */

function titleCase(s) {
  s = String(s || "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
