import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMenuNavigation } from "../src/navigation/useMenuNavigation.js";

describe("useMenuNavigation", () => {
  it("navigates 1D list vertically with wrapping", () => {
    const { result } = renderHook(() =>
      useMenuNavigation({
        itemCount: 4,
        columns: 1,
        wrap: true,
      })
    );

    expect(result.current.selectedIndex).toBe(0);

    act(() => result.current.moveDown());
    expect(result.current.selectedIndex).toBe(1);

    act(() => result.current.moveDown());
    expect(result.current.selectedIndex).toBe(2);

    act(() => result.current.moveDown());
    expect(result.current.selectedIndex).toBe(3);

    // Wrap back to 0
    act(() => result.current.moveDown());
    expect(result.current.selectedIndex).toBe(0);

    // Move up wraps to last item
    act(() => result.current.moveUp());
    expect(result.current.selectedIndex).toBe(3);
  });

  it("navigates 2x2 grid horizontally and vertically", () => {
    const { result } = renderHook(() =>
      useMenuNavigation({
        itemCount: 4,
        columns: 2,
        wrap: true,
      })
    );

    expect(result.current.selectedIndex).toBe(0);

    // Move right moves by +1 (col 1)
    act(() => result.current.moveRight());
    expect(result.current.selectedIndex).toBe(1);

    // Move down moves by +2 (row 1, col 1 = index 3)
    act(() => result.current.moveDown());
    expect(result.current.selectedIndex).toBe(3);

    // Move left moves by -1 (row 1, col 0 = index 2)
    act(() => result.current.moveLeft());
    expect(result.current.selectedIndex).toBe(2);
  });

  it("skips disabled items during navigation", () => {
    const { result } = renderHook(() =>
      useMenuNavigation({
        itemCount: 4,
        columns: 1,
        disabledIndices: [1],
      })
    );

    expect(result.current.selectedIndex).toBe(0);

    // Moving down skips index 1 and goes directly to index 2
    act(() => result.current.moveDown());
    expect(result.current.selectedIndex).toBe(2);

    // Moving up skips index 1 and goes back to index 0
    act(() => result.current.moveUp());
    expect(result.current.selectedIndex).toBe(0);
  });

  it("calls onSelect with selected index on select()", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useMenuNavigation({
        itemCount: 3,
        onSelect,
      })
    );

    act(() => result.current.moveDown());
    act(() => result.current.select());

    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("does not call onSelect if current index is disabled", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useMenuNavigation({
        itemCount: 3,
        initialIndex: 0,
        disabledIndices: [0, 1, 2],
        onSelect,
      })
    );

    act(() => result.current.select());
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("calls onCancel on cancel()", () => {
    const onCancel = vi.fn();
    const { result } = renderHook(() =>
      useMenuNavigation({
        itemCount: 3,
        onCancel,
      })
    );

    act(() => result.current.cancel());
    expect(onCancel).toHaveBeenCalled();
  });
});
