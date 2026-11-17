// Biashara Tanzania community API: /api/c/...
// Sign in with a 6 digit code by email (Resend) or SMS (Ghala, once Ghala SMS is live), then post, comment, like, report.
// Needs db/schema_v5.sql. Optional env: COMMUNITY_ADMINS (comma list of emails that become admins on sign in),
// MEDIA (an R2 bucket binding for post images), TURNSTILE_SECRET (bot check on sign in).
import { KB } from "../../../lib/kb.js";
import { makeCore } from "../../../lib/core.js";
import { activity, phone as normPhone, id } from "../../../lib/contact.js";
import { resendSend, resendReady } from "../../../lib/resend.js";
import { smsProvider, sendSms } from "../../../lib/sms.js";
const core = makeCore(KB);

const DAY = 864e5, SESSION_DAYS = 30, COOKIE = "rc_s";
const now = () => new Date().toISOString();
const enc = (s) => new TextEncoder().encode(s);
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const reply = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store", ...h } });
const err = (e, s = 400) => reply({ ok: false, error: e }, s);
const clean = (v, n) => String(v == null ? "" : v).replace(/\u0000/g, "").trim().slice(0, n);
const email = (e) => { e = clean(e, 200).toLowerCase(); return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : null; };

async function sha(s) { return hex(await crypto.subtle.digest("SHA-256", enc(s))); }
async function hmac(env, s) {
  const k = await crypto.subtle.importKey("raw", enc(env.EMAIL_SECRET || "set-EMAIL_SECRET"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc(s)));
}
function same(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
function cookie(req, name) { const m = (req.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)")); return m ? m[1] : null; }
const admins = (env) => String(env.COMMUNITY_ADMINS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
const isMod = (m) => m && (m.role === "mod" || m.role === "admin");

// The signed in member, or null.
async function who(req, env) {
  const t = cookie(req, COOKIE); if (!t || t.length < 20) return null;
  const m = await env.DB.prepare("SELECT m.* FROM sessions s JOIN members m ON m.id = s.member_id WHERE s.token_hash = ?1 AND s.expires_at > ?2").bind(await sha(t), now()).first();
  if (!m || m.status !== "active") return null;
  if (Date.now() - Date.parse(m.last_seen) > 3600e3) await env.DB.prepare("UPDATE members SET last_seen = ?2 WHERE id = ?1").bind(m.id, now()).run();
  return m;
}
const pub = (m) => m && { id: m.id, name: m.name, business: m.business, city: m.city, imports: m.imports, years: m.years, bio: m.bio, role: m.role, created_at: m.created_at };
const self = (m) => m && { ...pub(m), email: m.email, phone: m.phone, lang: m.lang };

async function turnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true;
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: String(token || ""), remoteip: ip || "" }) });
  return !!(await r.json().catch(() => ({}))).success;
}

// ---------- sign in
async function authStart(req, env, b) {
  const em = email(b.email), ph = em ? null : normPhone(b.phone);
  if (!em && !ph) return err("bad_contact");
  if (!(await turnstile(env, b.turnstile, req.headers.get("cf-connecting-ip")))) return err("bot_check", 403);
  const target = em || ph, channel = em ? "email" : "sms";
  if (channel === "email" && !resendReady(env)) return err("email_off", 503);
  if (channel === "sms" && !smsProvider(env)) return err("sms_off", 503);
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM auth_codes WHERE target = ?1 AND created_at > ?2").bind(target, new Date(Date.now() - 3600e3).toISOString()).first();
  if (recent.n >= 5) return err("too_many", 429);
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1e6, code = String(n).padStart(6, "0");
  await env.DB.prepare("INSERT INTO auth_codes (id, channel, target, code_hash, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
    .bind(id("ac_"), channel, target, await hmac(env, target + ":" + code), now(), new Date(Date.now() + 600e3).toISOString()).run();
  const sw = b.lang === "sw";
  if (channel === "email") {
    const subject = sw ? `${code} ni namba yako ya kuingia Biashara Tanzania` : `${code} is your Biashara Tanzania sign in code`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#16211a"><p style="font:800 20px Arial;color:#388539;margin:0 0 16px">ramani</p>
<p>${sw ? "Namba yako ya kuingia kwenye jumuiya ya Biashara Tanzania ni:" : "Your sign in code for the Biashara Tanzania community is:"}</p>
<p style="font:800 34px/1 'Courier New',monospace;letter-spacing:6px;background:#f3f1ea;border-radius:12px;padding:16px;text-align:center">${code}</p>
<p style="color:#5f6d63;font-size:14px">${sw ? "Inafanya kazi kwa dakika 10. Kama hukuomba namba hii, puuza barua pepe hii." : "It works for 10 minutes. If you did not ask for it, you can ignore this email."}</p></div>`;
    try { await resendSend(env, { to: em, subject, html, text: subject, tags: [["auto", "community_code"]] }); } catch (e) { return err("send_failed", 502); }
  } else {
    try { await sendSms(env, { to: ph, text: sw ? `Namba yako ya kuingia Biashara Tanzania: ${code}. Inafanya kazi dakika 10.` : `Your Biashara Tanzania sign in code: ${code}. It works for 10 minutes.` }); } catch (e) { return err("send_failed", 502); }
  }
  return reply({ ok: true, channel });
}

async function authVerify(req, env, b) {
  const em = email(b.email), ph = em ? null : normPhone(b.phone), target = em || ph, code = clean(b.code, 6);
  if (!target || !/^\d{6}$/.test(code)) return err("bad_code");
  const row = await env.DB.prepare("SELECT * FROM auth_codes WHERE target = ?1 AND used = 0 AND expires_at > ?2 ORDER BY created_at DESC LIMIT 1").bind(target, now()).first();
  if (!row || row.attempts >= 5) return err("code_expired");
  if (!same(row.code_hash, await hmac(env, target + ":" + code))) {
    await env.DB.prepare("UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ?1").bind(row.id).run();
    return err("wrong_code");
  }
  let m = await env.DB.prepare(em ? "SELECT * FROM members WHERE email = ?1" : "SELECT * FROM members WHERE phone = ?1").bind(target).first();
  const name = clean(b.name, 80);
  if (!m && name.length < 2) return reply({ ok: false, need_name: true }); // code is right; ask for a name, keep the code valid
  if (m && m.status !== "active") return err("banned", 403);
  await env.DB.prepare("UPDATE auth_codes SET used = 1 WHERE id = ?1").bind(row.id).run();
  const t = now(), lang = b.lang === "sw" ? "sw" : "en";

  // The same person as in the leads table.
  let p = await env.DB.prepare(em ? "SELECT id FROM people WHERE email = ?1" : "SELECT id FROM people WHERE phone = ?1").bind(target).first();
  if (!p) {
    const pid = id("p_");
    await env.DB.prepare("INSERT OR IGNORE INTO people (id, name, email, phone, first_type, first_page, first_seen, last_seen) VALUES (?1, ?2, ?3, ?4, 'community_join', 'community', ?5, ?5)").bind(pid, name || null, em, ph, t).run();
    p = await env.DB.prepare(em ? "SELECT id FROM people WHERE email = ?1" : "SELECT id FROM people WHERE phone = ?1").bind(target).first();
  }
  const isNew = !m;
  if (!m) {
    const role = em && admins(env).includes(em) ? "admin" : "member";
    await env.DB.prepare("INSERT INTO members (id, person_id, email, phone, name, role, lang, created_at, last_seen) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)")
      .bind(id("m_"), p && p.id, em, ph, name, role, lang, t).run();
    m = await env.DB.prepare("SELECT * FROM members WHERE " + (em ? "email" : "phone") + " = ?1").bind(target).first();
  } else if (em && admins(env).includes(em) && m.role !== "admin") {
    await env.DB.prepare("UPDATE members SET role = 'admin' WHERE id = ?1").bind(m.id).run(); m.role = "admin";
  }
  if (p) { // log the join once and refresh the lead score
    try {
      await env.DB.prepare("UPDATE people SET name = COALESCE(name, ?2), last_seen = ?3, lang = COALESCE(lang, ?4) WHERE id = ?1").bind(p.id, m.name, t, lang).run();
      const r = await env.DB.prepare("INSERT OR IGNORE INTO submissions (id, person_id, type, action_key, page, received_at, data) VALUES (?1, ?2, 'community_join', 'community_join', 'community', ?3, ?4)")
        .bind(id("s_"), p.id, t, JSON.stringify({ type: "community_join", data: { name: m.name, source: "community_app" } })).run();
      if (r.meta.changes) { const s = core.mqlScore(await activity(env, p.id)); await env.DB.prepare("UPDATE people SET mql_score = ?2, stage = CASE WHEN stage = 'lead' AND ?3 = 1 THEN 'MQL' ELSE stage END WHERE id = ?1").bind(p.id, s.score, s.mql ? 1 : 0).run(); }
    } catch {}
  }
  const raw = new Uint8Array(32); crypto.getRandomValues(raw);
  const token = btoa(String.fromCharCode(...raw)).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" }[c]));
  await env.DB.prepare("INSERT INTO sessions (token_hash, member_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)").bind(await sha(token), m.id, t, new Date(Date.now() + SESSION_DAYS * DAY).toISOString()).run();
  return reply({ ok: true, new: isNew, member: self(m) }, 200, { "set-cookie": `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}` });
}

// ---------- posts
const POST_COLS = "p.id, p.space_id, s.slug AS space, s.name_en AS space_en, s.name_sw AS space_sw, s.emoji, p.title, p.body, p.image_key, p.pinned, p.hidden, p.like_count, p.comment_count, p.created_at, p.edited_at, m.id AS author_id, m.name AS author, m.business AS author_business, m.role AS author_role";
async function listPosts(env, me, q) {
  const where = ["1 = 1"], args = [];
  if (!isMod(me)) where.push("p.hidden = 0");
  if (q.get("space")) { args.push(q.get("space")); where.push(`s.slug = ?${args.length}`); }
  if (q.get("member")) { args.push(q.get("member")); where.push(`p.member_id = ?${args.length}`); }
  if (q.get("q")) { args.push("%" + clean(q.get("q"), 60).replace(/[%_]/g, "") + "%"); where.push(`(p.title LIKE ?${args.length} OR p.body LIKE ?${args.length})`); }
  const before = q.get("before"); if (before) { args.push(before); where.push(`p.created_at < ?${args.length}`); }
  const pinFirst = q.get("space") && !before ? "p.pinned DESC, " : "";
  args.push(me.id); const meArg = args.length;
  const r = await env.DB.prepare(`SELECT ${POST_COLS}, EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.member_id = ?${meArg}) AS liked
    FROM posts p JOIN spaces s ON s.id = p.space_id JOIN members m ON m.id = p.member_id WHERE ${where.join(" AND ")} ORDER BY ${pinFirst}p.created_at DESC LIMIT 20`).bind(...args).all();
  return r.results || [];
}
async function getPost(env, me, pid) {
  return env.DB.prepare(`SELECT ${POST_COLS}, p.member_id, EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.member_id = ?2) AS liked FROM posts p JOIN spaces s ON s.id = p.space_id JOIN members m ON m.id = p.member_id WHERE p.id = ?1`).bind(pid, me.id).first();
}
async function rate(env, table, me, max) {
  const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE member_id = ?1 AND created_at > ?2`).bind(me.id, new Date(Date.now() - 3600e3).toISOString()).first();
  return r.n < max;
}

// ---------- router
export async function onRequest(ctx) {
  const { request: req, env, params } = ctx;
  if (!env.DB) return err("no_db", 503);
  const parts = [].concat(params.path || []), path = parts.join("/"), q = new URL(req.url).searchParams, M = req.method;
  if (M === "GET" && parts[0] === "media" && parts[1]) { // post images from R2
    if (!env.MEDIA) return new Response("Not found", { status: 404 });
    const o = await env.MEDIA.get("img/" + parts[1].replace(/[^a-z0-9_.]/gi, ""));
    if (!o) return new Response("Not found", { status: 404 });
    return new Response(o.body, { headers: { "content-type": o.httpMetadata && o.httpMetadata.contentType || "image/jpeg", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
  }
  let b = {};
  if (M === "POST") {
    if (req.headers.get("x-rc") !== "1") return err("bad_request", 403); // a header other sites cannot add without our permission
    if (!(req.headers.get("content-type") || "").startsWith("multipart/")) { const t = await req.text(); if (t.length > 20000) return err("too_large", 413); try { b = t ? JSON.parse(t) : {}; } catch { return err("bad_json"); } }
  }
  try {
    if (M === "POST" && path === "auth/start") return await authStart(req, env, b);
    if (M === "POST" && path === "auth/verify") return await authVerify(req, env, b);
    const me = await who(req, env);
    if (M === "POST" && path === "auth/logout") {
      const t = cookie(req, COOKIE); if (t) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(await sha(t)).run();
      return reply({ ok: true }, 200, { "set-cookie": `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
    }
    if (M === "GET" && path === "spaces") {
      const r = await env.DB.prepare("SELECT s.slug, s.name_en, s.name_sw, s.desc_en, s.desc_sw, s.emoji, s.kind, s.staff_only, (SELECT COUNT(*) FROM posts p WHERE p.space_id = s.id AND p.hidden = 0) AS posts FROM spaces s ORDER BY s.sort").all();
      const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM members WHERE status = 'active'").first();
      return reply({ ok: true, spaces: r.results || [], members: c.n, me: self(me), uploads: !!env.MEDIA, sms: !!smsProvider(env) });
    }
    if (M === "GET" && path === "me") return reply({ ok: true, me: self(me) });
    if (!me) return err("sign_in", 401); // everything below is for members only

    if (M === "POST" && path === "me") {
      const f = { name: clean(b.name, 80), business: clean(b.business, 100), city: clean(b.city, 60), imports: clean(b.imports, 160), years: clean(b.years, 30), bio: clean(b.bio, 500), lang: b.lang === "sw" ? "sw" : b.lang === "en" ? "en" : me.lang };
      if (f.name.length < 2) return err("name_required");
      await env.DB.prepare("UPDATE members SET name = ?2, business = ?3, city = ?4, imports = ?5, years = ?6, bio = ?7, lang = ?8 WHERE id = ?1").bind(me.id, f.name, f.business, f.city, f.imports, f.years, f.bio, f.lang).run();
      return reply({ ok: true, me: self({ ...me, ...f }) });
    }
    if (M === "GET" && path === "posts") return reply({ ok: true, posts: await listPosts(env, me, q) });
    if (M === "POST" && path === "posts") {
      const s = await env.DB.prepare("SELECT * FROM spaces WHERE slug = ?1").bind(clean(b.space, 60)).first();
      if (!s || s.kind !== "posts") return err("no_space");
      if (s.staff_only && !isMod(me)) return err("staff_only_space", 403);
      const title = clean(b.title, 140), body = clean(b.body, 5000), img = b.image_key ? clean(b.image_key, 60).replace(/[^a-z0-9_.]/gi, "") : null;
      if (body.length < 2 && !img) return err("empty");
      if (!(await rate(env, "posts", me, 10))) return err("slow_down", 429);
      const pid = id("po_");
      await env.DB.prepare("INSERT INTO posts (id, space_id, member_id, title, body, image_key, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)").bind(pid, s.id, me.id, title || null, body, img, now()).run();
      return reply({ ok: true, post: await getPost(env, me, pid) });
    }
    if (parts[0] === "posts" && parts[1]) {
      const p = await getPost(env, me, parts[1]);
      if (!p || (p.hidden && !isMod(me))) return err("not_found", 404);
      if (M === "GET" && parts.length === 2) {
        const c = await env.DB.prepare(`SELECT c.id, c.body, c.hidden, c.created_at, m.id AS author_id, m.name AS author, m.business AS author_business, m.role AS author_role FROM comments c JOIN members m ON m.id = c.member_id WHERE c.post_id = ?1 ${isMod(me) ? "" : "AND c.hidden = 0"} ORDER BY c.created_at LIMIT 300`).bind(p.id).all();
        return reply({ ok: true, post: p, comments: c.results || [] });
      }
      if (M === "POST" && parts[2] === "comments") {
        const body = clean(b.body, 2000); if (body.length < 1) return err("empty");
        if (!(await rate(env, "comments", me, 60))) return err("slow_down", 429);
        const cid = id("co_"), t = now();
        await env.DB.batch([
          env.DB.prepare("INSERT INTO comments (id, post_id, member_id, body, created_at) VALUES (?1, ?2, ?3, ?4, ?5)").bind(cid, p.id, me.id, body, t),
          env.DB.prepare("UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?1").bind(p.id),
        ]);
        return reply({ ok: true, comment: { id: cid, body, hidden: 0, created_at: t, author_id: me.id, author: me.name, author_business: me.business, author_role: me.role } });
      }
      if (M === "POST" && parts[2] === "like") {
        const r = await env.DB.prepare("INSERT OR IGNORE INTO likes (post_id, member_id, created_at) VALUES (?1, ?2, ?3)").bind(p.id, me.id, now()).run();
        if (!r.meta.changes) await env.DB.prepare("DELETE FROM likes WHERE post_id = ?1 AND member_id = ?2").bind(p.id, me.id).run();
        await env.DB.prepare("UPDATE posts SET like_count = (SELECT COUNT(*) FROM likes WHERE post_id = ?1) WHERE id = ?1").bind(p.id).run();
        const n = await env.DB.prepare("SELECT like_count FROM posts WHERE id = ?1").bind(p.id).first();
        return reply({ ok: true, liked: !!r.meta.changes, likes: n.like_count });
      }
      if (M === "POST" && parts[2] === "edit") {
        if (p.member_id !== me.id) return err("not_yours", 403);
        const body = clean(b.body, 5000); if (body.length < 2) return err("empty");
        await env.DB.prepare("UPDATE posts SET title = ?2, body = ?3, edited_at = ?4 WHERE id = ?1").bind(p.id, clean(b.title, 140) || null, body, now()).run();
        return reply({ ok: true, post: await getPost(env, me, p.id) });
      }
      if (M === "POST" && parts[2] === "delete") {
        if (p.member_id !== me.id && !isMod(me)) return err("not_yours", 403);
        await env.DB.prepare("UPDATE posts SET hidden = 1 WHERE id = ?1").bind(p.id).run();
        return reply({ ok: true });
      }
    }
    if (M === "POST" && path === "report") {
      const kind = b.kind === "comment" ? "comment" : "post", tid = clean(b.id, 40);
      await env.DB.prepare("INSERT OR IGNORE INTO reports (id, kind, target_id, member_id, reason, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)").bind(id("rp_"), kind, tid, me.id, clean(b.reason, 300), now()).run();
      return reply({ ok: true });
    }
    if (M === "POST" && path === "upload") {
      if (!env.MEDIA) return err("uploads_off", 503);
      if (!(await rate(env, "posts", me, 10))) return err("slow_down", 429);
      const f = (await req.formData()).get("file");
      const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[f && f.type];
      if (!ext) return err("bad_type"); if (f.size > 3 * 1024 * 1024) return err("too_large", 413);
      const key = id("i_") + "." + ext;
      await env.MEDIA.put("img/" + key, f.stream(), { httpMetadata: { contentType: f.type }, customMetadata: { member: me.id } });
      return reply({ ok: true, key });
    }
    if (M === "GET" && path === "members") {
      const s = clean(q.get("q"), 60).replace(/[%_]/g, "");
      const r = await env.DB.prepare(`SELECT m.id, m.name, m.business, m.city, m.imports, m.years, m.role, m.created_at, (SELECT COUNT(*) FROM posts p WHERE p.member_id = m.id AND p.hidden = 0) AS posts
        FROM members m WHERE m.status = 'active' AND (?1 = '' OR m.name LIKE ?2 OR m.business LIKE ?2 OR m.city LIKE ?2 OR m.imports LIKE ?2) ORDER BY m.last_seen DESC LIMIT 60`).bind(s, "%" + s + "%").all();
      return reply({ ok: true, members: r.results || [] });
    }
    if (M === "GET" && parts[0] === "members" && parts[1]) {
      const m = await env.DB.prepare("SELECT * FROM members WHERE id = ?1").bind(parts[1]).first();
      if (!m || (m.status !== "active" && !isMod(me))) return err("not_found", 404);
      return reply({ ok: true, member: { ...pub(m), status: isMod(me) ? m.status : undefined } });
    }
    // ---------- moderation
    if (path === "mod/reports" && M === "GET") {
      if (!isMod(me)) return err("mods_only", 403);
      const r = await env.DB.prepare(`SELECT r.kind, r.target_id, COUNT(*) AS n, MAX(r.created_at) AS last, GROUP_CONCAT(r.reason, ' | ') AS reasons,
        COALESCE((SELECT substr(body, 1, 200) FROM posts WHERE id = r.target_id), (SELECT substr(body, 1, 200) FROM comments WHERE id = r.target_id)) AS preview,
        COALESCE((SELECT post_id FROM comments WHERE id = r.target_id), r.target_id) AS post_id
        FROM reports r WHERE r.resolved = 0 GROUP BY r.kind, r.target_id ORDER BY last DESC LIMIT 100`).all();
      return reply({ ok: true, reports: r.results || [] });
    }
    if (path === "mod" && M === "POST") {
      if (!isMod(me)) return err("mods_only", 403);
      const a = b.action, tid = clean(b.id, 40);
      const one = (sql, ...v) => env.DB.prepare(sql).bind(...v).run();
      if (a === "pin" || a === "unpin") await one("UPDATE posts SET pinned = ?2 WHERE id = ?1", tid, a === "pin" ? 1 : 0);
      else if (a === "hide" || a === "unhide") await one("UPDATE posts SET hidden = ?2 WHERE id = ?1", tid, a === "hide" ? 1 : 0);
      else if (a === "hide_comment" || a === "unhide_comment") await one("UPDATE comments SET hidden = ?2 WHERE id = ?1", tid, a === "hide_comment" ? 1 : 0);
      else if (a === "resolve") await one("UPDATE reports SET resolved = 1 WHERE target_id = ?1", tid);
      else if (a === "ban" || a === "unban") {
        if (me.role !== "admin") return err("admins_only", 403);
        if (tid === me.id) return err("not_yourself");
        await one("UPDATE members SET status = ?2 WHERE id = ?1", tid, a === "ban" ? "banned" : "active");
        if (a === "ban") await one("DELETE FROM sessions WHERE member_id = ?1", tid);
      } else if (a === "role") {
        if (me.role !== "admin") return err("admins_only", 403);
        if (!["member", "mod", "admin"].includes(b.role) || tid === me.id) return err("bad_role");
        await one("UPDATE members SET role = ?2 WHERE id = ?1", tid, b.role);
      } else return err("bad_action");
      return reply({ ok: true });
    }
    return err("not_found", 404);
  } catch (e) {
    if (/no such table/i.test(String(e && e.message))) return err("run_schema_v5", 503);
    return err("server_error", 500);
  }
}
