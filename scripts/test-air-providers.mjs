/**
 * Quick test for Lufthansa + Qatar Airways Cargo providers
 * Run: node scripts/test-air-providers.mjs
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const LH_API_KEY   = process.env.LUFTHANSA_CARGO_API_KEY;
const QR_CLIENT_ID = process.env.QATAR_CARGO_CLIENT_ID;
const QR_SECRET    = process.env.QATAR_CARGO_CLIENT_SECRET;
const QR_BASE_URL  = process.env.QATAR_CARGO_BASE_URL;
const QR_TOKEN_URL = process.env.QATAR_CARGO_TOKEN_URL;

const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";
const RESET  = "\x1b[0m";

const ok   = (msg) => console.log(`${GREEN}✅ ${msg}${RESET}`);
const fail = (msg) => console.log(`${RED}❌ ${msg}${RESET}`);
const info = (msg) => console.log(`${CYAN}ℹ  ${msg}${RESET}`);
const warn = (msg) => console.log(`${YELLOW}⚠  ${msg}${RESET}`);

// ── Test AWBs (dummy — will return 404/no-data but auth should work) ──
const LH_TEST_AWB = { prefix: "020", number: "00000001" };
const QR_TEST_AWB = { prefix: "157", number: "00000001" };

// ═══════════════════════════════════════════════════════════════
console.log("\n═══════════════════════════════════════");
console.log("  TrackMyContainer — Air Providers Test");
console.log("═══════════════════════════════════════\n");

// ── 1. LUFTHANSA ────────────────────────────────────────────────
console.log(`${CYAN}━━━ Lufthansa Cargo ━━━━━━━━━━━━━━━━━━━${RESET}`);

if (!LH_API_KEY) {
  fail("LUFTHANSA_CARGO_API_KEY not set");
} else {
  info(`API Key: ${LH_API_KEY.slice(0, 8)}...`);
  const url = `https://api.lufthansa-cargo.com/lh/handling/shipment?aWBPrefix=${LH_TEST_AWB.prefix}&aWBNumber=${LH_TEST_AWB.number}`;
  info(`Testing: GET ${url}`);

  try {
    const res = await fetch(url, {
      headers: { "APIKEY": LH_API_KEY, "Accept": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    info(`HTTP Status: ${res.status}`);
    const body = await res.text();

    if (res.status === 401 || res.status === 403) {
      fail(`Auth failed — API key invalid or expired (${res.status})`);
    } else if (res.status === 404 || res.status === 200) {
      ok(`Auth OK! Key is valid (got ${res.status} — expected for dummy AWB)`);
      try {
        const json = JSON.parse(body);
        info(`Response preview: ${JSON.stringify(json).slice(0, 200)}`);
      } catch { info(`Response: ${body.slice(0, 200)}`); }
    } else {
      warn(`Unexpected status ${res.status}`);
      info(`Response: ${body.slice(0, 300)}`);
    }
  } catch (err) {
    fail(`Request failed: ${err.message}`);
  }
}

// ── 2. QATAR AIRWAYS — TOKEN ────────────────────────────────────
console.log(`\n${CYAN}━━━ Qatar Airways Cargo ━━━━━━━━━━━━━━${RESET}`);

if (!QR_CLIENT_ID || !QR_SECRET) {
  fail("Qatar credentials not set");
} else if (!QR_TOKEN_URL) {
  fail("QATAR_CARGO_TOKEN_URL not set");
} else {
  info(`Client ID: ${QR_CLIENT_ID.slice(0, 8)}...`);
  info(`Token URL: ${QR_TOKEN_URL}`);

  let token = null;

  // Try form-encoded (standard OAuth2)
  try {
    info("Trying OAuth2 client_credentials (form-encoded)...");
    const res = await fetch(QR_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     QR_CLIENT_ID,
        client_secret: QR_SECRET,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    info(`Token HTTP Status: ${res.status}`);
    const body = await res.text();

    if (res.ok) {
      const json = JSON.parse(body);
      token = json.access_token;
      if (token) {
        ok(`Token obtained! (${token.slice(0, 20)}...)`);
        info(`Expires in: ${json.expires_in ?? "unknown"} seconds`);
      } else {
        warn(`Response OK but no access_token: ${body.slice(0, 200)}`);
      }
    } else {
      warn(`Form-encoded failed (${res.status}): ${body.slice(0, 200)}`);

      // Fallback: try JSON body
      info("Trying JSON body format...");
      const res2 = await fetch(QR_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type:    "client_credentials",
          client_id:     QR_CLIENT_ID,
          client_secret: QR_SECRET,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      info(`JSON token HTTP Status: ${res2.status}`);
      const body2 = await res2.text();
      info(`Response: ${body2.slice(0, 300)}`);

      if (res2.ok) {
        const json2 = JSON.parse(body2);
        token = json2.access_token;
        if (token) ok(`Token obtained via JSON! (${token.slice(0, 20)}...)`);
      }
    }
  } catch (err) {
    fail(`Token request failed: ${err.message}`);
  }

  // ── 3. QATAR AIRWAYS — TRACK ──────────────────────────────────
  if (token && QR_BASE_URL) {
    console.log(`\n${CYAN}━━━ Qatar Track Test ━━━━━━━━━━━━━━━━━${RESET}`);
    const trackUrl = `${QR_BASE_URL}/shipment/track`;
    info(`Testing: POST ${trackUrl}`);

    try {
      const res = await fetch(trackUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type":  "application/json",
          "Accept":        "application/json",
        },
        body: JSON.stringify({
          cargoTrackingRequestSOs: [{
            documentType:    "MAWB",
            documentPrefix:  QR_TEST_AWB.prefix,
            documentNumber:  QR_TEST_AWB.number,
          }],
        }),
        signal: AbortSignal.timeout(15_000),
      });

      info(`Track HTTP Status: ${res.status}`);
      const body = await res.text();

      if (res.status === 200) {
        ok("Track endpoint reachable!");
        try {
          const json = JSON.parse(body);
          info(`Response: ${JSON.stringify(json).slice(0, 300)}`);
        } catch { info(`Response: ${body.slice(0, 300)}`); }
      } else if (res.status === 404) {
        ok("Track endpoint reachable (404 = dummy AWB not found — that's expected!)");
      } else if (res.status === 401 || res.status === 403) {
        fail(`Track auth failed (${res.status}) — token may not have Track Shipment scope`);
        info(`Response: ${body.slice(0, 300)}`);
      } else {
        warn(`Unexpected status ${res.status}`);
        info(`Response: ${body.slice(0, 300)}`);
      }
    } catch (err) {
      fail(`Track request failed: ${err.message}`);
    }
  }
}

console.log("\n═══════════════════════════════════════\n");
