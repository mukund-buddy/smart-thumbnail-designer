
import React from 'react';

/**
 * Site footer bar. Extracted from App.tsx so it can be edited separately:
 * change the copyright year, brand line or links here without touching the
 * rest of the app.
 */
export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-zinc-900 p-6 text-center text-zinc-600 text-[10px] uppercase tracking-widest">
      <p>&copy; 2024 Smart Thumbnail AI. Powered by Google Gemini AI & Nano Banana.</p>
    </footer>
  );
};
