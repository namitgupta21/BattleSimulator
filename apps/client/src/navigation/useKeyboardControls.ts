import { useEffect, useRef, useState } from "react";

export type ControlButton = "up" | "down" | "left" | "right" | "enter" | "back";

export interface KeyboardControlHandlers {
  onUp?: () => void;
  onDown?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  onEnter?: () => void;
  onBack?: () => void;
  enabled?: boolean;
}

export function useKeyboardControls(handlers: KeyboardControlHandlers) {
  const [activeKey, setActiveKey] = useState<ControlButton | null>(null);
  const handlersRef = useRef<KeyboardControlHandlers>(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  const enabled = handlers.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const h = handlersRef.current;
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isInput && e.key !== "Escape") {
        if (e.key === "Enter" && h.onEnter) {
          e.preventDefault();
          h.onEnter();
        }
        return;
      }

      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          e.preventDefault();
          setActiveKey("up");
          h.onUp?.();
          break;
        case "ArrowDown":
        case "s":
        case "S":
          e.preventDefault();
          setActiveKey("down");
          h.onDown?.();
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          setActiveKey("left");
          h.onLeft?.();
          break;
        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          setActiveKey("right");
          h.onRight?.();
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          setActiveKey("enter");
          h.onEnter?.();
          break;
        case "Escape":
        case "Backspace":
          e.preventDefault();
          setActiveKey("back");
          if (isInput && target) {
            target.blur();
          }
          h.onBack?.();
          break;
      }
    };

    const handleKeyUp = () => {
      setActiveKey(null);
    };

    const handleBlur = () => {
      setActiveKey(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [enabled]);

  return { activeKey };
}
