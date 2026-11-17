// Live exchange rates for every Ramani tool and for Uliza. Free source: ExchangeRate-API open feed (no key, updates once a day).
// Rates are kept in Cloudflare's cache for 6 hours, so the source is called only a few times a day however many people use the site.
// If the source fails, the tools keep the saved rates in site/data/live.js.
const SRC = "https://open.er-api.com/v6/latest/USD";
const KEY = "https://ramani-cache.internal/fx-usd-v1";

function fmt(d) {
  const t = new Date(d); if (isNaN(t)) return "";
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][t.getUTCMonth()];
  return `${t.getUTCDate()} ${m} ${t.getUTCFullYear()}, ${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")} UTC`;
}

export async function liveRates() {
  const cache = typeof caches !== "undefined" ? caches.default : null, key = new Request(KEY);
  if (cache) { const hit = await cache.match(key); if (hit) return hit.json(); }
  const r = await fetch(SRC, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("fx " + r.status);
  const j = await r.json();
  const tzs = j && j.rates && j.rates.TZS;
  if (j.result !== "success" || !(tzs > 1000 && tzs < 10000)) throw new Error("fx bad data"); // never publish a broken rate
  const out = { usd: j.rates, time: fmt(j.time_last_update_utc), date: fmt(j.time_last_update_utc).split(",")[0], source: "ExchangeRate-API" };
  if (cache) await cache.put(key, new Response(JSON.stringify(out), { headers: { "content-type": "application/json", "cache-control": "public, max-age=21600" } }));
  return out;
}

// Added to data/live.js: today's rates, then a short note under each exchange rate field saying rates may vary.
export function liveScript(fx) {
  const set = fx ? `L.usd=${JSON.stringify(fx.usd)};L.rates_time=${JSON.stringify(fx.time)};L.rates_date=${JSON.stringify(fx.date)};L.rates_source=${JSON.stringify(fx.source)};L.rates_live=true;` : "";
  return `
;(function(){var L=window.RAMANI_LIVE=window.RAMANI_LIVE||{};${set}
function note(edit){var sw=document.documentElement.lang==="sw",t=L.rates_time||"";
return sw?("Kiwango cha kubadilisha fedha kinasasishwa kila siku"+(t?" (mara ya mwisho "+t+")":"")+". Kiwango cha benki yako, duka la fedha na kiwango cha forodha cha TRA vinaweza kutofautiana, hivyo hakikisha kiwango kabla ya kulipa."+(edit?" Unaweza kubadilisha kiwango hapa.":""))
:("Exchange rates update daily"+(t?" (last update "+t+")":"")+". Your bank, bureau de change and the TRA customs rate may differ, so confirm the rate before you pay."+(edit?" You can change the rate here.":""));}
function run(){var f=document.querySelector('input[id$="-rate"],input[id$="-lrate"],[id$="-rates"],#rateDate');if(!f)return;
var n=document.querySelector(".ds-fxnote");if(!n){n=document.createElement("p");n.className="ds-fxnote";n.setAttribute("data-noi18n","");
n.style.cssText="margin:6px 0 0;font-size:12.5px;line-height:1.45;color:var(--muted,#4B5563)";
var box=f.closest("label,.f,.fld,.field,.cm-f,.hb-f,.row,div")||f.parentNode;box.appendChild(n);}
n.textContent=note(f.tagName==="INPUT");}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run);else run();
window.addEventListener("rg-lang",run);document.addEventListener("rg-lang",run);})();
`;
}
