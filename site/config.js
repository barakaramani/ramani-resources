// Site settings for the live and preview sites. Forms post to the Cloudflare functions in /functions.
window.RAMANI = window.RAMANI || {};
RAMANI.endpoint = "/api/lead";          // every form: leads, one record per person
RAMANI.brainEndpoint = "/api/uliza";    // Uliza Ramani on the Claude API (falls back to quick answers if not set up)
RAMANI.applyUrl = "https://www.ramani.io/apply/start";
RAMANI.contactUrl = "https://www.ramani.io/contact";
RAMANI.privacyUrl = "https://www.ramani.io/privacy-policy";

// Cloudflare Turnstile: a free, invisible bot check on every form and on Uliza Ramani, so bots cannot fill
// the leads list or burn SMS credit. Real visitors see nothing; a doubtful one gets a quick tick box.
// The site key below is public. The secret key lives only in Cloudflare (TURNSTILE_SECRET).
RAMANI.turnstileSiteKey = "0x4AAAAAAGQRZBKSEnEewVKg";
(function () {
  var KEY = RAMANI.turnstileSiteKey;
  if (!KEY || !window.fetch || !window.Promise) return;
  var ready = null, wid = null, box = null, tok = null, tokAt = 0, waiters = [];
  function load() {
    if (ready) return ready;
    ready = new Promise(function (res) {
      window.__rgTurnstile = function () { res(true); };
      var s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__rgTurnstile&render=explicit";
      s.async = true; s.defer = true; s.onerror = function () { res(false); };
      document.head.appendChild(s);
    });
    return ready;
  }
  function settle(t) { var w = waiters; waiters = []; w.forEach(function (f) { f(t); }); }
  function mount() {
    if (wid !== null || !window.turnstile || !document.body) return;
    box = document.createElement("div");
    box.id = "rg-turnstile";
    box.style.cssText = "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483000";
    document.body.appendChild(box);
    wid = window.turnstile.render(box, {
      sitekey: KEY, appearance: "interaction-only", execution: "execute",
      callback: function (t) { tok = t; tokAt = Date.now(); settle(t); setTimeout(function () { if (box) box.style.display = "none"; }, 1500); },
      "error-callback": function () { settle(""); return true; },
      "expired-callback": function () { tok = null; }
    });
  }
  function run() { try { if (box) box.style.display = ""; window.turnstile.reset(wid); window.turnstile.execute(wid); } catch (e) { settle(""); } }
  function fresh() { return tok && Date.now() - tokAt < 270000; }
  function warm() { load().then(function (ok) { if (!ok) return; mount(); if (wid !== null && !fresh()) run(); }); }
  // A token for one request: the one fetched in the background if still fresh, otherwise a new one (max 10 s).
  function token() {
    return load().then(function (ok) {
      if (!ok) return "";
      mount(); if (wid === null) return "";
      if (fresh()) { var t = tok; tok = null; setTimeout(warm, 0); return t; }
      return new Promise(function (res) {
        var done = false, fin = function (t) { if (!done) { done = true; res(t || ""); } };
        waiters.push(fin); run(); setTimeout(function () { fin(""); }, 10000);
      }).then(function (t) { tok = null; setTimeout(warm, 0); return t; });
    });
  }
  // Start in the background the first time someone touches a form or Uliza.
  var started = false;
  function start() { if (started) return; started = true; warm(); }
  document.addEventListener("focusin", start, true);
  document.addEventListener("pointerdown", start, true);
  // Add the token to form and Uliza requests without changing each page.
  var plain = window.fetch;
  window.fetch = function (u, o) {
    try {
      var url = typeof u === "string" ? u : (u && u.url) || "";
      var path = url.indexOf(location.origin) === 0 ? url.slice(location.origin.length) : url;
      if (o && String(o.method || "").toUpperCase() === "POST" && typeof o.body === "string" &&
          (path === RAMANI.endpoint || path === RAMANI.brainEndpoint || path === "/api/c/auth/start")) {
        return token().then(function (t) {
          var b; try { b = JSON.parse(o.body); } catch (e) { return plain.call(window, u, o); }
          if (t) b.turnstile = t;
          var o2 = {}; for (var k in o) o2[k] = o[k]; o2.body = JSON.stringify(b);
          return plain.call(window, u, o2);
        });
      }
    } catch (e) {}
    return plain.apply(window, arguments);
  };
})();
