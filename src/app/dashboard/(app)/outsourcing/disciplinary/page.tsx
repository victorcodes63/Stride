'use client';

import DisciplinaryPage from '../../disciplinary/page';

export default function OutsourcingDisciplinaryPage() {
  return (
    <DisciplinaryPage
      basePath="/dashboard/outsourcing/disciplinary"
      eyebrow="09 — HR Outsourcing"
      title="Client disciplinary"
      description="Per end-client disciplinary cases and grievances for the outsourced workforce."
    />
  );
}
