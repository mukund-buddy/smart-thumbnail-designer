/**
 * Runtime ("session") API key store.
 *
 * SECURITY MODEL (designed for the publicly hosted GitHub Pages build):
 * - By default the key lives ONLY in this module's in-memory variable.
 *   Nothing is written to localStorage, sessionStorage, cookies or disk.
 * - Closing the tab / opening a new one erases it — the site asks again.
 * - Optionally the user can tick "Remember for this tab only", which keeps
 *   it in sessionStorage so a page refresh doesn't ask again, but it still
 *   dies the moment the tab is closed.
 * - The key travels directly browser → Google. No server of ours sees it,
 *   and the whole codebase is open source so anyone can verify that.
 */

const SS_KEY = 'gemini_runtime_key';

let runtimeKey = '';
let rememberedForTab = false;

export const setRuntimeKey = (key: string, rememberForThisTab: boolean): void => {
  runtimeKey = key.trim();
  rememberedForTab = rememberForThisTab;
  if (rememberedForTab && runtimeKey) {
    try { sessionStorage.setItem(SS_KEY, runtimeKey); } catch { /* private mode etc. */ }
  } else {
    try { sessionStorage.removeItem(SS_KEY); } catch { /* ignore */ }
  }
};

/** Call once on app mount. Returns true if a tab-remembered key was restored. */
export const restoreRuntimeKey = (): boolean => {
  try {
    const saved = sessionStorage.getItem(SS_KEY);
    if (saved) {
      runtimeKey = saved;
      rememberedForTab = true;
      return true;
    }
  } catch { /* ignore */ }
  return false;
};

export const clearRuntimeKey = (): void => {
  runtimeKey = '';
  rememberedForTab = false;
  try { sessionStorage.removeItem(SS_KEY); } catch { /* ignore */ }
};

export const getRuntimeKey = (): string => runtimeKey;

export const isRuntimeKeyRemembered = (): boolean => rememberedForTab;
