const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { adminKey, tree } = JSON.parse(event.body || "{}");

    if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, message: "Forbidden" }),
      };
    }

    const gedText = tree?.gedText;
    if (!gedText || typeof gedText !== "string") {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, message: "Missing tree.gedText" }),
      };
    }

    // normalize meta so it always exists
    const now = new Date().toISOString();
    const meta = {
      ...(tree.meta || {}),
      uploadedAt: tree?.meta?.uploadedAt || now,
      label: tree?.meta?.label || "shared tree updated",
    };

    const payload = { gedText, meta };

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabase.from("family_tree").insert([{ data: payload }]);

    if (error) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, message: "Supabase insert failed", error }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, tree: payload }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, message: e.message }),
    };
  }
};
