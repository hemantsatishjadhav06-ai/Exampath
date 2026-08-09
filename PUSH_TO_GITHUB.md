# Push ExamPath to GitHub — terminal guide

This folder is **already a git repository** (committed, branch `main`, `origin` preset to
your repo). You only need to create the empty GitHub repo and push. Pick one option.

Prereqs: `git` installed. Check with `git --version`. (Windows: install "Git for Windows";
macOS: `xcode-select --install`; Linux: `sudo apt install git`.)

---

## Option A — GitHub CLI (easiest, handles auth for you)

```bash
cd exampath                 # the unzipped project folder
gh auth login               # choose: GitHub.com → HTTPS → "Login with a web browser"
gh repo create exampath --public --source=. --remote=origin --push
```

That's it — it creates the repo and pushes. It prints the repo URL at the end.
(Install gh first if needed: https://cli.github.com/ )

---

## Option B — plain git (no gh)

1. Create an **empty** repo: https://github.com/new → name `exampath` → **Public** →
   do **not** add a README/.gitignore/license → **Create repository**.
2. In the terminal:

```bash
cd exampath
git remote set-url origin https://github.com/hemantsatishjadhav06-ai/exampath.git
git push -u origin main
```

When prompted:
- **Username:** `hemantsatishjadhav06-ai`
- **Password:** a **Personal Access Token** — NOT your account password.
  Create one at github.com → Settings → Developer settings → Personal access tokens →
  Tokens (classic) → Generate new token → tick the **`repo`** scope → copy it and paste
  it as the password.

---

## If it says "nothing to commit" or "src refspec main does not match"

The repo already has commits, but just in case:

```bash
cd exampath
git add -A
git commit -m "Initial commit: ExamPath"   # ok if it says nothing to commit
git branch -M main
git push -u origin main
```

---

## After it's on GitHub → get a live URL

- **Railway** (already connected in your Claude chat): tell me the deploy can proceed, or in
  Railway do New → *Deploy from GitHub repo* → `exampath`. The root `Dockerfile` builds and
  serves the site automatically.
- **Free hosts:** Cloudflare Pages or Render → *connect repo* → build command
  `cd web && node scripts/export-static.mjs`, output directory `web/out`.
- **Instant, no repo at all:** drag the `web/out` folder onto https://app.netlify.com/drop.

Once the site is live, paste me the URL and I'll verify every page looks right.
