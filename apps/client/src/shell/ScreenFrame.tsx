import React from "react";

interface ScreenFrameProps {
  children: React.ReactNode;
  scanlinesEnabled?: boolean;
  announcement?: string | null;
}

export const ScreenFrame: React.FC<ScreenFrameProps> = ({
  children,
  scanlinesEnabled = true,
  announcement = null,
}) => {
  return (
    <div className="relative flex flex-col flex-1 min-h-0 w-full bg-bezel-dark p-2 sm:p-2.5 rounded-lg border-2 border-slate-900 shadow-inner">
      {/* Speaker grill slits on top of screen bezel */}
      <div className="flex justify-center gap-1.5 mb-1.5 flex-shrink-0">
        <div className="w-5 h-1 bg-slate-900/60 rounded-full" />
        <div className="w-5 h-1 bg-slate-900/60 rounded-full" />
        <div className="w-5 h-1 bg-slate-900/60 rounded-full" />
      </div>

      {/* Main LCD Screen Container */}
      <div className="relative flex flex-col flex-1 min-h-0 w-full rounded overflow-hidden lcd-screen lcd-inset border border-slate-900/50">
        {/* Child Screen Contents */}
        <div className="relative z-10 flex flex-col flex-1 min-h-0 w-full h-full p-1.5 sm:p-2 overflow-y-auto">
          {children}
        </div>

        {/* Optional CRT Scanlines Shader */}
        {scanlinesEnabled && (
          <div className="absolute inset-0 scanlines pointer-events-none z-20 opacity-70" />
        )}
      </div>

      {/* Bottom decorative details */}
      <div className="flex justify-between items-center px-2 mt-1.5 text-[8px] text-slate-500 font-mono flex-shrink-0">
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-red-600/80" />
          <div className="w-1.5 h-1.5 rounded-full bg-slate-600/60" />
        </div>
      </div>

      {/* Accessibility screen-reader live region */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    </div>
  );
};
