# Rassegna

A daily AI-curated press review focused on European affairs and international politics. Static site auto-deployed to Vercel; content is refreshed daily by an external script that commits new files via the GitHub REST API.

---

## How it works

1. `index.html` fetches `data/index.json` at load time to discover all available editions.
2. It defaults to the newest edition, loading `data/YYYY-MM-DD.json` for that date.
3. A date picker, prev/next arrows, and an archive strip let readers browse past editions.
4. An external script commits two files each day: the new dated JSON and an updated `index.json`.
5. Vercel detects the push and redeploys automatically (typically under 30 seconds).

---

## Data layout

```
data/
  index.json          ← ordered list of all available dates (newest first)
  2026-06-03.json     ← one file per edition
  2026-06-04.json
  ...
```

### `data/index.json`

A JSON array of date strings, newest first:

```json
["2026-06-04", "2026-06-03", "2026-06-02"]
```

### `data/YYYY-MM-DD.json`

```json
{
  "date": "2026-06-04",
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

Use the **GitHub Contents API** (no `git` binary required on the runner). Each day, commit **two files**: the new dated JSON and the updated `index.json`.

### Required repo details

| Field | Value |
|-------|-------|
| **Owner** | `mister-phelps` |
| **Repo** | `rassegna` |
| **Branch** | `main` |
| **New edition path** | `data/YYYY-MM-DD.json` |
| **Index path** | `data/index.json` |

### Endpoint (per file)

```
PUT https://api.github.com/repos/mister-phelps/rassegna/contents/{path}
```

### Request body

```json
{
  "message": "chore: daily update 2026-06-04",
  "content": "<base64-encoded file content>",
  "sha":     "<current SHA of the file, required for updates; omit for new files>",
  "branch":  "main"
}
```

For a **new** dated file (which won't exist yet), omit `sha`. For `index.json` (which already exists), always fetch the current SHA first.

### Minimal Python example

```python
import base64, json, os
import urllib.request

OWNER  = "mister-phelps"
REPO   = "rassegna"
BRANCH = "main"
TOKEN  = os.environ["GITHUB_TOKEN"]  # fine-grained PAT, Contents: read+write

API     = f"https://api.github.com/repos/{OWNER}/{REPO}/contents"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
}

def gh(method, path, body=None):
    url  = f"{API}/{path}"
    data = json.dumps(body).encode() if body else None
    req  = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def b64(obj):
    return base64.b64encode(
        json.dumps(obj, ensure_ascii=False, indent=2).encode()
    ).decode()

today = "2026-06-04"

new_edition = {
    "date": today,
    "articles": [
        # ... your AI-generated articles ...
    ]
}

# 1. Commit the new dated file (no SHA needed — file doesn't exist yet)
gh("PUT", f"data/{today}.json", {
    "message": f"chore: daily update {today}",
    "content": b64(new_edition),
    "branch":  BRANCH,
})

# 2. Fetch current index.json SHA, prepend today's date, commit
idx_current = gh("GET", "data/index.json")
old_dates   = json.loads(base64.b64decode(idx_current["content"]))
new_index   = [today] + [d for d in old_dates if d != today]  # prepend, no duplicates

gh("PUT", "data/index.json", {
    "message": f"chore: update index for {today}",
    "content": base64.b64encode(
        json.dumps(new_index, indent=2).encode()
    ).decode(),
    "sha":    idx_current["sha"],
    "branch": BRANCH,
})

print(f"Done — Vercel will redeploy shortly with {len(new_index)} editions available.")
```

### Required GitHub token scopes

Create a **fine-grained personal access token** (Settings → Developer settings → Fine-grained tokens) with:
- **Repository access:** only `rassegna`
- **Permissions → Contents:** Read and write

---

## Local development

Open `index.html` via a local HTTP server (not `file://` — fetch won't work without one):

```bash
python -m http.server 8080
# then open http://localhost:8080
```

---

## Deployment

The site is deployed on [Vercel](https://vercel.com) as a static project. `vercel.json` sets a 5-minute cache on JSON files so repeat visitors get fast loads while still picking up the daily update promptly.
