const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY
  };
}

function sanitizeName(name) {
  const cleaned = String(name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9 _-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12);
  return cleaned || "PLAYER";
}

function normalizeRun(body) {
  const parsed = JSON.parse(body || "{}");
  const score = Math.floor(Number(parsed.score));
  const wave = Math.max(1, Math.floor(Number(parsed.wave) || 1));

  if (!Number.isFinite(score) || score < 0 || score > 9999999) {
    const error = new Error("Score is outside the accepted range");
    error.statusCode = 400;
    throw error;
  }

  return {
    name: sanitizeName(parsed.name),
    score,
    wave
  };
}

async function supabaseRequest(path, options = {}) {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status}`);
  }

  return response;
}

async function fetchTopScores() {
  const response = await supabaseRequest(
    "scores?select=id,name,score,wave,created_at&order=score.desc,wave.desc,created_at.asc&limit=10"
  );
  return response.json();
}

exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const run = normalizeRun(event.body);
    await supabaseRequest("scores", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(run)
    });

    const scores = await fetchTopScores();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ scores })
    };
  } catch (error) {
    return {
      statusCode: error.statusCode || (error instanceof SyntaxError ? 400 : 500),
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
