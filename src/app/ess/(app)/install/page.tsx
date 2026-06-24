'use client';

import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssCard, EssListItem } from '@/components/ess/EssUi';

export default function EssInstallPage() {
  return (
    <div>
      <EssPageHeader
        title="Install app"
        subtitle="Add ESS to your home screen for faster access, standalone mode, and cached pages."
        backHref="/ess/more"
      />
      <EssCard className="space-y-5 text-sm text-[var(--ess-muted)]">
        <section>
          <h2 className="font-black text-[var(--ess-text)]">iPhone / iPad (Safari)</h2>
          <div className="mt-3 space-y-2">
            {['Open this site in Safari', 'Tap the Share button', 'Choose Add to Home Screen', 'Tap Add'].map((step, index) => (
              <EssListItem key={step} title={step} icon={<span className="text-sm font-black">{index + 1}</span>} />
            ))}
          </div>
        </section>
        <section>
          <h2 className="font-black text-[var(--ess-text)]">Android (Chrome)</h2>
          <div className="mt-3 space-y-2">
            {['Open the browser menu', 'Tap Install app or Add to Home screen', 'Confirm install'].map((step, index) => (
              <EssListItem key={step} title={step} icon={<span className="text-sm font-black">{index + 1}</span>} />
            ))}
          </div>
        </section>
        <p>
          After installing, open the app from your home screen for the best experience.
        </p>
      </EssCard>
    </div>
  );
}
