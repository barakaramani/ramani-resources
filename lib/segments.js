// Who a newsletter goes to. Only people who agreed to marketing email, did not unsubscribe and have not bounced.
const BASE = "email IS NOT NULL AND email_consent = 1 AND email_opt_out = 0 AND email_status IS NULL";
export function segmentWhere(seg) {
  const s = String(seg || "all");
  if (s === "all") return [BASE, []];
  if (s === "mql") return [BASE + " AND stage IN ('MQL','SQL','application')", []];
  if (s === "customers") return [BASE + " AND stage = 'customer'", []];
  if (s === "lead") return [BASE + " AND stage = 'lead'", []];
  if (s.startsWith("lang:")) return [BASE + " AND lang = ?1", [s.slice(5)]];
  if (s.startsWith("region:")) return [BASE + " AND region = ?1", [s.slice(7)]];
  throw new Error("Unknown segment");
}
// Very small formatter for staff written newsletters: blank lines, **bold**, [text](url), lines starting with "* ".
export function formatBody(src, first) {
  const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const inline = (t) => esc(t).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" style="color:#388539;font-weight:700">$1</a>');
  return String(src).replace(/\{\{\s*first_name\s*\}\}/g, first || "").split(/\n{2,}/).map((block) => {
    const lines = block.split("\n");
    if (lines.every((l) => /^\* /.test(l))) return "<ul>" + lines.map((l) => "<li>" + inline(l.slice(2)) + "</li>").join("") + "</ul>";
    return "<p>" + lines.map(inline).join("<br>") + "</p>";
  }).join("");
}
