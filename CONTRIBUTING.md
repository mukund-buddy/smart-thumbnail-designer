# Contributing

Thanks for wanting to help. This repo is unusual in one way: the **deployable
site is committed static output**, while the React/TypeScript source lives in
`source/`. Keep that split in mind for every change.

## Repo layout

| Path | What it is | How you edit it |
| --- | --- | --- |
| `index.html`, `assets/`, `*.png` | The compiled site - what gets hosted | **Never edit by hand.** These are rebuild artifacts. |
| `source/` | The real application code | Edit here |
| `CONTRIBUTING.md`, `SECURITY.md`, `README.md` | Docs | Edit directly |

## Local setup (one time)

```bash
git clone https://github.com/mukund-buddy/smart-thumbnail-designer.git
cd smart-thumbnail-designer/source
npm install
npm run dev                   # dev server on http://localhost:3210
```

- Port **3210** is deliberate (3000 collides with other local dev servers).
- The dev server reads `source/.env.local` if it exists - copy
  `.env.example` to `.env.local` if you want AI features while developing.
  `.env*` files are git-ignored and must never be committed.

## Workflow for a code change

1. Create a branch: `git switch -c feature/short-kebab-name`
2. Make the change in `source/`.
3. Make the checks pass (all three):

   ```bash
   npm run lint                 # tsc --noEmit, must be clean
   npm run build -- --base=./   # must succeed
   npm run preview              # then test the real flows in a browser
   ```

4. Rebuild artifacts into the root:

   ```bash
   cp -r source/dist/* ..       # Windows: Copy-Item source\dist\* .. -Recurse -Force
   ```

5. Commit **both** `source/` changes and the rebuilt root files together, so
   the repo is always consistent. One logical change per commit.

## Commit message style

- First line: short imperative summary (<= 72 chars), no trailing period.
- Blank line, then a bulleted body: what changed, why, and what was verified.
- Prefix types used here: `Fix:`, `Add:`, `Security:`, `Refactor:`,
  `Docs:`, `Notes:`.

## Pull requests

- Keep PRs small and single-purpose. Split unrelated work into separate PRs.
- Describe: what changed, why, how you tested it (flows + browsers).
- UI changes: include before/after screenshots in the PR description.
- CI-free process today: a maintainer will run the three checks from step 3.

## Docs rules

- **No emojis** in headings, body or tables. If emphasis is needed use bold,
  code formatting, tables, callout blockquotes, or a real SVG asset.
- Everything users should know lives in `README.md`; contributor process
  here; security expectations in `SECURITY.md`.

## Where to start

Issues tagged `good first issue` are scoped to be small and self-contained.
`enhancement` issues are open proposals - comment on one before starting a
big change, so we do not duplicate work.
