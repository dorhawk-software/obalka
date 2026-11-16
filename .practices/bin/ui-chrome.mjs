// check-ui's Chrome: started headless and spoken to over a pipe (fd 3 to
// Chrome, fd 4 from it, JSON messages ending in \0), so it needs no
// packages, only Node 18+. ui-audit.mjs uses it.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Start Chrome at path. die(msg) is called when it stops while answers are awaited.
export function startChrome(path, die) {
  const profile = mkdtempSync(join(tmpdir(), "check-ui-"));
  const args = ["--headless=new", "--remote-debugging-pipe", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
    "--no-default-browser-check", "--allow-file-access-from-files", "--force-color-profile=srgb", `--user-data-dir=${profile}`];
  // CI runners' kernels refuse Chrome's sandbox, and Chrome refuses it to root (a dev container, a cloud
  // agent's session); the pages are the project's own.
  if (process.env.CI || process.getuid?.() === 0) args.push("--no-sandbox");
  const chrome = spawn(path, [...args, "about:blank"], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
  let chromeErr = "";
  chrome.stderr.on("data", (d) => { chromeErr = (chromeErr + d).slice(-2000); });
  const cleanup = () => { try { chrome.kill(); } catch {} try { rmSync(profile, { recursive: true, force: true }); } catch {} };
  process.on("exit", cleanup);
  const toChrome = chrome.stdio[3], fromChrome = chrome.stdio[4];
  let id = 0, buf = "";
  const waiting = new Map(), events = [];
  fromChrome.on("data", (d) => {
    buf += d;
    let at;
    while ((at = buf.indexOf("\0")) >= 0) {
      const msg = JSON.parse(buf.slice(0, at));
      buf = buf.slice(at + 1);
      if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); } else events.push(msg);
    }
  });
  chrome.on("exit", (code) => { if (waiting.size) die(`Chrome stopped (exit ${code}): ${chromeErr.trim().split("\n").pop()}`); });
  const send = (method, params = {}, sessionId) => new Promise((ok, fail) => {
    const i = ++id;
    const timer = setTimeout(() => fail(new Error(`${method}: no answer in 60 s`)), 60000);
    waiting.set(i, (m) => { clearTimeout(timer); m.error ? fail(new Error(`${method}: ${m.error.message}`)) : ok(m.result); });
    toChrome.write(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }) + "\0");
  });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // --- Chrome's first page. In a container it failed half the time with "Cannot read properties of
  // undefined (reading 'targetId')": no page yet (Scops, 2026-11-16). So: open one if none, try three times.
  async function openPage() {
    let last = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { targetInfos } = await send("Target.getTargets");
        let page = targetInfos.find((t) => t.type === "page");
        if (!page) page = await send("Target.createTarget", { url: "about:blank" });
        const { sessionId } = await send("Target.attachToTarget", { targetId: page.targetId, flatten: true });
        return sessionId;
      } catch (err) {
        last = err;
        await sleep(400 * attempt);
      }
    }
    die(`Chrome didn't open a page in 3 tries (${last.message}). Fix: run it again; if it keeps failing, check that Chrome starts on its own: "${path}" --headless=new about:blank.`);
  }

  return { send, events, sleep, openPage, cleanup };
}
