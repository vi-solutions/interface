import { Pool } from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env manually
const envFile = readFileSync(resolve(__dirname, "../../../.env"), "utf-8");
for (const line of envFile.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq);
  const val = trimmed.slice(eq + 1);
  process.env[key] = val;
}

async function main() {
  const pool = new Pool({ database: "interface_env" });

  const {
    rows: [conn],
  } = await pool.query(
    "SELECT realm_id, access_token, refresh_token, access_token_expires_at FROM qbo_connection LIMIT 1",
  );
  if (!conn) {
    console.log("No QBO connection found");
    process.exit(1);
  }

  console.log("Realm:", conn.realm_id);
  console.log("Token expires:", conn.access_token_expires_at);

  let token = conn.access_token;

  // If token expired, refresh it first
  if (new Date(conn.access_token_expires_at) <= new Date()) {
    console.log("Access token expired, refreshing...");
    const clientId = process.env.QBO_CLIENT_ID;
    const clientSecret = process.env.QBO_CLIENT_SECRET;
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const refreshRes = await fetch(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basic}`,
          Accept: "application/json",
        },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(conn.refresh_token)}`,
      },
    );
    const refreshBody = await refreshRes.json();
    console.log("Refresh response:", JSON.stringify(refreshBody, null, 2));
    const tokens = refreshBody as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      x_refresh_token_expires_in: number;
    };
    token = tokens.access_token;
    console.log("Token refreshed successfully");
  }

  const base = `https://sandbox-quickbooks.api.intuit.com/v3/company/${conn.realm_id}`;
  const query = encodeURIComponent("SELECT * FROM TimeActivity MAXRESULTS 10");

  const res = await fetch(`${base}/query?query=${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const body = await res.json();
  console.log(JSON.stringify(body, null, 2));

  await pool.end();
}

main().catch(console.error);
