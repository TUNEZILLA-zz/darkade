const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
  };
}

async function fetchTopScores() {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  const response = await fetch(
    `${url}/rest/v1/scores?select=id,name,score,wave,created_at&order=score.desc,wave.desc,created_at.asc&limit=10`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Supabase getScores failed: ${response.status}`);
  }

  return response.json();
}

exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const scores = await fetchTopScores();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ scores })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
