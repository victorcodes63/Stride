'use client';

import { useCallback, useEffect, useState } from 'react';
import { Fingerprint, FileUp, Plus, RefreshCw } from 'lucide-react';
import { DashboardPage, DashboardPageSection } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DeviceHealthHeader } from './DeviceHealthHeader';
import { DevicesTable } from './DevicesTable';
import { PunchStreamCard } from './PunchStreamCard';
import { DeviceFormModal } from './DeviceFormModal';
import { CsvImportWizard } from './CsvImportWizard';
import { SubjectMapModal } from './SubjectMapModal';
import type {
  StaffBiometricDevice,
  StaffBiometricOverview,
  StaffBiometricPunch,
} from './types';

type SubjectMapState = {
  deviceId: string;
  deviceName: string;
  rawSubjectId: string;
  currentUserId: string | null;
};

export function StaffBiometricDevicesClient() {
  const [devices, setDevices] = useState<StaffBiometricDevice[]>([]);
  const [overview, setOverview] = useState<StaffBiometricOverview | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [editDevice, setEditDevice] = useState<StaffBiometricDevice | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [subjectMap, setSubjectMap] = useState<SubjectMapState | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/staff/biometric/devices', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load devices.');
      setDevices(Array.isArray(data.devices) ? data.devices : []);
      setCanManage(Boolean(data.canManage));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load devices.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/staff/biometric/overview', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setOverview(data as StaffBiometricOverview);
    } catch {
      /* overview is non-critical; header falls back to skeleton */
    }
  }, []);

  const refreshAll = useCallback(() => {
    void loadDevices();
    void loadOverview();
    setRefreshKey((k) => k + 1);
  }, [loadDevices, loadOverview]);

  useEffect(() => {
    void loadDevices();
    void loadOverview();
  }, [loadDevices, loadOverview]);

  const handleMap = (punch: StaffBiometricPunch) => {
    setSubjectMap({
      deviceId: punch.deviceId,
      deviceName: punch.deviceName,
      rawSubjectId: punch.rawSubjectId,
      currentUserId: punch.userId,
    });
  };

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Biometric devices"
        icon={Fingerprint}
        iconClassName="h-7 w-7 shrink-0 text-primary-700"
        description="Register terminals, sync punches, and reconcile internal-staff attendance."
        actions={
          <div className="page-header-actions">
            <button
              type="button"
              onClick={refreshAll}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {canManage ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowImport(true)}
                  disabled={devices.length === 0}
                  className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <FileUp className="h-4 w-4" />
                  Import CSV
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditDevice(null);
                    setShowDeviceForm(true);
                  }}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add device
                </button>
              </>
            ) : null}
          </div>
        }
      />

      <DeviceHealthHeader overview={overview} />

      <DashboardPageSection>
        <DevicesTable
          devices={devices}
          loading={loading}
          error={error}
          canManage={canManage}
          onRetry={loadDevices}
          onEdit={(device) => {
            setEditDevice(device);
            setShowDeviceForm(true);
          }}
          onChanged={refreshAll}
        />
      </DashboardPageSection>

      <DashboardPageSection>
        <PunchStreamCard
          devices={devices}
          canManage={canManage}
          refreshKey={refreshKey}
          onMap={handleMap}
        />
      </DashboardPageSection>

      {showDeviceForm ? (
        <DeviceFormModal
          device={editDevice}
          onClose={() => {
            setShowDeviceForm(false);
            setEditDevice(null);
          }}
          onSaved={refreshAll}
        />
      ) : null}

      {showImport ? (
        <CsvImportWizard
          devices={devices}
          onClose={() => setShowImport(false)}
          onImported={refreshAll}
        />
      ) : null}

      {subjectMap ? (
        <SubjectMapModal
          deviceId={subjectMap.deviceId}
          deviceName={subjectMap.deviceName}
          rawSubjectId={subjectMap.rawSubjectId}
          currentUserId={subjectMap.currentUserId}
          onClose={() => setSubjectMap(null)}
          onSaved={refreshAll}
        />
      ) : null}
    </DashboardPage>
  );
}
