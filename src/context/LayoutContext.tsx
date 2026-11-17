import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import type { LayoutPreference } from '../types/kali';
import {
  resolveEffectiveLayout,
  type EffectiveLayoutState,
} from '../lib/domain/responsive-layout';

interface LayoutContextValue extends EffectiveLayoutState {
  setPreference: (next: LayoutPreference) => Promise<void>;
  resetToAutomatic: () => Promise<void>;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

function readWindowDimensions(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 800 };
  }
  const w = Math.max(240, window.innerWidth || document.documentElement?.clientWidth || 1280);
  const h = Math.max(240, window.innerHeight || document.documentElement?.clientHeight || 800);
  return { width: w, height: h };
}

export const LayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { layoutPreference, setLayoutPreference } = useAuth();
  const [viewport, setViewport] = useState<{ width: number; height: number }>(() =>
    readWindowDimensions(),
  );
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMeasure = () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const next = readWindowDimensions();
        setViewport((prev) =>
          prev.width === next.width && prev.height === next.height ? prev : next,
        );
      });
    };

    // Initial measure right after hydration
    handleMeasure();

    window.addEventListener('resize', handleMeasure, { passive: true });
    window.addEventListener('orientationchange', handleMeasure, { passive: true });
    const screenOrientation = window.screen?.orientation;
    screenOrientation?.addEventListener?.('change', handleMeasure);

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      window.removeEventListener('resize', handleMeasure);
      window.removeEventListener('orientationchange', handleMeasure);
      screenOrientation?.removeEventListener?.('change', handleMeasure);
    };
  }, []);

  const resolved = useMemo(
    () => resolveEffectiveLayout(layoutPreference, viewport.width, viewport.height),
    [layoutPreference, viewport.width, viewport.height],
  );

  // Sync semantic attributes onto <html> so CSS layout adapters update immediately with zero reload
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-layout-pref', resolved.preference);
    root.setAttribute('data-layout-effective', resolved.effectiveLayout);
    root.setAttribute('data-physical-tier', resolved.physicalTier);
    root.setAttribute('data-breakpoint-band', resolved.breakpointBand);
    root.setAttribute('data-orientation', resolved.orientation);
    root.setAttribute('data-landscape-phone', resolved.isLandscapePhone ? 'true' : 'false');
    root.setAttribute('data-safe-constrained', resolved.isSafeConstrained ? 'true' : 'false');
  }, [resolved]);

  const setPreference = useCallback(
    async (next: LayoutPreference) => {
      await setLayoutPreference(next);
    },
    [setLayoutPreference],
  );

  const resetToAutomatic = useCallback(async () => {
    await setLayoutPreference('automatic');
  }, [setLayoutPreference]);

  const value = useMemo<LayoutContextValue>(
    () => ({
      ...resolved,
      setPreference,
      resetToAutomatic,
    }),
    [resolved, setPreference, resetToAutomatic],
  );

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
};

export function useLayout(): LayoutContextValue {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    throw new Error('useLayout must be used inside LayoutProvider');
  }
  return ctx;
}
