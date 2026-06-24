'use client';

import { createContext, useContext, useState, useLayoutEffect, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Building2, Loader2 } from 'lucide-react';
import { HRIS_ENTITY_COOKIE } from '@/lib/entity-constants';
import { parseVerticalShowcasePackFromEntitySlug } from '@/lib/operating-entities';

export type Entity = {
  id: string;
  name: string;
  country: string;
  currency: string;
  flag: string;
  color: string;
  sector?: string;
};

const STORAGE_KEY = 'hris_active_entity';

type EntityConfigResponse = {
  entities?: Entity[];
  defaultEntityId?: string;
  showSwitcher?: boolean;
};

type EntityProviderProps = {
  children: ReactNode;
  /** When set (e.g. from /api/dashboard/bootstrap), skips a separate entities fetch. */
  initialConfig?: EntityConfigResponse | null;
};

type EntityContextType = {
  activeEntity: Entity;
  entities: Entity[];
  showSwitcher: boolean;
  loading: boolean;
  setActiveEntity: (e: Entity) => void;
};

const FALLBACK_ENTITY: Entity = {
  id: 'ke',
  name: 'Workspace',
  country: 'Kenya',
  currency: 'KES',
  flag: '🇰🇪',
  color: '#006600',
};

const EntityContext = createContext<EntityContextType>({
  activeEntity: FALLBACK_ENTITY,
  entities: [FALLBACK_ENTITY],
  showSwitcher: false,
  loading: true,
  setActiveEntity: () => {},
});

function readCookieEntityId(): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    if (k !== HRIS_ENTITY_COOKIE) continue;
    return decodeURIComponent(trimmed.slice(eq + 1).trim()).toLowerCase();
  }
  return null;
}

function syncEntityCookie(entityId: string) {
  if (typeof document === 'undefined') return;
  const maxAge = 60 * 60 * 24 * 400;
  document.cookie = `${HRIS_ENTITY_COOKIE}=${encodeURIComponent(entityId)};path=/;max-age=${maxAge};SameSite=Lax`;
}

function resolveStoredEntityId(storedId: string, entities: Entity[]): Entity | null {
  const direct = entities.find((e) => e.id === storedId);
  if (direct) return direct;
  const pack = parseVerticalShowcasePackFromEntitySlug(storedId);
  if (!pack) return null;
  return entities.find((e) => e.id === `${pack}__ke`) ?? null;
}

function pickPreferredEntity(entities: Entity[], defaultEntityId: string): Entity {
  if (entities.length === 0) return FALLBACK_ENTITY;

  const fromStorage = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  if (fromStorage) {
    const found = resolveStoredEntityId(fromStorage, entities);
    if (found) return found;
  }

  const cid = readCookieEntityId();
  if (cid) {
    const found = resolveStoredEntityId(cid, entities);
    if (found) return found;
  }

  return entities.find((e) => e.id === defaultEntityId) ?? entities[0]!;
}

export function EntityProvider({ children, initialConfig = null }: EntityProviderProps) {
  const router = useRouter();
  const [entities, setEntities] = useState<Entity[]>(() => {
    if (initialConfig?.entities?.length) return initialConfig.entities;
    return [FALLBACK_ENTITY];
  });
  const [showSwitcher, setShowSwitcher] = useState(Boolean(initialConfig?.showSwitcher));
  const [loading, setLoading] = useState(!initialConfig);
  const [activeEntity, setActiveEntityState] = useState<Entity>(() => {
    if (initialConfig?.entities?.length) {
      return pickPreferredEntity(initialConfig.entities, initialConfig.defaultEntityId ?? initialConfig.entities[0]!.id);
    }
    return FALLBACK_ENTITY;
  });

  useEffect(() => {
    if (initialConfig?.entities?.length) {
      const list = initialConfig.entities;
      const defaultId = initialConfig.defaultEntityId ?? list[0]!.id;
      setEntities(list);
      setShowSwitcher(Boolean(initialConfig.showSwitcher));
      const preferred = pickPreferredEntity(list, defaultId);
      syncEntityCookie(preferred.id);
      setActiveEntityState(preferred);
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetch('/api/config/entities')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: EntityConfigResponse | null) => {
        if (cancelled || !data) return;
        const list = Array.isArray(data.entities) && data.entities.length > 0 ? data.entities : [FALLBACK_ENTITY];
        const defaultId = data.defaultEntityId ?? list[0]!.id;
        setEntities(list);
        setShowSwitcher(Boolean(data.showSwitcher));
        const preferred = pickPreferredEntity(list, defaultId);
        syncEntityCookie(preferred.id);
        setActiveEntityState(preferred);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialConfig]);

  useLayoutEffect(() => {
    if (loading || entities.length === 0) return;
    const preferred = pickPreferredEntity(entities, entities[0]!.id);
    const previousCookie = readCookieEntityId();
    syncEntityCookie(preferred.id);
    setActiveEntityState((prev) => (prev.id === preferred.id ? prev : preferred));
    if (previousCookie !== preferred.id) {
      router.refresh();
    }
  }, [loading, entities, router]);

  const setActiveEntity = (entity: Entity) => {
    if (entity.id === activeEntity.id) return;
    localStorage.setItem(STORAGE_KEY, entity.id);
    syncEntityCookie(entity.id);
    setActiveEntityState(entity);
    router.refresh();
  };

  return (
    <EntityContext.Provider value={{ activeEntity, entities, showSwitcher, loading, setActiveEntity }}>
      {children}
    </EntityContext.Provider>
  );
}

export function useEntity() {
  return useContext(EntityContext);
}

export function EntitySwitcher({ variant = 'default' }: { variant?: 'default' | 'topbar' }) {
  const { activeEntity, entities, showSwitcher, loading, setActiveEntity } = useEntity();
  const [open, setOpen] = useState(false);

  if (loading) {
    if (variant === 'topbar') return null;
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        <span className="sr-only">Loading entities</span>
      </div>
    );
  }

  if (!showSwitcher || entities.length <= 1) {
    return null;
  }

  const isTopbar = variant === 'topbar';
  const triggerClass = isTopbar
    ? 'dash-select-trigger flex h-9 max-w-[11rem] items-center gap-1.5 rounded-lg border px-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 sm:max-w-[13rem] lg:max-w-[15rem] lg:px-2.5'
    : 'dash-select-trigger flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm transition-colors';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={`${activeEntity.name} (${activeEntity.currency})`}
      >
        <Building2
          className={`shrink-0 text-neutral-500 ${isTopbar ? 'h-3.5 w-3.5' : 'w-3.5 h-3.5'}`}
          aria-hidden
        />
        {isTopbar ? (
          <>
            <span className="hidden min-w-0 truncate sm:inline">{activeEntity.name}</span>
            <span className="inline truncate sm:hidden">{activeEntity.country}</span>
          </>
        ) : (
          <>
            <span className="hidden sm:inline truncate max-w-[140px] lg:max-w-[200px]">{activeEntity.name}</span>
            <span className="inline sm:hidden">{activeEntity.country}</span>
          </>
        )}
        <span
          className={`shrink-0 rounded font-mono text-[10px] font-semibold text-primary-800 ${
            isTopbar ? 'bg-primary-100/80 px-1 py-0.5' : 'ml-0.5 text-xs bg-primary-50 px-1.5 py-0.5'
          }`}
        >
          {activeEntity.currency}
        </span>
        <ChevronDown
          className={`shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''} ${
            isTopbar ? 'h-3.5 w-3.5' : 'w-3.5 h-3.5'
          }`}
          aria-hidden
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10 bg-black/5" aria-hidden onClick={() => setOpen(false)} />
          <div
            className="dash-popover absolute right-0 top-full z-20 mt-1.5 w-64 overflow-hidden rounded-xl border"
            role="listbox"
            aria-label="Switch entity"
          >
            <div className="dash-popover-header border-b px-3 py-2">
              <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">
                Switch company context
              </p>
              <p className="mt-0.5 text-[10px] text-neutral-400">Switch operating entity</p>
            </div>
            {entities.map((entity) => (
              <button
                key={entity.id}
                type="button"
                role="option"
                aria-selected={activeEntity.id === entity.id}
                onClick={() => {
                  setActiveEntity(entity);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-[var(--dash-hover)] ${
                  activeEntity.id === entity.id
                    ? 'bg-[color-mix(in_srgb,var(--brand-primary)_10%,var(--dash-surface-solid))]'
                    : ''
                }`}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50"
                  aria-hidden
                >
                  <Building2 className="h-4 w-4 text-neutral-500" />
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      activeEntity.id === entity.id ? 'text-primary-800' : 'text-ink'
                    }`}
                  >
                    {entity.name}
                  </p>
                  <p className="text-xs text-neutral-500 truncate">
                    {entity.sector ?? entity.country} · {entity.currency}
                  </p>
                </div>
                {activeEntity.id === entity.id && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" aria-hidden />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
