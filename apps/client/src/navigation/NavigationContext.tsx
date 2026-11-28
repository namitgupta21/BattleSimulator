import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

export interface NavHandlers {
  onUp?: () => void;
  onDown?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  onEnter?: () => void;
  onBack?: () => void;
}

interface NavigationContextValue {
  handlers: NavHandlers;
  registerNav: (handlers: NavHandlers) => () => void;
  setOwnerHandlers: (owner: symbol, handlers: NavHandlers) => void;
  clearOwnerHandlers: (owner: symbol) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const currentHandlersRef = useRef<NavHandlers>({});
  const ownerRef = useRef<symbol | null>(null);

  const setOwnerHandlers = useCallback((owner: symbol, newHandlers: NavHandlers) => {
    ownerRef.current = owner;
    currentHandlersRef.current = newHandlers;
  }, []);

  const clearOwnerHandlers = useCallback((owner: symbol) => {
    if (ownerRef.current === owner) {
      ownerRef.current = null;
      currentHandlersRef.current = {};
    }
  }, []);

  const registerNav = useCallback((newHandlers: NavHandlers) => {
    const owner = Symbol("legacy-nav-owner");
    ownerRef.current = owner;
    currentHandlersRef.current = newHandlers;
    return () => {
      clearOwnerHandlers(owner);
    };
  }, [clearOwnerHandlers]);

  // Stable wrapper functions so updating screen handlers never triggers parent re-render loops
  const [stableHandlers] = useState<NavHandlers>(() => ({
    onUp: () => currentHandlersRef.current.onUp?.(),
    onDown: () => currentHandlersRef.current.onDown?.(),
    onLeft: () => currentHandlersRef.current.onLeft?.(),
    onRight: () => currentHandlersRef.current.onRight?.(),
    onEnter: () => currentHandlersRef.current.onEnter?.(),
    onBack: () => currentHandlersRef.current.onBack?.(),
  }));

  return (
    <NavigationContext.Provider
      value={{
        handlers: stableHandlers,
        registerNav,
        setOwnerHandlers,
        clearOwnerHandlers,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error("useNavigation must be used within NavigationProvider");
  }
  return ctx;
}

export function useRegisterNav(handlers: NavHandlers, _deps: React.DependencyList = []): void {
  const { setOwnerHandlers, clearOwnerHandlers } = useNavigation();
  const ownerRef = useRef<symbol | null>(null);
  if (!ownerRef.current) {
    ownerRef.current = Symbol("nav-owner");
  }

  const latestRef = useRef<NavHandlers>(handlers);
  latestRef.current = handlers;

  useEffect(() => {
    const owner = ownerRef.current!;
    setOwnerHandlers(owner, {
      onUp: () => latestRef.current.onUp?.(),
      onDown: () => latestRef.current.onDown?.(),
      onLeft: () => latestRef.current.onLeft?.(),
      onRight: () => latestRef.current.onRight?.(),
      onEnter: () => latestRef.current.onEnter?.(),
      onBack: () => latestRef.current.onBack?.(),
    });
    return () => {
      clearOwnerHandlers(owner);
    };
  }, [setOwnerHandlers, clearOwnerHandlers]);
}
