'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import DashboardNav, { readSidebarCollapsed, writeSidebarCollapsed } from '@/components/dashboard/DashboardNav';
import { DashboardSidebarPoweredBy } from '@/components/dashboard/DashboardSidebarPoweredBy';
import DashboardTopbar from '@/components/dashboard/DashboardTopbar';
import { DashboardSetupBanner } from '@/components/dashboard/DashboardSetupBanner';
import { PastDueBanner } from '@/components/dashboard/PastDueBanner';
import {
  getPastDueGraceDays,
  isPastDueBannerVisible,
  isPastDueReadOnly,
} from '@/lib/account-readonly';
import { ChevronLeft, LogOut } from 'lucide-react';
import type { UserSummary } from '@/types/dashboard';
import { STAFF_USER_TYPE_LABELS } from '@/lib/staff-permissions';
import { EntityProvider, type Entity } from '@/components/EntitySwitcher';
import type { ModuleKey } from '@/lib/modules';
import type { DeploymentTier } from '@/lib/deployment-tier';
import { writeModuleAdminFlagsCookie } from '@/lib/module-cookie';
import { DashboardSessionProvider } from '@/contexts/dashboard-session';
import { DashboardDomainProvider } from '@/contexts/dashboard-domain';
import { DashboardOverviewLayoutProvider } from '@/contexts/dashboard-overview-layout';
import { DashboardModuleOrderProvider } from '@/contexts/dashboard-module-order';
import { SkipToMain } from '@/components/a11y/SkipToMain';
import { PlatformLoadingOverlay } from '@/components/platform/PlatformLoadingOverlay';
import { PlatformNavigationLoader } from '@/components/platform/PlatformNavigationLoader';
import {
 DASHBOARD_MAIN_PADDING_BOTTOM,
 DASHBOARD_MAIN_PADDING_TOP,
 DASHBOARD_SHELL_GUTTER,
 DASHBOARD_SIDEBAR_WIDTH,
} from '@/lib/dashboard-layout';

type BootstrapPayload = {
 me?: UserSummary;
 modules?: Record<ModuleKey, boolean>;
 moduleAdminFlags?: Record<ModuleKey, boolean>;
 entities?: Entity[];
 defaultEntityId?: string;
 showEntitySwitcher?: boolean;
 deployment?: {
  canAccessCompanySetup?: boolean;
 };
 deploymentTier?: DeploymentTier;
 entitlements?: {
  accountStatus?: string;
  pastDueSince?: string | null;
 };
};

const ALL_MODULES_ON: Record<ModuleKey, boolean> = {
 core: true,
 leave: true,
 time: true,
 payroll: true,
 ats: true,
 performance: true,
 hse: true,
 accounts: true,
 disciplinary: true,
 reports: true,
 assets: true,
 fleet: true,
 ess: true,
 communications: true,
 training: true,
 documents: true,
 procurement: true,
 legal: true,
};

const SIDEBAR_WIDTH = DASHBOARD_SIDEBAR_WIDTH;

function getUserRoleLabel(user: UserSummary | null): string {
 if (!user) return 'Staff User';
 if (user.role === 'admin') return 'Administrator';
 if (user.role === 'viewer') return 'Viewer';
 return STAFF_USER_TYPE_LABELS[user.staffUserType] ?? 'Staff';
}

type DashboardAppLayoutClientProps = {
 children: ReactNode;
 sidebarBrand: ReactNode;
 initialPathname: string;
};

export default function DashboardAppLayoutClient({
 children,
 sidebarBrand,
 initialPathname,
}: DashboardAppLayoutClientProps) {
 const router = useRouter();
 const pathname = usePathname();
 const [currentUser, setCurrentUser] = useState<UserSummary | null>(null);
 const [enabledModules, setEnabledModules] = useState<Record<ModuleKey, boolean>>(ALL_MODULES_ON);
 const [deploymentTier, setDeploymentTier] = useState<DeploymentTier>('growth');
 const [entityBootstrap, setEntityBootstrap] = useState<BootstrapPayload | null>(null);
 const [pastDueBanner, setPastDueBanner] = useState<{
  visible: boolean;
  graceDaysRemaining: number | null;
 }>({ visible: false, graceDaysRemaining: null });
 const [canAccessCompanySetup, setCanAccessCompanySetup] = useState(false);
 const [sessionBootstrapping, setSessionBootstrapping] = useState(true);
 const [sidebarOpen, setSidebarOpen] = useState(true);
 const [hasMounted, setHasMounted] = useState(false);
 const [isMobileNav, setIsMobileNav] = useState(false);

 useEffect(() => {
 setSidebarOpen(!readSidebarCollapsed());
 setHasMounted(true);
 }, []);

 useEffect(() => {
 const mq = window.matchMedia('(max-width: 1023px)');
 const sync = () => setIsMobileNav(mq.matches);
 sync();
 mq.addEventListener('change', sync);
 return () => mq.removeEventListener('change', sync);
 }, []);

 useEffect(() => {
 let cancelled = false;

 const applyBootstrap = (data: BootstrapPayload | null) => {
 if (!data) return;
 if (data.me) setCurrentUser(data.me);
 if (data.modules) setEnabledModules(data.modules);
 if (data.deploymentTier) setDeploymentTier(data.deploymentTier);
 if (data.moduleAdminFlags) writeModuleAdminFlagsCookie(data.moduleAdminFlags);
 setCanAccessCompanySetup(data.deployment?.canAccessCompanySetup === true);
 setEntityBootstrap(data);
 if (data.entitlements) {
  const { accountStatus, pastDueSince } = data.entitlements;
  const visible = isPastDueBannerVisible(accountStatus);
  let graceDaysRemaining: number | null = null;
  if (visible && pastDueSince && !isPastDueReadOnly(accountStatus, pastDueSince)) {
   const graceMs = getPastDueGraceDays() * 24 * 60 * 60 * 1000;
   const elapsed = Date.now() - new Date(pastDueSince).getTime();
   graceDaysRemaining = Math.max(0, Math.ceil((graceMs - elapsed) / (24 * 60 * 60 * 1000)));
  }
  setPastDueBanner({ visible, graceDaysRemaining });
 }
 };

 const loadBootstrap = () => {
 fetch('/api/dashboard/bootstrap', { credentials: 'include' })
 .then((r) => {
 if (r.status === 401 || r.status === 403) throw new Error('unauthorized');
 if (!r.ok) throw new Error('Failed to load dashboard session');
 return r.json() as Promise<BootstrapPayload>;
 })
 .then((data) => {
 if (!cancelled) applyBootstrap(data);
 })
 .catch((error: unknown) => {
 if (cancelled) return;
 setCurrentUser(null);
 if (error instanceof Error && error.message === 'unauthorized') {
 router.replace('/dashboard/login');
 }
 })
 .finally(() => {
 if (!cancelled) setSessionBootstrapping(false);
 });
 };

 loadBootstrap();
 const onModulesUpdated = () => {
 fetch('/api/config/deployment', { credentials: 'include' })
 .then((r) => (r.ok ? r.json() : null))
 .then((data: BootstrapPayload | null) => {
 if (!cancelled && data?.modules) {
 setEnabledModules(data.modules);
 if (data.moduleAdminFlags) writeModuleAdminFlagsCookie(data.moduleAdminFlags);
 }
 })
 .catch(() => {});
 };
 window.addEventListener('hris:modules-updated', onModulesUpdated);
 return () => {
 cancelled = true;
 window.removeEventListener('hris:modules-updated', onModulesUpdated);
 };
 }, [router]);

 const setSidebar = useCallback((open: boolean) => {
 setSidebarOpen(open);
 writeSidebarCollapsed(!open);
 }, []);

 const toggleSidebar = useCallback(() => {
 setSidebar(!sidebarOpen);
 }, [setSidebar, sidebarOpen]);

 const displayName = currentUser?.name || 'Staff User';
 const displayEmail = currentUser?.email || 'staff@example.com';
 const roleLabel = getUserRoleLabel(currentUser);
 const showRoleBadge = roleLabel.toLowerCase() !== displayName.trim().toLowerCase();
 const initials =
 displayName
 .trim()
 .split(/\s+/)
 .filter(Boolean)
 .slice(0, 2)
 .map((p) => p[0]?.toUpperCase() || '')
 .join('') || 'SU';

 const handleLogout = async () => {
 await fetch('/api/auth/logout', { method: 'POST' });
 window.location.href = '/dashboard/login';
 };

 const closeSidebarOnMobile = () => {
 if (window.matchMedia('(max-width: 1023px)').matches) setSidebar(false);
 };

 const showBackdrop = hasMounted && sidebarOpen && isMobileNav;

 return (
 <DashboardDomainProvider initialPathname={initialPathname}>
 <DashboardOverviewLayoutProvider>
 <DashboardModuleOrderProvider enabledModules={enabledModules} deploymentTier={deploymentTier}>
 <EntityProvider
 initialConfig={
 entityBootstrap
 ? {
 entities: entityBootstrap.entities,
 defaultEntityId: entityBootstrap.defaultEntityId,
 showSwitcher: entityBootstrap.showEntitySwitcher,
 }
 : null
 }
 >
 <div className="dashboard-canvas h-screen overflow-hidden">
 <PlatformNavigationLoader />
 {sessionBootstrapping ? <PlatformLoadingOverlay /> : null}
 <SkipToMain />
 {showBackdrop ? (
 <button
 type="button"
 className="print:hidden fixed inset-0 z-40 backdrop-blur-[1px] transition-opacity"
 style={{ backgroundColor: 'var(--dash-backdrop)' }}
 aria-label="Close navigation menu"
 onClick={() => setSidebar(false)}
 />
 ) : null}

 {hasMounted && sidebarOpen ? (
 <button
 type="button"
 onClick={toggleSidebar}
 className="print:hidden fixed top-1/2 z-[60] flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border dash-collapse-btn shadow-soft transition-[left] duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
 style={{ left: SIDEBAR_WIDTH }}
 title="Close navigation menu"
 aria-expanded
 aria-label="Close navigation menu"
 >
 <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
 </button>
 ) : null}

 <aside
 className={`print:hidden fixed inset-y-0 left-0 z-50 flex flex-col border-r dash-sidebar transition-transform duration-300 ease-out ${
 hasMounted && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'
 } ${sidebarOpen && !isMobileNav ? 'lg:shadow-none' : 'shadow-large'}`}
 style={{ width: SIDEBAR_WIDTH }}
 aria-hidden={hasMounted && !sidebarOpen}
 >
 <div
 className="dash-sidebar-brand flex flex-shrink-0 items-center justify-center border-b px-3.5 py-3"
 onClick={closeSidebarOnMobile}
 >
 {sidebarBrand}
 </div>

 <DashboardNav
 currentUserRole={currentUser?.role ?? null}
 hasAccountsAccess={currentUser?.hasAccountsAccess ?? false}
 canViewSystemAnalytics={currentUser?.canViewSystemAnalytics ?? false}
 canAccessCompanySetup={canAccessCompanySetup}
 enabledModules={enabledModules}
 onNavigate={closeSidebarOnMobile}
 />

 <div className="mt-auto flex-shrink-0 border-t dash-user-footer">
 <div className="p-2.5">
 <div className="flex items-center gap-2.5 rounded-xl border px-2 py-2 shadow-sm backdrop-blur-sm dash-user-card">
 <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700">
 <span className="text-xs font-bold text-white">{initials}</span>
 </div>
 <div className="min-w-0 flex-1">
 <p className="truncate text-[13px] font-semibold leading-tight text-ink">{displayName}</p>
 {showRoleBadge ? (
 <p className="truncate text-[10px] font-medium leading-tight text-primary-600">{roleLabel}</p>
 ) : null}
 <p className="truncate text-[11px] leading-tight text-neutral-500">{displayEmail}</p>
 </div>
 <button
 type="button"
 onClick={handleLogout}
 title="Sign out"
 aria-label="Sign out"
 className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-danger/10 hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
 >
 <LogOut className="h-4 w-4" strokeWidth={1.75} />
 </button>
 </div>
 </div>
 <DashboardSidebarPoweredBy />
 </div>
 </aside>

 <div
 className={`flex h-screen min-h-0 min-w-0 flex-col transition-[margin] duration-300 ease-out ${
 hasMounted && sidebarOpen && !isMobileNav ? 'lg:ml-[280px]' : ''
 }`}
 >
 <DashboardTopbar
 currentUser={currentUser}
 sidebarOpen={sidebarOpen}
 onToggleSidebar={toggleSidebar}
 enabledModules={enabledModules}
 contentGutterClass={DASHBOARD_SHELL_GUTTER}
 />
 <main id="main-content" tabIndex={-1} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
 {pastDueBanner.visible ? (
  <PastDueBanner graceDaysRemaining={pastDueBanner.graceDaysRemaining} />
 ) : null}
 <div
 className={`w-full min-w-0 ${DASHBOARD_SHELL_GUTTER} ${DASHBOARD_MAIN_PADDING_TOP} ${DASHBOARD_MAIN_PADDING_BOTTOM}`}
 >
          <DashboardSetupBanner />
          <DashboardSessionProvider user={currentUser} modules={enabledModules}>
          {children}
          </DashboardSessionProvider>
 </div>
 </main>
 </div>
 </div>
 </EntityProvider>
 </DashboardModuleOrderProvider>
 </DashboardOverviewLayoutProvider>
 </DashboardDomainProvider>
 );
}
