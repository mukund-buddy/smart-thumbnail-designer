import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Build-time-only CSP injection (dev server stays clean so HMR keeps working).
 *
 * A <meta> CSP cannot enforce frame-ancestors / X-Frame-Options (those need real
 * HTTP response headers) — GitHub Pages ignores them — but it still blocks
 * foreign & inline script execution and remote image/data exfil in every major
 * browser, which is the main win for a static-hosted SPA.
 */
const cspPlugin = (): Plugin => ({
  name: 'inject-csp-meta',
  apply: 'build',
  transformIndexHtml(html) {
    const csp = [
      "default-src 'self'",
      // Only same-origin bundles; no third-party scripts are loaded anymore
      // (Tailwind is compiled in, so the old cdn.tailwindcss.com script-tag
      // hole is gone).
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
      "img-src 'self' data: blob: https://i.ytimg.com https://images.weserv.nl https://img.weserv.nl",
      "connect-src 'self' https://generativelanguage.googleapis.com https://i.ytimg.com https://images.weserv.nl https://img.weserv.nl",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'none'"
      // NOTE: frame-ancestors is deliberately omitted — it is ignored (with a
      // console error) when delivered via <meta> and only works as an HTTP
      // header. Static hosts can't set headers, so the header variant belongs
      // in an unsupported level of hosting anyway.
    ].join('; ');
    return html.replace(
      '<title>',
      `<meta http-equiv="Content-Security-Policy" content="${csp}">\n    <title>`
    );
  }
});

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');

    /**
     * Guard: never silently bake a real API key into a deployable production
     * bundle — anyone who opens devtools can read it there. Public/hosted
     * builds ship WITHOUT a key; users paste theirs into the in-app session
     * key card instead (in-memory only, wiped on reload).
     *
     * Truly solo builds (you know the bundle will never leave your machine)
     * can opt in with ALLOW_INLINE_KEY=1.
     */
    const rawKey = env.GEMINI_API_KEY;
    let apiKey = '';
    if (rawKey) {
      if (mode === 'production' && env.ALLOW_INLINE_KEY !== '1') {
        console.warn(
          '\n[vite] ⚠ GEMINI_API_KEY found in env but NOT inlined into this production build.' +
          '\n[vite]   Baked-in keys are readable by anyone who loads the JS bundle.' +
          '\n[vite]   The public build ships key-less: users add theirs via the in-app key card.' +
          '\n[vite]   Solo-only override: set ALLOW_INLINE_KEY=1 in .env.local.\n'
        );
      } else {
        apiKey = rawKey;
      }
    }

    return {
      server: {
        // Port 3000 often collides with other local dev servers (Next.js etc.)
        // so we use 3210. Vite will silently pick the next free port if busy.
        port: 3210,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss(), cspPlugin()],
      define: {
        'process.env.API_KEY': JSON.stringify(apiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
