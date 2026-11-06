"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

export interface NavigationOptions {
  fullScreen?: boolean;
  label?: string;
}

interface NavigationContextType {
  isNavigating: boolean;
  navigationOptions: NavigationOptions;
  startNavigation: (href?: string, options?: NavigationOptions) => void;
  endNavigation: () => void;
}

const NavigationContext = createContext<NavigationContextType>({
  isNavigating: false,
  navigationOptions: {},
  startNavigation: () => {},
  endNavigation: () => {},
});

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationOptions, setNavigationOptions] = useState<NavigationOptions>({});
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const endNavigation = useCallback(() => {
    setIsNavigating(false);
    setNavigationOptions({});
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startNavigation = useCallback(
    (href?: string, options?: NavigationOptions) => {
      // If navigating to the exact same URL, skip
      if (href) {
        try {
          const currentUrl = `${window.location.pathname}${window.location.search}`;
          if (href === currentUrl) return;
        } catch {
          // Ignore
        }
      }

      setNavigationOptions(options || {});
      setIsNavigating(true);

      // Safety timeout: automatically reset after 4 seconds in case navigation is aborted
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setIsNavigating(false);
        setNavigationOptions({});
      }, 4000);
    },
    []
  );

  // Complete navigation when route changes
  useEffect(() => {
    endNavigation();
  }, [pathname, searchParams, endNavigation]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <NavigationContext.Provider
      value={{ isNavigating, navigationOptions, startNavigation, endNavigation }}
    >
      {/* Subtle top loading progress bar on route transitions - no duplicate modal card */}
      {isNavigating && (
        <div
          className="fixed top-0 left-0 right-0 z-[9999] h-0.5 overflow-hidden bg-transparent pointer-events-none"
          aria-hidden="true"
        >
          <div className="h-full w-full bg-gradient-to-r from-[#0274BB] via-[#FFD600] to-[#0274BB] animate-pulse" />
        </div>
      )}
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigationTransition() {
  return useContext(NavigationContext);
}
