import React, { useEffect, useState } from "react";
import type { TurnPromptPayload } from "../state/types.js";

interface TurnCountdownProps {
  prompt: TurnPromptPayload | null;
  timerEnabled?: boolean;
  turnDurationSeconds?: number;
}

export const TurnCountdown: React.FC<TurnCountdownProps> = ({
  prompt,
  timerEnabled = true,
  turnDurationSeconds = 90,
}) => {
  const [remainingSec, setRemainingSec] = useState<number | null>(null);

  useEffect(() => {
    if (!timerEnabled || !prompt || !prompt.deadline) {
      setRemainingSec(null);
      return;
    }

    // Clock-skew correction: localTime - serverTime
    const skewMs = Date.now() - prompt.serverTime;
    const adjustedDeadline = prompt.deadline + skewMs;

    const updateTimer = () => {
      const now = Date.now();
      const diffMs = Math.max(0, adjustedDeadline - now);
      setRemainingSec(Math.ceil(diffMs / 1000));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 250);

    return () => clearInterval(interval);
  }, [prompt, timerEnabled]);

  if (!timerEnabled || remainingSec === null) {
    return null;
  }

  const duration = Math.max(1, turnDurationSeconds);
  const percent = Math.min(100, Math.max(0, (remainingSec / duration) * 100));

  let color = "bg-cyan-500";
  if (remainingSec <= 15) {
    color = "bg-red-600 animate-pulse";
  } else if (remainingSec <= 30) {
    color = "bg-amber-400";
  }

  return (
    <div
      role="timer"
      aria-label="Turn countdown"
      className="flex items-center gap-2 w-full px-2 py-0.5 text-[9px] font-mono"
    >
      <span className="font-bold whitespace-nowrap">{remainingSec}s</span>
      <div
        role="progressbar"
        aria-valuenow={remainingSec}
        aria-valuemin={0}
        aria-valuemax={duration}
        className="relative flex-1 h-1.5 bg-slate-900/40 rounded overflow-hidden border border-slate-900/60"
      >
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
