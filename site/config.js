// Site settings for the live and preview sites. Forms post to the Cloudflare functions in /functions.
window.RAMANI = window.RAMANI || {};
RAMANI.endpoint = "/api/lead";          // every form: leads, one record per person
RAMANI.brainEndpoint = "/api/uliza";    // Uliza Ramani on the Claude API (falls back to quick answers if not set up)
RAMANI.applyUrl = "https://www.ramani.io/apply/start";
RAMANI.contactUrl = "https://www.ramani.io/contact";
RAMANI.privacyUrl = "https://www.ramani.io/privacy-policy";
