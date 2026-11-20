import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

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
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [handlers, setHandlers] = useState<NavHandlers>({});

  const registerNav = useCallback((newHandlers: NavHandlers) => {
    setHandlers(newHandlers);
    return () => {
      setHandlers((prev) => (prev === newHandlers ? {} : prev));
    };
  }, []);

  return (
    <NavigationContext.Provider value={{ handlers, registerNav }}>
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

export function useRegisterNav(handlers: NavHandlers, deps: React.DependencyList = []): void {
  const { registerNav } = useNavigation();
  useEffect(() => {
    return registerNav(handlers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerNav, ...deps]);
}
