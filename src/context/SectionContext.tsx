import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  buildDefaultSectionStates,
  evaluateSectionAccess,
  isSectionVisibleInStudentNav,
  isStaffAdminRole,
  type SectionAccessEvaluation,
} from '../lib/domain/sections';
import type { NavSection, PlatformSectionState } from '../types/kali';

interface SectionContextValue {
  sections: PlatformSectionState[];
  loading: boolean;
  previewAsStudent: boolean;
  setPreviewAsStudent: (next: boolean) => void;
  refreshSections: () => Promise<void>;
  getSection: (key: NavSection) => PlatformSectionState | undefined;
  isSectionVisibleInNav: (key: NavSection) => boolean;
  evaluateAccess: (key: NavSection) => SectionAccessEvaluation;
}

const SectionContext = createContext<SectionContextValue | null>(null);

export const SectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [sections, setSections] = useState<PlatformSectionState[]>(() => buildDefaultSectionStates());
  const [loading, setLoading] = useState(true);
  const [previewAsStudent, setPreviewAsStudentState] = useState(false);

  const isStaff = isStaffAdminRole(user?.role);

  useEffect(() => {
    if (!isStaff && previewAsStudent) {
      setPreviewAsStudentState(false);
    }
  }, [isStaff, previewAsStudent]);

  const refreshSections = useCallback(async () => {
    try {
      const res = await fetch('/api/sections', {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { sections?: PlatformSectionState[] };
      if (Array.isArray(data.sections) && data.sections.length > 0) {
        setSections(data.sections);
      }
    } catch {
      // Keep last known section states cleanly on transient network failures
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSections();
  }, [refreshSections, user?.id]);

  const sectionMap = useMemo(
    () => new Map<NavSection, PlatformSectionState>(sections.map((s) => [s.sectionKey, s])),
    [sections],
  );

  const getSection = useCallback(
    (key: NavSection) => sectionMap.get(key),
    [sectionMap],
  );

  const setPreviewAsStudent = useCallback(
    (next: boolean) => {
      if (!isStaff) {
        setPreviewAsStudentState(false);
        return;
      }
      setPreviewAsStudentState(next);
    },
    [isStaff],
  );

  const isSectionVisibleInNav = useCallback(
    (key: NavSection) => {
      const section = sectionMap.get(key);
      if (!section || !section.isLockable) return true;
      if (isStaff && !previewAsStudent) return true;
      return isSectionVisibleInStudentNav(section);
    },
    [sectionMap, isStaff, previewAsStudent],
  );

  const evaluateAccess = useCallback(
    (key: NavSection): SectionAccessEvaluation => {
      const section = sectionMap.get(key);
      return evaluateSectionAccess({
        section,
        userRole: user?.role ?? 'guest',
        previewAsStudent: isStaff && previewAsStudent,
      });
    },
    [sectionMap, user?.role, isStaff, previewAsStudent],
  );

  const value = useMemo<SectionContextValue>(
    () => ({
      sections,
      loading,
      previewAsStudent: isStaff && previewAsStudent,
      setPreviewAsStudent,
      refreshSections,
      getSection,
      isSectionVisibleInNav,
      evaluateAccess,
    }),
    [
      sections,
      loading,
      isStaff,
      previewAsStudent,
      setPreviewAsStudent,
      refreshSections,
      getSection,
      isSectionVisibleInNav,
      evaluateAccess,
    ],
  );

  return <SectionContext.Provider value={value}>{children}</SectionContext.Provider>;
};

export function useSections(): SectionContextValue {
  const ctx = useContext(SectionContext);
  if (!ctx) {
    throw new Error('useSections must be used inside SectionProvider');
  }
  return ctx;
}
