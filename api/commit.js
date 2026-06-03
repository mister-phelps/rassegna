// Vercel serverless function — POST /api/commit
// Accepts { date, content, secret } and commits to GitHub server-side.
// Required env vars: GITHUB_TOKEN, COMMIT_SECRET

const OWNER  = 'mister-phelps';
const REPO   = 'rassegna';
const BRANCH = 'main';

const GH_HEADERS = (token) => ({
  'Authorization': `Bearer ${token}`,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json',
});

async function ghGet(token, path) {
  const r = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
    { headers: GH_HEADERS(token) }
  );
  if (!r.ok) throw Object.assign(new Error(`GET ${path} → ${r.status}`), { status: r.status });
  return r.json();
}

async function ghPut(token, path, body) {
  const r = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
    { method: 'PUT', headers: GH_HEADERS(token), body: JSON.stringify(body) }
  );
  if (!r.ok) {
    const detail = await r.json().catch(() => ({}));
    throw new Error(`PUT ${path} → ${r.status}: ${detail.message ?? ''}`);
  }
  return r.json();
}

function b64enc(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}

function b64dec(str) {
  return Buffer.from(str, 'base64').toString('utf8');
}

module.exports = async function handler(req, res) {
  // CORS pre-flight (not strictly needed for curl, but harmless)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { date, content, secret } = req.body ?? {};

  // Auth
  if (!secret || secret !== process.env.COMMIT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validate inputs
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Missing or invalid date (expected YYYY-MM-DD)' });
  }
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'Missing or empty content' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'Server misconfigured: GITHUB_TOKEN missing' });

  try {
    const mdPath = `data/briefings/${date}.md`;

    // 1 ── Commit briefing file (idempotent: overwrite if it already exists)
    let existingSha;
    try {
      const existing = await ghGet(token, mdPath);
      existingSha = existing.sha;
    } catch (e) {
      if (e.status !== 404) throw e; // unexpected error
    }

    await ghPut(token, mdPath, {
      message: `chore: briefing ${date}`,
      content: b64enc(content),
      branch: BRANCH,
      ...(existingSha && { sha: existingSha }),
    });

    // 2 ── Update data/index.json (prepend date, deduplicate)
    const indexFile  = await ghGet(token, 'data/index.json');
    const oldDates   = JSON.parse(b64dec(indexFile.content));
    const newDates   = [date, ...oldDates.filter(d => d !== date)];

    await ghPut(token, 'data/index.json', {
      message: `chore: update index for ${date}`,
      content: b64enc(JSON.stringify(newDates, null, 2) + '\n'),
      sha: indexFile.sha,
      branch: BRANCH,
    });

    return res.status(200).json({ ok: true, date, editions: newDates.length });

  } catch (err) {
    console.error('[commit]', err);
    return res.status(500).json({ error: err.message });
  }
};
