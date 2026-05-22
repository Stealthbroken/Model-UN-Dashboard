const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const cron = require("node-cron");

const dev = process.env.NODE_ENV !== "production";
// Hosts (Render, Railway, etc.) inject the port to bind to via $PORT.
const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, () => {
    console.log(`> MUN Dashboard ready on port ${port}`);
  });

  async function runCron(path, label) {
    try {
      const res = await fetch(`http://localhost:${port}${path}`, { method: "POST" });
      if (!res.ok) console.error(`Cron: ${label} failed`, res.status);
    } catch {
      // Server may not be ready yet
    }
  }

  // Check for due classroom announcements every minute
  cron.schedule("* * * * *", () => runCron("/api/classroom/cron", "classroom"));

  // Check for missing-announcement reminders every 15 minutes
  cron.schedule("*/15 * * * *", () => runCron("/api/reminders/cron", "reminders"));

  // Send the weekly exec digest — Mondays at 8:00 AM
  cron.schedule("0 8 * * 1", () => runCron("/api/digest/cron", "digest"));
});
