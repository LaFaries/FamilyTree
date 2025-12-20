const { createClient } = require("@supabase/supabase-js");

exports.handler = async () => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase
      .from("family_tree")
      .select("data, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          message: "Supabase read failed",
          error: error.message || error,
        }),
      };
    }

    // data?.data can be:
    // - null (no uploads yet)
    // - a GEDCOM string
    // - an object like { gedText, meta }
    let gedText = null;
    let meta = null;

    const stored = data?.data ?? null;

    if (typeof stored === "string") {
      gedText = stored;
      meta = { uploadedAt: data?.created_at || null };
    } else if (stored && typeof stored === "object") {
      gedText = stored.gedText || stored.gedcom || stored.text || null;
      meta = stored.meta || { uploadedAt: data?.created_at || null };
    } else {
      gedText = null;
      meta = { uploadedAt: null };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        gedText,                 // <-- NEW canonical field
        meta,
        tree: { gedText, meta }, // <-- Backwards-compatible wrapper
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
