# Hosting walk-through

> Three ways to put this app online in under five minutes. All steps use the
> files already committed at the repo root - no Node.js and no build step is
> needed for hosting. Rebuilding is only required after code changes
> (see [README - Rebuilding from source](README.md#rebuilding-from-source)).

## Option 1 - GitHub Pages (this repo already does it)

1. Open the repo on GitHub, go to **Settings > Pages**.
2. Under **Build and deployment**, set Source to **Deploy from a branch**.
3. Choose branch `main` and folder **/ (root)**, then **Save**.
4. Wait 1-2 minutes for the "pages build and deployment" action to finish.
5. The site is live at:
   `https://mukund-buddy.github.io/smart-thumbnail-designer/`

Notes:

- Every push to `main` redeploys automatically (see the
  [Actions tab](https://github.com/mukund-buddy/smart-thumbnail-designer/actions)).
- The CI workflow builds the React source in `source/` on every push so a
  broken code change is caught before it reaches the site.

## Option 2 - Cloudflare Pages

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com), pick
   **Workers & Pages > Create > Pages > Connect to Git**.
2. Authorize GitHub and select the repository
   `mukund-buddy/smart-thumbnail-designer`.
3. On the build settings screen, **leave the build command and output
   directory empty** - the repo root is already the finished static site.
4. Click **Save and Deploy**. First deployment lands in about a minute.
5. Cloudflare assigns an `*.pages.dev` URL; bind a custom domain later under
   the project's **Custom domains** tab if you want one.

## Option 3 - Netlify (drag and drop, no Git needed)

1. Download the repository as a ZIP (Code button > **Download ZIP**), unzip it.
2. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
3. Drag the unzipped folder (the one containing `index.html`) onto the page.
4. Netlify gives you an instant `*.netlify.app` URL.
5. Optional: connect the folder as a site (via **Import from Git** on the
   site settings) so future pushes redeploy automatically.

## Any other host

The site is plain static files with **relative asset paths** (`./assets/...`),
so it also works:

- in a **subfolder** of an existing website (copy `index.html`, `assets/`,
  `favicon.png`, `logo.png`),
- on a subdomain or a custom domain,
- locally via any static server (`npx serve .`) — opening `index.html`
  directly without a server will not work, because browsers block ES modules
  on `file://` URLs.

## After you deploy

- App behaviour is identical on every host: the Gemini key you paste stays in
  that browser tab only, and goes directly from your browser to Google.
- YouTube thumbnail fetching needs no key on any host.
- If you add the site to a host under a different sub-path, the relative-base
  build keeps assets resolving correctly - no rebuild needed for standard
  deployments.
