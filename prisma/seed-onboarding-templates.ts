import { PrismaClient, WorkflowType } from '@prisma/client';

const prisma = new PrismaClient();

type StepSeed = {
  title: string;
  assignedRole: string;
  dueDaysOffset: number;
  category: string;
  isRequired: boolean;
  description?: string;
};

async function upsertTemplate(name: string, type: WorkflowType, isDefault: boolean, steps: StepSeed[]) {
  const template = await prisma.onboardingTemplate.upsert({
    where: { id: `seed-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` },
    update: { name, type, isDefault },
    create: { id: `seed-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, type, isDefault },
  });

  await prisma.onboardingTemplateStep.deleteMany({ where: { templateId: template.id } });
  await prisma.onboardingTemplateStep.createMany({
    data: steps.map((step, index) => ({
      templateId: template.id,
      title: step.title,
      description: step.description ?? null,
      assignedRole: step.assignedRole,
      order: index + 1,
      dueDaysOffset: step.dueDaysOffset,
      isRequired: step.isRequired,
      category: step.category,
    })),
  });
}

async function main() {
  await upsertTemplate('Clinical staff onboarding', WorkflowType.ONBOARDING, true, [
    { title: 'Collect signed employment contract', assignedRole: 'hr', dueDaysOffset: 1, category: 'Documents', isRequired: true },
    { title: 'Collect national ID copy', assignedRole: 'hr', dueDaysOffset: 1, category: 'Documents', isRequired: true },
    { title: 'Collect KRA PIN certificate', assignedRole: 'hr', dueDaysOffset: 1, category: 'Documents', isRequired: true },
    { title: 'Verify KMPDC / nursing council licence', assignedRole: 'hr', dueDaysOffset: 2, category: 'Compliance', isRequired: true },
    { title: 'Collect professional indemnity insurance', assignedRole: 'hr', dueDaysOffset: 3, category: 'Compliance', isRequired: true },
    { title: 'Collect bank details for payroll', assignedRole: 'hr', dueDaysOffset: 1, category: 'Documents', isRequired: true },
    { title: 'Collect passport photos (2)', assignedRole: 'hr', dueDaysOffset: 3, category: 'Documents', isRequired: false },
    { title: 'Create system login credentials', assignedRole: 'it', dueDaysOffset: 2, category: 'Access', isRequired: true },
    { title: 'Provision biometric access (fingerprint/facial)', assignedRole: 'it', dueDaysOffset: 3, category: 'Access', isRequired: true },
    { title: 'Issue staff ID badge', assignedRole: 'hr', dueDaysOffset: 5, category: 'Equipment', isRequired: true },
    { title: 'Assign locker and uniform', assignedRole: 'department_head', dueDaysOffset: 3, category: 'Equipment', isRequired: false },
    { title: 'Department orientation and tour', assignedRole: 'department_head', dueDaysOffset: 3, category: 'Orientation', isRequired: true },
    { title: 'Fire safety and emergency procedures briefing', assignedRole: 'hr', dueDaysOffset: 5, category: 'Orientation', isRequired: true },
    { title: 'Data protection and confidentiality sign-off', assignedRole: 'hr', dueDaysOffset: 2, category: 'Compliance', isRequired: true },
    { title: 'Infection control training', assignedRole: 'department_head', dueDaysOffset: 5, category: 'Orientation', isRequired: true },
    { title: 'Introduction to team members', assignedRole: 'department_head', dueDaysOffset: 2, category: 'Orientation', isRequired: false },
    { title: 'Confirm probation period terms', assignedRole: 'hr', dueDaysOffset: 5, category: 'Documents', isRequired: true },
    { title: 'Complete pre-employment medical', assignedRole: 'employee', dueDaysOffset: 7, category: 'Compliance', isRequired: true },
  ]);

  await upsertTemplate('Non-clinical staff onboarding', WorkflowType.ONBOARDING, true, [
    { title: 'Collect signed employment contract', assignedRole: 'hr', dueDaysOffset: 1, category: 'Documents', isRequired: true },
    { title: 'Collect national ID copy', assignedRole: 'hr', dueDaysOffset: 1, category: 'Documents', isRequired: true },
    { title: 'Collect KRA PIN certificate', assignedRole: 'hr', dueDaysOffset: 1, category: 'Documents', isRequired: true },
    { title: 'Collect bank details for payroll', assignedRole: 'hr', dueDaysOffset: 1, category: 'Documents', isRequired: true },
    { title: 'Create system login credentials', assignedRole: 'it', dueDaysOffset: 2, category: 'Access', isRequired: true },
    { title: 'Provision biometric access (fingerprint/facial)', assignedRole: 'it', dueDaysOffset: 3, category: 'Access', isRequired: true },
    { title: 'Issue staff ID badge', assignedRole: 'hr', dueDaysOffset: 5, category: 'Equipment', isRequired: true },
    { title: 'Assign workstation and tools', assignedRole: 'department_head', dueDaysOffset: 3, category: 'Equipment', isRequired: true },
    { title: 'Department orientation and tour', assignedRole: 'department_head', dueDaysOffset: 3, category: 'Orientation', isRequired: true },
    { title: 'IT systems training', assignedRole: 'it', dueDaysOffset: 4, category: 'Orientation', isRequired: true },
    { title: 'Customer service orientation', assignedRole: 'department_head', dueDaysOffset: 5, category: 'Orientation', isRequired: true },
    { title: 'Data protection and confidentiality sign-off', assignedRole: 'hr', dueDaysOffset: 2, category: 'Compliance', isRequired: true },
    { title: 'Confirm probation period terms', assignedRole: 'hr', dueDaysOffset: 5, category: 'Documents', isRequired: true },
  ]);

  await upsertTemplate('Staff offboarding', WorkflowType.OFFBOARDING, true, [
    { title: 'Conduct exit interview', assignedRole: 'hr', dueDaysOffset: 3, category: 'Process', isRequired: false },
    { title: 'Revoke system access', assignedRole: 'it', dueDaysOffset: 1, category: 'Access', isRequired: true, description: 'Disable dashboard/ESS credentials and shared systems to prevent orphaned access.' },
    { title: 'Revoke biometric access', assignedRole: 'it', dueDaysOffset: 1, category: 'Access', isRequired: true, description: 'Disable device access profile and document revocation evidence.' },
    { title: 'Collect staff ID badge', assignedRole: 'hr', dueDaysOffset: 1, category: 'Equipment', isRequired: true, description: 'Capture returned badge serial/reference in task notes.' },
    { title: 'Collect keys, equipment, uniform', assignedRole: 'department_head', dueDaysOffset: 2, category: 'Equipment', isRequired: true, description: 'Verify all assigned assets are recovered or incident is logged.' },
    { title: 'Settle outstanding loan/advance balances', assignedRole: 'hr', dueDaysOffset: 5, category: 'Finance', isRequired: true, description: 'Record deductions/offsets required for final settlement.' },
    { title: 'Compute final pay (prorated salary + leave days owed)', assignedRole: 'hr', dueDaysOffset: 5, category: 'Finance', isRequired: true, description: 'Hook for payroll final settlement computation and approval.' },
    { title: 'Generate certificate of service', assignedRole: 'hr', dueDaysOffset: 5, category: 'Documents', isRequired: true },
    { title: 'Return signed clearance form', assignedRole: 'employee', dueDaysOffset: 7, category: 'Documents', isRequired: true, description: 'Clearance must be signed before records can be archived.' },
    { title: 'Archive employee records and evidence', assignedRole: 'hr', dueDaysOffset: 7, category: 'Process', isRequired: true, description: 'Store exit evidence (clearance, recovery, revocation, settlement) for audit trail.' },
  ]);

  console.log('Onboarding/offboarding templates seeded.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
