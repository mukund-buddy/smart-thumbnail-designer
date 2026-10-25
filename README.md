<div align="center">

<img src="logo.png" alt="Smart Thumbnail Designer logo" width="140" />

# Smart Thumbnail Designer

**An AI-powered thumbnail editor that runs as a plain static website.**
Paste a YouTube link or upload any image, let Gemini detect every element,
remove or replace them with plain-English commands, then export in
ready-to-post sizes for YouTube, Instagram and TikTok.

![Static](https://img.shields.io/badge/Build-Static%20HTML%2FCSS%2FJS-blue)
![No Node](https://img.shields.io/badge/Hosting-No%20Node%20required-purple)
![Key](https://img.shields.io/badge/API%20key-Session%20only,%20auto%20wipe-green)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

</div>

---

## Why this repo exists

This is the **no-Node edition** of [Smart Thumbnail AI Editor](https://github.com/mukund-buddy/Smart-Thumbnail-AI-Editor).
The full React/TypeScript app is already compiled for you and committed as
plain static files. There is no `package.json` to install, no build step to
run and no server to maintain at the repo root. Anyone can:

1. clone or download these files,
2. put them on any static host (or even a subfolder of an existing site),
3. done - the app is live.

Node.js is **never** needed to run it. It is only needed if you want to
change the code itself (see [Rebuilding from source](#rebuilding-from-source)).

## What it can do

- **YouTube import** - paste any video link or bare video ID and the official
  thumbnail is pulled from YouTube's public image servers. Needs no key and
  has no quota.
- **Element detection** - Gemini scans the thumbnail and lists every visible
  element (characters, mobs, text overlays, weapons, logos, UI) as clickable
  tags.
- **Remove / replace** - delete elements in one click, or describe a swap in
  plain English with an optional replacement image.
- **Auto enhance** - one-click color, sharpening and 1080p upscale pass.
- **Export presets** - native sizes for YouTube video, Shorts/Reels, Instagram
  post and TikTok, plus full-resolution download.
- **Works without a key until you need AI** - fetch, crop, selection, export
  all run with zero API keys. Add your Gemini key only when you want the AI
  features.

## Run it right now

| Option | Steps |
| --- | --- |
| **GitHub Pages** | Repo Settings -> Pages -> Source: `main` branch, root -> your site lives at `https://mukund-buddy.github.io/smart-thumbnail-designer/` |
| **Any static host** | Drag the repo (or just `index.html` + `assets/` + the two PNGs) into Netlify Drop, or connect the repo to Cloudflare Pages / Vercel / any web server |
| **Local preview** | Serve the folder with any web server - e.g. `npx serve .` or the Live Server extension of VS Code. Opening `index.html` directly via a double click will not work because browsers block ES modules on `file://` URLs |

All asset paths are relative (`./assets/...`), so the site also works from a
subfolder, a subdomain or a custom domain without any changes.

## The API key (read this once)

The static edition **never contains an API key** - there is no build step here
that could bake one in. Instead:

1. Open the site and click the key card at the top.
2. Paste your own Gemini key from
   [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
3. The key lives **only in that browser tab's memory**:
   - it is wiped automatically on every page reload / new tab;
   - it is never written to `localStorage`, any disk or any server;
   - optionally tick *Remember for this tab only* to survive refreshes -
     it still disappears the moment you close the tab.
4. The key travels **directly from your browser to Google**. There is no
   middleman in this static deployment that could ever see it.

## Files

```
smart-thumbnail-designer/
├── index.html                  # site shell (has the Content-Security-Policy)
├── assets/
│   ├── index-*.js              # full app bundle (React compiled)
│   └── index-*.css             # Tailwind compiled stylesheet
├── logo.png / favicon.png      # brand images
├── source/                     # the original React/TypeScript app (read/edit)
│   ├── App.tsx, index.tsx, index.css
│   ├── components/  (Header, Footer, Button)
│   ├── services/    (geminiService, youtubeService, keyStore)
│   └── vite.config.ts, package.json, ...
├── CONTRIBUTING.md             # how to help out
└── SECURITY.md                 # how to report a security issue
```

## Rebuilding from source

You only need this when you want to change the app. Node.js 18+ required.

```bash
cd source
npm install
npm run build -- --base=./     # outputs to source/dist
```

Then copy the contents of `source/dist` back to this repo root and commit.
The `--base=./` flag keeps asset paths relative so the result stays
host-anywhere.

## Security posture

- **Zero third-party scripts** - everything the app executes is same-origin;
  the Tailwind runtime CDN hole does not exist here.
- **Content-Security-Policy** is embedded in `index.html`: only same-origin
  scripts, and allowlisted hosts for images/connect (`i.ytimg.com`,
  `images.weserv.nl`, Google's Generative Language API).
- **Font Awesome** is pinned with a `sha512` SRI integrity hash.
- **No secrets, ever** - keys are session-only by design. See
  [SECURITY.md](SECURITY.md) before reporting anything.

## Contributing

Issues and pull requests are welcome. Start with
[CONTRIBUTING.md](CONTRIBUTING.md) - it covers environment setup, the commands
that must pass before a PR and the commit message style. Good starting points
are tagged [`good first issue`](https://github.com/mukund-buddy/smart-thumbnail-designer/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
on the [issue tracker](https://github.com/mukund-buddy/smart-thumbnail-designer/issues).

## Credits

The app was built as
[Smart Thumbnail AI Editor](https://github.com/mukund-buddy/Smart-Thumbnail-AI-Editor).
This repo carries the same product forward as a ready-to-host static artifact.
The Gemini models ("Nano Banana" image model) and Google AI Studio belong to
Google.

## License

[MIT](LICENSE)
