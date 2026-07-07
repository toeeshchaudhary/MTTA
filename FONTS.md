# Fonts setup — RM Neue

This site uses **RM Neue VF**, a **commercial** typeface from [CoType Foundry](https://cotypefoundry.com).
Its license forbids putting the raw `.ttf` files in a **public** repo, so the fonts are **not**
committed here. Instead they live in a private repo and are downloaded automatically when the
site builds.

You only have to do the one-time setup below. After that it's fully automatic.

---

## How it works (30-second version)

```
Private repo                Build (Vercel)                 Visitor
toeeshchaudhary/            scripts/fetch-fonts.mjs         sees RM Neue ✓
rm-neue-fonts   ──token──▶  writes public/fonts/*.ttf  ──▶
(fonts/*.ttf)               then runs `next build`
```

- `public/fonts/RMNeueVF-*.ttf` is **gitignored** — never committed.
- The `build` script is `node scripts/fetch-fonts.mjs && next build`.
- `scripts/fetch-fonts.mjs` downloads the fonts from the private repo using a token in
  the `FONT_REPO_TOKEN` env var.
- **No token? The build still succeeds** and the site uses its fallback font — it never breaks.

---

## One-time setup

### 1. Create a read-only token

1. Go to **GitHub → Settings → Developer settings → Fine-grained tokens**
   (direct link: <https://github.com/settings/tokens?type=beta>).
2. Click **Generate new token**.
3. Fill in:
   - **Token name:** `vercel-rm-neue-fonts`
   - **Expiration:** 1 year (or "No expiration" if you prefer)
   - **Resource owner:** `toeeshchaudhary`
   - **Repository access:** *Only select repositories* → pick **`rm-neue-fonts`**
   - **Permissions → Repository permissions → Contents:** set to **Read-only**
4. Click **Generate token** and **copy it** (you won't see it again).

### 2. Add it to Vercel

For **this project** in Vercel:

1. Open the project → **Settings → Environment Variables**.
2. Add a new variable:
   - **Key:** `FONT_REPO_TOKEN`
   - **Value:** *(paste the token from step 1)*
   - **Environments:** tick **Production** and **Preview**
3. **Save**, then **redeploy** (Deployments → ⋯ → Redeploy) so the new variable is picked up.

> Do this for **both** `toeesh.dev` and `life` — they share the same private font repo, so
> the **same token works for both**.

That's it. RM Neue now renders on the deployed site.

---

## Local development

Nothing to do — the real font files already sit in your local `public/fonts/`
(they're gitignored, so they stay on your machine). The fetch script sees them and skips.

If you ever set up a **fresh clone** and want RM Neue locally, run once:

```bash
FONT_REPO_TOKEN=<your-token> node scripts/fetch-fonts.mjs
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Deployed site shows a different (fallback) font | `FONT_REPO_TOKEN` missing or wrong in Vercel | Re-check step 2; make sure it's set for the environment you deployed to, then redeploy |
| Build log says `FONT_REPO_TOKEN not set` | No token in that environment | Add it for Production **and** Preview |
| Build log says `could not fetch ... HTTP 404` | Token lacks access to `rm-neue-fonts` | Regenerate the token with **Contents: Read** on that repo |
| Local `dev` shows fallback font | Fonts not in local `public/fonts/` | Run the fetch command above, or copy the `.ttf` files in manually |

---

## Do not

- ❌ Commit `RMNeueVF-*.ttf` to this (public) repo.
- ❌ Make `toeeshchaudhary/rm-neue-fonts` public.

Both would breach the CoType Foundry license.
