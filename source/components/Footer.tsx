
import React from 'react';

/**
 * Site footer bar. Extracted from App.tsx so it can be edited separately:
 * change the copyright year, brand line or links here without touching the
 * rest of the app.
 */
export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-zinc-900 p-6 text-center text-zinc-600 text-[10px] uppercase tracking-widest">
      <p>&copy; {new Date().getFullYear()} Smart Thumbnail Designer. Powered by Google Gemini AI &amp; Nano Banana.</p>
    </footer>
  );
};
