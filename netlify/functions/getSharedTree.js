export default async (req, context) => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return json(500, { error: "Server not configured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
    }

    // Read row id=1
    const res = await fetch(`${SUPABASE_URL}/rest/v1/family_tree?id=eq.1&select=id,created_at,data`, {
      headers: {
        "apikey": SERVICE_ROLE,
        "Authorization": `Bearer ${SERVICE_ROLE}`,
      }
    });

    if (!res.ok) {
      const text = await res.text();
      return json(res.status, { error: text || "Failed to read shared tree" });
    }

    const rows = await res.json();
    const row = rows?.[0] || null;

    return json(200, { data: row?.data || null, meta: row ? { id: row.id, created_at: row.created_at } : null });
  } catch (e) {
    return json(500, { error: e.message || "Unexpected error" });
  }
};

function json(statusCode, payload) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
    }
  });
}
