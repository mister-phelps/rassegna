# Rassegna

A daily AI-curated briefing on European affairs and international politics. Static site auto-deployed to Vercel; content is updated daily by an external script that commits files via the GitHub REST API.

---

## Architecture

```
data/
  index.json                  ← ordered list of available dates (newest first)
  briefings/
    2026-05-31.md             ← one markdown file per edition
    2026-06-01.md
    ...
```

`index.html` fetches `index.json`, builds the sidebar date list, then loads and renders the selected `.md` file using [marked.js](https://marked.js.org/).

---

## Data format

### `data/index.json`

A JSON array of date strings, newest first:

```json
["2026-06-04", "2026-06-03", "2026-06-02"]
```

### `data/briefings/YYYY-MM-DD.md`

```markdown
# Daily Briefing — Sunday, 31 May 2026

## European Affairs

**Story headline**
Body paragraph with inline [Source Name](https://url) attribution.

### Also noted
- *[Source Name](https://url)*: One-line item.

## European Economy

...
```

**Rules:**
- The `# Daily Briefing — …` heading is required — the site extracts the date label from it.
- `## Section Name` headings become section dividers (EU Affairs, European Economy, International Politics, Defence & Security, Energy & Climate, etc.)
- `**Bold text**` at the start of a paragraph is the story headline.
- `### Also noted` introduces a bullet list of short items.
- All source links should be inline in the text.

---

## How the external update script should commit

Each day, commit **two files** to `mister-phelps/rassegna`, branch `main`:

| File | Action |
|------|--------|
| `data/briefings/YYYY-MM-DD.md` | Create (new file, no SHA needed) |
| `data/index.json` | Update (fetch current SHA first, prepend new date) |

### Endpoint

```
PUT https://api.github.com/repos/mister-phelps/rassegna/contents/{path}
```

### Minimal Python example

```python
import base64, json, os, urllib.request
from datetime import date

OWNER  = "mister-phelps"
REPO   = "rassegna"
BRANCH = "main"
TOKEN  = os.environ["GITHUB_TOKEN"]   # fine-grained PAT, Contents: read+write

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

today    = date.today().isoformat()           # e.g. "2026-06-04"
md_path  = f"data/briefings/{today}.md"

briefing_md = f"""# Daily Briefing — Wednesday, 4 June 2026

## European Affairs

**Story headline**
Body text. [Source](https://url)

### Also noted
- *[Source](https://url)*: One-line item.
"""

# 1. Commit new briefing (new file — no SHA)
gh("PUT", md_path, {
    "message": f"chore: briefing {today}",
    "content": base64.b64encode(briefing_md.encode()).decode(),
    "branch":  BRANCH,
})

# 2. Update index.json (existing file — SHA required)
idx = gh("GET", "data/index.json")
old = json.loads(base64.b64decode(idx["content"]))
new = [today] + [d for d in old if d != today]

gh("PUT", "data/index.json", {
    "message": f"chore: update index for {today}",
    "content": base64.b64encode(json.dumps(new, indent=2).encode()).decode(),
    "sha":     idx["sha"],
    "branch":  BRANCH,
})

print(f"Deployed {today} — {len(new)} editions in archive.")
```

### Token requirements

Fine-grained PAT (Settings → Developer settings → Fine-grained tokens):
- **Repository access:** `rassegna` only
- **Permissions → Contents:** Read and write

---

## Local development

```bash
python -m http.server 8080
# open http://localhost:8080
```

---

## Deployment

Hosted on [Vercel](https://vercel.com) as a static project. Vercel auto-deploys on every push to `main` (typically live in under 30 seconds).
