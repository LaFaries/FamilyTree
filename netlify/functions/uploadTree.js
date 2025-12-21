
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, message: "Method Not Allowed" }),
      };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminEnvKey = process.env.ADMIN_KEY;

    if (!supabaseUrl || !serviceKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          message: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Netlify env vars.",
        }),
      };
    }

    if (!adminEnvKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          message: "Missing ADMIN_KEY in Netlify env vars.",
        }),
      };
    }

    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      body = {};
    }

    const adminKey = body.adminKey;

    if (!adminKey || adminKey !== adminEnvKey) {
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, message: "Forbidden" }),
      };
    }

    // Accept both shapes:
    //  A) { adminKey, tree: { gedText, meta } }
    //  B) { adminKey, gedText, meta }
    const tree = body.tree && typeof body.tree === "object" ? body.tree : null;

    const gedText =
      (typeof body.gedText === "string" ? body.gedText : null) ||
      (typeof tree?.gedText === "string" ? tree.gedText : null);

    if (!gedText) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          message: "Missing GEDCOM text. Provide gedText or tree.gedText.",
        }),
      };
    }

    const now = new Date().toISOString();

    const metaIncoming =
      (body.meta && typeof body.meta === "object" ? body.meta : null) ||
      (tree?.meta && typeof tree.meta === "object" ? tree.meta : null) ||
      {};

    const meta = {
      ...metaIncoming,
      uploadedAt: metaIncoming.uploadedAt || now,
      label: metaIncoming.label || "shared tree updated",
    };

    const payload = { gedText, meta };

    const supabase = createClient(supabaseUrl, serviceKey);

    const { error } = await supabase
      .from("family_tree")
      .insert([{ data: payload }]);

    if (error) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          message: "Supabase insert failed",
          error: error.message || error,
        }),
      };
    }

    // Stable response contract (frontend never changes again)
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        gedText,
        meta,
        tree: payload, // backwards compatible
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, message: e.message }),
    };
  }
};

