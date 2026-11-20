import React, { useEffect, useState } from "react";

interface DialogueBoxProps {
  message: string | null;
  onAdvance?: () => void;
  onCancel?: () => void;
  isWaiting?: boolean;
}

export const DialogueBox: React.FC<DialogueBoxProps> = ({
  message,
  onAdvance,
  onCancel,
  isWaiting = false,
}) => {
  const [displayedLength, setDisplayedLength] = useState<number>(0);

  useEffect(() => {
    setDisplayedLength(0);
    if (!message) return;

    const interval = setInterval(() => {
      setDisplayedLength((prev) => {
        if (prev >= message.length) {
          clearInterval(interval);
          return message.length;
        }
        return prev + 1;
      });
    }, 18);

    return () => clearInterval(interval);
  }, [message]);

  if (!message) return null;

  const isComplete = displayedLength >= message.length;

  const handleClick = () => {
    if (!isComplete) {
      setDisplayedLength(message.length);
    } else if (!isWaiting) {
      onAdvance?.();
    }
  };

  return (
    <div
      role="region"
      aria-live="polite"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      className="relative flex items-center justify-between w-full min-h-[44px] px-3 py-2 rounded bg-slate-900/80 border-2 border-slate-950 text-slate-100 text-[10px] leading-relaxed cursor-pointer shadow-sm select-none"
    >
      <div className="flex-1 pr-2">
        <span>{message.slice(0, displayedLength)}</span>
        {isWaiting && (
          <span className="inline-block ml-1 animate-pulse">...</span>
        )}
      </div>

      {isWaiting && onCancel && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          aria-label="Cancel move selection (B)"
          className="px-2.5 py-1 bg-red-600 hover:bg-red-500 active:scale-95 text-white rounded text-[9px] font-bold border border-red-800 shadow transition-all ml-2 flex-shrink-0"
        >
          CANCEL [B]
        </button>
      )}

      {onAdvance && !isWaiting && isComplete && (
        <span aria-hidden="true" className="text-[10px] text-cyan-400 animate-bounce">
          ▼
        </span>
      )}
    </div>
  );
};
