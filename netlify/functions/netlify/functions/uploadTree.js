// netlify/functions/uploadTree.js
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    // Expect client to send: Authorization: Bearer <supabase_access_token>
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, message: "Missing Bearer token" }) };
    }

    const body = JSON.parse(event.body || "{}");
    const tree = body.tree;

    if (!tree) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, message: "Missing tree payload" }) };
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Verify the user from the token
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, message: "Invalid session token" }) };
    }

    const uid = userRes.user.id;

    // Check admins table
    const { data: isAdmin, error: adminErr } = await supabaseAdmin
      .from("admins")
      .select("user_id")
      .eq("user_id", uid)
      .maybeSingle();

    if (adminErr) {
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: adminErr }) };
    }
    if (!isAdmin) {
      return { statusCode: 403, body: JSON.stringify({ ok: false, message: "Not an admin" }) };
    }

    // Save new tree snapshot
    const { error: insertErr } = await supabaseAdmin
      .from("family_tree")
      .insert([{ data: tree }]);

    if (insertErr) {
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: insertErr }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: e.message }) };
  }
};
