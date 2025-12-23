export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response("", {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return json(500, { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Netlify env vars." });
    }

    const body = await req.json();
    const id = Number(body?.id ?? 1);
    const data = body?.data;

    if (!data || typeof data !== "object") {
      return json(400, { error: "Missing or invalid data payload" });
    }

    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/family_tree`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify([{ id, data }]),
    });

    if (!upsertRes.ok) {
      const text = await upsertRes.text();
      return json(upsertRes.status, { error: text || "Failed to write shared tree" });
    }

    const rows = await upsertRes.json();
    return json(200, { ok: true, row: rows?.[0] || null });
  } catch (e) {
    return json(500, { error: e.message || "Unexpected error" });
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}

function json(statusCode, payload) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}
