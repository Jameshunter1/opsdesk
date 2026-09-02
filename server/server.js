/* OpsDesk sync server — self-hosted, single file, zero npm installs.
   Run it with plain Node (v22.5+ / v24 recommended):

       node server.js

   That's the whole deployment. It stores accounts and each user's
   workspace document in a real SQLite database (Node's built-in driver)
   in opsdesk.db next to this file.

   Environment knobs (all optional):
     OPSDESK_PORT=8787            port to listen on
     OPSDESK_DATA=/path/to.db     database file location
     OPSDESK_ALLOW_SIGNUP=0      lock the server after you've made your
                                  account(s) — sign-ups refused, sign-ins fine
     OPSDESK_TLS_CERT=/path.crt   serve HTTPS directly (e.g. from
     OPSDESK_TLS_KEY=/path.key    `tailscale cert`) — needed when the app
                                  is opened from an https:// page

   Security model: passwords are scrypt-hashed with per-user salts;
   sessions are random 256-bit tokens stored hashed, 30-day sliding
   expiry; sign-in errors don't reveal whether the email exists; auth
   endpoints are rate-limited per IP. Each user can only ever read and
   write their own workspace row. */
"use strict";

const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const PORT = Number(process.env.OPSDESK_PORT) || 8787;
const DB_PATH = process.env.OPSDESK_DATA || path.join(__dirname, "opsdesk.db");
const ALLOW_SIGNUP = process.env.OPSDESK_ALLOW_SIGNUP !== "0";
const TLS_CERT = process.env.OPSDESK_TLS_CERT;
const TLS_KEY = process.env.OPSDESK_TLS_KEY;
const SESSION_DAYS = 30;
const MAX_DOC_BYTES = 5 * 1024 * 1024;

/* ---------- database ---------- */

const db = new DatabaseSync(DB_PATH);
db.exec(`
  pragma journal_mode = wal;
  create table if not exists users (
    id         integer primary key autoincrement,
    email      text unique not null,
    salt       text not null,
    hash       text not null,
    created_at text not null
  );
  create table if not exists sessions (
    token_hash text primary key,
    user_id    integer not null references users(id) on delete cascade,
    expires_at integer not null
  );
  create table if not exists workspaces (
    user_id    integer primary key references users(id) on delete cascade,
    doc        text not null,
    updated_at text not null
  );
`);

/* ---------- crypto helpers ---------- */

const hashPassword = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString("hex");
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const nowSec = () => Math.floor(Date.now() / 1000);

function verifyPassword(pw, salt, expectedHex) {
  const a = Buffer.from(hashPassword(pw, salt), "hex");
  const b = Buffer.from(expectedHex, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- tiny per-IP rate limit for auth endpoints ---------- */

const attempts = new Map(); // ip -> { count, resetAt }
function rateLimited(ip) {
  const now = Date.now();
  let a = attempts.get(ip);
  if (!a || now > a.resetAt) { a = { count: 0, resetAt: now + 10 * 60 * 1000 }; attempts.set(ip, a); }
  a.count += 1;
  return a.count > 30;
}

/* ---------- request plumbing ---------- */

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS"
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_DOC_BYTES) { reject(new Error("too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); }
      catch (e) { reject(new Error("bad json")); }
    });
    req.on("error", reject);
  });
}

function authedUser(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (!m) return null;
  const th = sha256(m[1]);
  const row = db.prepare("select user_id, expires_at from sessions where token_hash = ?").get(th);
  if (!row || row.expires_at < nowSec()) return null;
  // sliding expiry: using the app keeps you signed in
  db.prepare("update sessions set expires_at = ? where token_hash = ?")
    .run(nowSec() + SESSION_DAYS * 86400, th);
  return row.user_id;
}

function issueSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = nowSec() + SESSION_DAYS * 86400;
  db.prepare("insert into sessions (token_hash, user_id, expires_at) values (?, ?, ?)")
    .run(sha256(token), userId, expiresAt);
  return { token, expiresAt };
}

/* ---------- routes ---------- */

function handle(req, res) {
  const url = new URL(req.url, "http://x");
  const route = req.method + " " + url.pathname;
  const ip = req.socket.remoteAddress || "?";

  if (req.method === "OPTIONS") return send(res, 204, {});

  if (route === "GET /api/health") {
    return send(res, 200, { ok: true, name: "OpsDesk sync server", signupOpen: ALLOW_SIGNUP });
  }

  if (route === "POST /api/signup") {
    if (rateLimited(ip)) return send(res, 429, { error: "Too many attempts — try again in a few minutes." });
    if (!ALLOW_SIGNUP) return send(res, 403, { error: "Sign-ups are closed on this server." });
    return readBody(req).then((b) => {
      const email = String(b.email || "").trim().toLowerCase();
      const password = String(b.password || "");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { error: "That email doesn't look right." });
      if (password.length < 8) return send(res, 400, { error: "Password needs at least 8 characters." });
      if (db.prepare("select id from users where email = ?").get(email)) {
        return send(res, 409, { error: "An account with that email already exists — sign in instead." });
      }
      const salt = crypto.randomBytes(16).toString("hex");
      db.prepare("insert into users (email, salt, hash, created_at) values (?, ?, ?, ?)")
        .run(email, salt, hashPassword(password, salt), new Date().toISOString());
      const user = db.prepare("select id from users where email = ?").get(email);
      const s = issueSession(user.id);
      console.log(new Date().toISOString(), "signup:", email);
      return send(res, 200, { token: s.token, email, expiresAt: s.expiresAt });
    }).catch(() => send(res, 400, { error: "Bad request." }));
  }

  if (route === "POST /api/signin") {
    if (rateLimited(ip)) return send(res, 429, { error: "Too many attempts — try again in a few minutes." });
    return readBody(req).then((b) => {
      const email = String(b.email || "").trim().toLowerCase();
      const password = String(b.password || "");
      const user = db.prepare("select id, salt, hash from users where email = ?").get(email);
      if (!user || !verifyPassword(password, user.salt, user.hash)) {
        return send(res, 401, { error: "Wrong email or password." });
      }
      const s = issueSession(user.id);
      console.log(new Date().toISOString(), "signin:", email);
      return send(res, 200, { token: s.token, email, expiresAt: s.expiresAt });
    }).catch(() => send(res, 400, { error: "Bad request." }));
  }

  if (route === "POST /api/signout") {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
    if (m) db.prepare("delete from sessions where token_hash = ?").run(sha256(m[1]));
    return send(res, 200, { ok: true });
  }

  if (route === "GET /api/workspace") {
    const uid = authedUser(req);
    if (!uid) return send(res, 401, { error: "Sign in again." });
    const row = db.prepare("select doc, updated_at from workspaces where user_id = ?").get(uid);
    if (!row) return send(res, 200, { doc: null, updatedAt: null });
    return send(res, 200, { doc: JSON.parse(row.doc), updatedAt: row.updated_at });
  }

  if (route === "PUT /api/workspace") {
    const uid = authedUser(req);
    if (!uid) return send(res, 401, { error: "Sign in again." });
    return readBody(req).then((b) => {
      if (!b.doc || typeof b.doc !== "object") return send(res, 400, { error: "No document." });
      const doc = JSON.stringify(b.doc);
      if (doc.length > MAX_DOC_BYTES) return send(res, 413, { error: "Document too large." });
      const updatedAt = new Date().toISOString();
      db.prepare(`insert into workspaces (user_id, doc, updated_at) values (?, ?, ?)
                  on conflict (user_id) do update set doc = excluded.doc, updated_at = excluded.updated_at`)
        .run(uid, doc, updatedAt);
      return send(res, 200, { updatedAt });
    }).catch((e) => send(res, e.message === "too large" ? 413 : 400, { error: "Bad request." }));
  }

  return send(res, 404, { error: "Not found." });
}

/* ---------- listen ---------- */

let server;
let scheme = "http";
if (TLS_CERT && TLS_KEY) {
  server = https.createServer({ cert: fs.readFileSync(TLS_CERT), key: fs.readFileSync(TLS_KEY) }, handle);
  scheme = "https";
} else {
  server = http.createServer(handle);
}

server.listen(PORT, () => {
  console.log("OpsDesk sync server up.");
  console.log("  database :", DB_PATH);
  console.log("  sign-ups :", ALLOW_SIGNUP ? "open (set OPSDESK_ALLOW_SIGNUP=0 to lock after you register)" : "closed");
  const nets = os.networkInterfaces();
  Object.keys(nets).forEach((name) => {
    (nets[name] || []).forEach((n) => {
      if (n.family === "IPv4" && !n.internal) console.log("  reachable:", scheme + "://" + n.address + ":" + PORT);
    });
  });
  console.log("  local    :", scheme + "://localhost:" + PORT);
});
