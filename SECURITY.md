# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Use GitHub's
"Report a vulnerability" button on this repo (Security tab), or contact the
maintainer through GitHub. You will get a response within a few days.

Include: what you found, how to reproduce it, and (if you can) what a fix
would look like. Do not include real API keys in any report.

## What this project promises

- The deployable site contains **no API keys and no secrets**. The key a user
  pastes into the app lives only in that browser tab's memory.
- The key (and any image data) goes only to these hosts:
  `generativelanguage.googleapis.com`, `i.ytimg.com`, `images.weserv.nl`.
  No other third party ever receives user data.
- A strict Content-Security-Policy is embedded in `index.html`.
- Any external stylesheet (Font Awesome) is SRI-pinned with a `sha512` hash.

## In scope

- Anything shipped at the repo root (the static site).
- The build process in `source/` that produces it.
- Anything that would put or leak a key into the bundle.

## Out of scope

- The Google API itself and your own Google account security.
- Compromise of the hosting platform (GitHub Pages / Netlify etc.).
- Issues that require a malicious host that swapped the files - verify you
  are on the official pages URL before testing.

If you deploy your own copy, the security promise applies only to files you
have not modified and hosts you control.
