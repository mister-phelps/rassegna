# Rassegna

A daily AI-curated press review focused on European affairs and international politics. Static site auto-deployed to Vercel; content is refreshed daily by an external script that commits a new `data/rassegna.json` via the GitHub REST API.

---

## How it works

1. `index.html` fetches `data/rassegna.json` at page load and renders article cards dynamically.
2. An external script (cron job, GitHub Action, etc.) generates a new JSON file each day and commits it to the `main` branch via the GitHub Contents API.
3. Vercel detects the push and redeploys automatically (typically under 30 seconds).

---

## JSON schema

**File path in repo:** `data/rassegna.json`

```json
{
  "date": "2026-06-03",
  "articles": [
    {
      "title":   "Article headline (string)",
      "source":  "Publication name (string)",
      "url":     "https://… (string, must be a valid URL)",
      "summary": "3–5 sentence AI-generated summary (string)",
      "topic":   "One of the topic tags below (string)"
    }
  ]
}
```

### Suggested topic tags

| Tag | Use for |
|-----|---------|
| `EU Affairs` | Internal EU legislation, institutions, Council/Parliament decisions |
| `European Economy` | ECB, eurozone, trade, fiscal policy |
| `European Diplomacy` | EU foreign policy, bilateral relations between European states |
| `Enlargement` | EU accession / candidate country news |
| `International Politics` | G7/G20, UN, NATO, non-EU geopolitics |
| `Defence & Security` | Military, intelligence, cybersecurity |
| `Energy & Climate` | Energy policy, climate negotiations, green transition |

---

## How the external update script should commit

Use the **GitHub Contents API** (no `git` binary required on the runner).

### Endpoint

```
PUT https://api.github.com/repos/{owner}/{repo}/contents/data/rassegna.json
```

### Required details

| Field | Value |
|-------|-------|
| **Owner** | your GitHub username |
| **Repo** | `rassegna` |
| **File path** | `data/rassegna.json` |
| **Branch** | `main` |

### Request body

```json
{
  "message": "chore: daily update 2026-06-03",
  "content": "<base64-encoded JSON string>",
  "sha":     "<SHA of the current file — required for updates>",
  "branch":  "main"
}
```

### Minimal Python example

```python
import base64, json, os
import urllib.request, urllib.error

OWNER  = "your-github-username"
REPO   = "rassegna"
PATH   = "data/rassegna.json"
BRANCH = "main"
TOKEN  = os.environ["GITHUB_TOKEN"]   # fine-grained PAT with Contents write permission

API    = f"https://api.github.com/repos/{OWNER}/{REPO}/contents/{PATH}"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
}

def gh(method, url, body=None):
    data = json.dumps(body).encode() if body else None
    req  = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

# 1. Get the current file SHA (required for PUT)
current = gh("GET", API)
sha = current["sha"]

# 2. Build new content
new_data = {
    "date": "2026-06-04",
    "articles": [
        # ... your AI-generated articles ...
    ]
}
encoded = base64.b64encode(json.dumps(new_data, ensure_ascii=False, indent=2).encode()).decode()

# 3. Commit
gh("PUT", API, {
    "message": f"chore: daily update {new_data['date']}",
    "content": encoded,
    "sha": sha,
    "branch": BRANCH,
})
print("Committed successfully — Vercel will redeploy shortly.")
```

### Required GitHub token scopes

Create a **fine-grained personal access token** (Settings → Developer settings → Fine-grained tokens) with:
- **Repository access:** only `rassegna`
- **Permissions → Contents:** Read and write

---

## Local development

Open `index.html` via a local HTTP server (not `file://` — fetch won't work without CORS on some browsers):

```bash
# Python 3
python -m http.server 8080
# then open http://localhost:8080
```

---

## Deployment

The site is deployed on [Vercel](https://vercel.com) as a static project. `vercel.json` sets a 5-minute cache on the JSON data file so repeat visitors get fast loads while still picking up the daily update promptly.
