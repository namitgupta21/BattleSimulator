import { useCallback, useEffect, useState } from "react";

export interface MenuNavigationOptions {
  itemCount: number;
  columns?: number;
  initialIndex?: number;
  disabledIndices?: number[];
  wrap?: boolean;
  onSelect?: (index: number) => void;
  onCancel?: () => void;
}

export function useMenuNavigation({
  itemCount,
  columns = 1,
  initialIndex = 0,
  disabledIndices = [],
  wrap = true,
  onSelect,
  onCancel,
}: MenuNavigationOptions) {
  const [selectedIndex, setSelectedIndex] = useState<number>(() => {
    if (disabledIndices.includes(initialIndex)) {
      for (let i = 0; i < itemCount; i++) {
        if (!disabledIndices.includes(i)) return i;
      }
    }
    return Math.min(Math.max(0, initialIndex), Math.max(0, itemCount - 1));
  });

  useEffect(() => {
    if (itemCount > 0 && selectedIndex >= itemCount) {
      setSelectedIndex(itemCount - 1);
    }
  }, [itemCount, selectedIndex]);

  const isIndexDisabled = useCallback(
    (idx: number) => disabledIndices.includes(idx),
    [disabledIndices]
  );

  const findNextValid = useCallback(
    (start: number, step: number): number => {
      if (itemCount === 0) return 0;
      let curr = start;
      for (let attempt = 0; attempt < itemCount; attempt++) {
        curr += step;
        if (wrap) {
          curr = ((curr % itemCount) + itemCount) % itemCount;
        } else {
          if (curr < 0 || curr >= itemCount) {
            return start;
          }
        }
        if (!isIndexDisabled(curr)) {
          return curr;
        }
      }
      return start;
    },
    [itemCount, wrap, isIndexDisabled]
  );

  const moveUp = useCallback(() => {
    setSelectedIndex((prev) => findNextValid(prev, -columns));
  }, [findNextValid, columns]);

  const moveDown = useCallback(() => {
    setSelectedIndex((prev) => findNextValid(prev, columns));
  }, [findNextValid, columns]);

  const moveLeft = useCallback(() => {
    setSelectedIndex((prev) => findNextValid(prev, -1));
  }, [findNextValid]);

  const moveRight = useCallback(() => {
    setSelectedIndex((prev) => findNextValid(prev, 1));
  }, [findNextValid]);

  const select = useCallback(() => {
    if (!isIndexDisabled(selectedIndex) && onSelect) {
      onSelect(selectedIndex);
    }
  }, [isIndexDisabled, selectedIndex, onSelect]);

  const cancel = useCallback(() => {
    onCancel?.();
  }, [onCancel]);

  return {
    selectedIndex,
    setSelectedIndex,
    moveUp,
    moveDown,
    moveLeft,
    moveRight,
    select,
    cancel,
    isIndexSelected: (idx: number) => idx === selectedIndex,
    isIndexDisabled,
  };
}
