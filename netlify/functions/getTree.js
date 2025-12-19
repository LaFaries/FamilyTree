// netlify/functions/getTree.js
const { createClient } = require("@supabase/supabase-js");

exports.handler = async () => {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from("family_tree")
      .select("data, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return { statusCode: 500, body: JSON.stringify({ ok: false, message: error.message }) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, tree: data?.data ?? null }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: e.message }) };
  }
};
