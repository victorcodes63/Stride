'use client';

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

export type WorkspacePanel = 'module' | 'entity';

type WorkspaceControlContextValue = {
  rootRef: RefObject<HTMLDivElement | null>;
  openPanel: WorkspacePanel | null;
  setOpenPanel: (panel: WorkspacePanel | null) => void;
};

const WorkspaceControlContext = createContext<WorkspaceControlContextValue | null>(null);

export function WorkspaceControlProvider({
  rootRef,
  children,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const [openPanel, setOpenPanel] = useState<WorkspacePanel | null>(null);

  return (
    <WorkspaceControlContext.Provider value={{ rootRef, openPanel, setOpenPanel }}>
      {children}
    </WorkspaceControlContext.Provider>
  );
}

export function useWorkspaceControl() {
  return useContext(WorkspaceControlContext);
}

export function WorkspaceAnchoredPopover({
  open,
  embedded,
  children,
  className = '',
}: {
  open: boolean;
  embedded: boolean;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useWorkspaceControl();
  const [style, setStyle] = useState<CSSProperties>({});

  const updatePosition = useCallback(() => {
    const root = ctx?.rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    setStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 288),
      zIndex: 50,
    });
  }, [ctx?.rootRef]);

  useLayoutEffect(() => {
    if (!open || !embedded) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, embedded, updatePosition]);

  if (!open) return null;

  const panel = (
    <div style={embedded ? style : undefined} className={className}>
      {children}
    </div>
  );

  if (embedded && typeof document !== 'undefined') {
    return createPortal(panel, document.body);
  }

  return panel;
}
