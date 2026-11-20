import React, { useEffect, useRef } from "react";

interface MobileLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const MobileLogDrawer: React.FC<MobileLogDrawerProps> = ({
  isOpen,
  onClose,
  children,
}) => {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "b" || e.key === "B") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Battle Log"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm md:hidden"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col w-full max-w-sm h-[85dvh] bg-pokedex-darkred rounded-xl p-3 border-4 border-slate-950 shadow-2xl overflow-hidden"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b-2 border-slate-900">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse border border-slate-900" />
            <h3 className="text-xs font-bold text-white tracking-wider">BATTLE LOG</h3>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close Battle Log"
            className="px-2 py-1 text-[10px] bg-red-600 hover:bg-red-500 text-white font-bold rounded border border-slate-950 active:scale-95"
          >
            CLOSE [B]
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
};
