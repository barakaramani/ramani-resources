/* Ramani Learn data connector.
   The Learn page was first built to run inside claude.ai, where it reads and saves posts through window.claude.
   On the Ramani site there is no window.claude, so this file provides the same small interface backed by
   Ramani's own API:
   - public page (/ and /learn/<link>): read only, live posts from /api/learn/posts
   - staff editor (/learn-admin, behind Cloudflare Access): all posts, save, publish, delete and image upload
   through /api/learn/admin/*. Every write is checked on the server. */
(function () {
  if (window.claude && window.claude.use) return;
  var ADMIN = !!window.LEARN_ADMIN;

  function api(path, opt) {
    opt = opt || {};
    opt.credentials = "same-origin";
    opt.cache = "no-store";
    return fetch(path, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error || "error " + r.status); e.code = j.error || "error_" + r.status; throw e; }
        return j;
      });
    });
  }
  function send(method, id, doc) {
    return api("/api/learn/admin/posts/" + encodeURIComponent(id), { method: method, headers: { "content-type": "application/json" }, body: doc ? JSON.stringify(doc) : undefined });
  }

  var listeners = [], cache = null;
  function emit() {
    var snap = { docs: (cache || []).map(function (p) { return { id: p.id, data: function () { var x = {}; for (var k in p) if (k !== "id") x[k] = p[k]; return x; } }; }) };
    listeners.forEach(function (l) { try { l.ok(snap); } catch (e) {} });
  }
  function load() {
    return api(ADMIN ? "/api/learn/admin/posts" : "/api/learn/posts").then(function (j) { cache = j.posts || []; emit(); },
      function (e) { listeners.forEach(function (l) { if (l.err) l.err(e); }); });
  }
  var query = {
    orderBy: function () { return query; },
    limit: function () { return query; },
    onSnapshot: function (ok, err) { listeners.push({ ok: ok, err: err }); if (cache) setTimeout(emit, 0); else load(); return function () {}; },
    doc: function (id) {
      return {
        set: function (d) { return send("PUT", id, d).then(load); },
        update: function (d) { return send("PATCH", id, d).then(load); },
        delete: function () { return send("DELETE", id).then(load); }
      };
    }
  };
  var db = { collection: function () { return query; } };

  var me = ADMIN ? api("/api/learn/admin/me").catch(function () { return null; }) : Promise.resolve(null);
  var user = { canEdit: function () { return me.then(function (m) { return !!m; }); },
               me: function () { return me.then(function (m) { return m ? { id: m.email, name: m.name, email: m.email } : null; }); } };
  var assets = {
    upload: function (file) {
      return fetch("/api/learn/admin/upload", { method: "POST", credentials: "same-origin", headers: { "content-type": file.type || "application/octet-stream" }, body: file })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || "upload failed"); e.code = j.error || "upload_failed"; throw e; } return j; }); });
    }
  };

  window.claude = {
    use: function (name) {
      if (name === "db") return Promise.resolve(db);
      if (name === "user") return ADMIN ? me.then(function (m) { return m ? user : null; }) : Promise.resolve(null);
      if (name === "assets") return ADMIN ? me.then(function (m) { return m ? assets : null; }) : Promise.resolve(null);
      return Promise.resolve(null);
    }
  };
})();
