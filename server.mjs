import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { builtInWords, suggest } from "./engine.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(ROOT, "public");
const DATA = resolve(ROOT, ".typo-data");
const SETTINGS_FILE = resolve(DATA, "settings.json");
const WORDS_FILE = resolve(DATA, "user-words.json");
const PORT = Number(process.env.PORT || 4173);
const HOST = "127.0.0.1";

const DEFAULTS = {
  schemaVersion: 1,
  enabled: true,
  completionEnabled: true,
  correctionEnabled: true,
  language: "English (US)",
  suggestionMode: "balanced",
  minimumPrefixLength: 2,
  maxCandidates: 1,
  learningEnabled: false,
  diagnosticsConsent: false,
  excludedApps: []
};

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return fallback;
    return fallback;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

async function getSettings() {
  const saved = await readJson(SETTINGS_FILE, {});
  return { ...DEFAULTS, ...saved, schemaVersion: 1 };
}

async function getUserWords() {
  const words = await readJson(WORDS_FILE, []);
  return Array.isArray(words) ? words.filter(word => typeof word === "string") : [];
}

function send(res, status, payload, type = "application/json; charset=utf-8") {
  const body = type.startsWith("application/json") ? JSON.stringify(payload) : payload;
  res.writeHead(status, {
    "Content-Type": type,
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
  });
  res.end(body);
}

function readBody(req, limit = 16_384) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", chunk => {
      size += Buffer.byteLength(chunk);
      if (size > limit) {
        reject(Object.assign(new Error("Request too large"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on("end", () => {
      try { resolveBody(JSON.parse(raw || "{}")); }
      catch { reject(Object.assign(new Error("Invalid JSON"), { statusCode: 400 })); }
    });
    req.on("error", reject);
  });
}

function isLocalRequest(req) {
  const origin = req.headers.origin;
  return !origin || origin === `http://${HOST}:${PORT}`;
}

function validWord(word) {
  return typeof word === "string" && /^[\p{L}'’-]{1,40}$/u.test(word.trim());
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    if (url.pathname.startsWith("/api/") && !isLocalRequest(req)) {
      return send(res, 403, { error: "Local dashboard origin required" });
    }

    if (req.method === "GET" && url.pathname === "/api/status") {
      return send(res, 200, {
        app: "Typo Preview",
        version: "0.1.0",
        engine: "local-dictionary-v1",
        adapter: { available: false, name: null, reason: "This build is a local dashboard and typing preview. It is not connected to an operating-system input method." },
        storage: "local",
        network: "not used"
      });
    }
    if (req.method === "GET" && url.pathname === "/api/settings") {
      return send(res, 200, await getSettings());
    }
    if (req.method === "PUT" && url.pathname === "/api/settings") {
      const input = await readBody(req);
      const current = await getSettings();
      const next = {
        ...current,
        enabled: Boolean(input.enabled),
        completionEnabled: Boolean(input.completionEnabled),
        correctionEnabled: Boolean(input.correctionEnabled),
        language: "English (US)",
        suggestionMode: ["fewer", "balanced", "more"].includes(input.suggestionMode) ? input.suggestionMode : "balanced",
        minimumPrefixLength: Math.max(1, Math.min(5, Number(input.minimumPrefixLength) || 2)),
        learningEnabled: Boolean(input.learningEnabled),
        diagnosticsConsent: Boolean(input.diagnosticsConsent),
        excludedApps: Array.isArray(input.excludedApps) ? input.excludedApps.filter(id => typeof id === "string").slice(0, 100) : []
      };
      await writeJson(SETTINGS_FILE, next);
      return send(res, 200, next);
    }
    if (req.method === "GET" && url.pathname === "/api/dictionary") {
      return send(res, 200, { builtIn: builtInWords.length, userWords: await getUserWords() });
    }
    if (req.method === "POST" && url.pathname === "/api/dictionary") {
      const input = await readBody(req);
      const word = typeof input.word === "string" ? input.word.trim() : "";
      if (!validWord(word)) return send(res, 400, { error: "Enter a word using letters, apostrophes, or hyphens (up to 40 characters)." });
      const words = await getUserWords();
      if (!words.some(item => item.toLowerCase() === word.toLowerCase())) words.push(word);
      await writeJson(WORDS_FILE, words.sort((a, b) => a.localeCompare(b)));
      return send(res, 200, { userWords: words });
    }
    if (req.method === "DELETE" && url.pathname.startsWith("/api/dictionary/")) {
      const word = decodeURIComponent(url.pathname.slice("/api/dictionary/".length));
      const words = (await getUserWords()).filter(item => item !== word);
      await writeJson(WORDS_FILE, words);
      return send(res, 200, { userWords: words });
    }
    if (req.method === "POST" && url.pathname === "/api/suggest") {
      const input = await readBody(req, 8_192);
      const settings = await getSettings();
      const userWords = await getUserWords();
      return send(res, 200, suggest({ text: String(input.text || "").slice(0, 2_000), cursor: Number(input.cursor), settings, userWords }));
    }

    if (req.method === "GET") {
      const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
      const filePath = resolve(PUBLIC, requested);
      if (!filePath.startsWith(PUBLIC + sep)) return send(res, 403, "Forbidden", "text/plain; charset=utf-8");
      const body = await readFile(filePath);
      const mime = ({ ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" })[extname(filePath)] || "application/octet-stream";
      return send(res, 200, body, mime);
    }
    return send(res, 404, { error: "Not found" });
  } catch (error) {
    if (!res.headersSent) send(res, error.statusCode || 500, { error: error.statusCode === 413 ? "Request too large" : "Request could not be completed" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Typo Preview running at http://${HOST}:${PORT}`);
  console.log("Local-only dashboard; no operating-system input method is connected.");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
