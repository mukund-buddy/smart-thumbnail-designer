
import React from 'react';

/**
 * Site header bar. Extracted from App.tsx so it can be edited separately:
 * change logo, title or tagline here without touching the rest of the app.
 */
export const Header: React.FC = () => {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50 p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="logo.png"
            alt="Smart Thumbnail Designer logo"
            className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(99,102,241,0.6)]"
          />
          <h1 className="text-xl font-bold tracking-tight">Smart Thumbnail <span className="text-indigo-500 italic">Designer</span></h1>
        </div>
        <div className="hidden md:block">
          <p className="text-sm text-zinc-500">Professional YouTube Gaming Editor</p>
        </div>
      </div>
    </header>
  );
};
