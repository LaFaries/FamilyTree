// netlify/functions/uploadTree.js
const { createClient } = require("@supabase/supabase-js");

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, message: "Method Not Allowed" });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const body = JSON.parse(event.body || "{}");
    const adminKeyFromBody = body.adminKey || "";
    const tree = body.tree || null;

    // Mode A (NOW): ADMIN_KEY password gate (no Supabase login)
    if (process.env.ADMIN_KEY) {
      if (!adminKeyFromBody) return json(401, { ok: false, message: "Missing adminKey" });
      if (adminKeyFromBody !== process.env.ADMIN_KEY) {
        return json(401, { ok: false, message: "Unauthorized (bad admin password)" });
      }
      if (!tree) return json(400, { ok: false, message: "Missing tree payload" });

      const { error: insertErr } = await supabaseAdmin
        .from("family_tree")
        .insert([{ data: tree }]);

      if (insertErr) return json(500, { ok: false, message: insertErr.message });

      return json(200, { ok: true });
    }

    // Mode B (LATER): Bearer token + admins table (kept for future)
    return json(400, { ok: false, message: "ADMIN_KEY not set; token mode not enabled in this version." });
  } catch (e) {
    return json(500, { ok: false, message: e.message });
  }
};
