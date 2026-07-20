import { OnboardingTaskType, Prisma, PrismaClient, WorkflowType } from '@prisma/client';
import { SEED_DEFAULT_ORG_ID } from './system-setting-seed';

const prisma = new PrismaClient();

type StepSeed = {
  title: string;
  assignedRole: string;
  dueDaysOffset: number;
  category: string;
  isRequired: boolean;
  description?: string;
  taskType?: OnboardingTaskType;
  formTemplateId?: string | null;
  signatureDocumentTitle?: string | null;
};

function templateId(organizationId: string, name: string): string {
  return `seed-${organizationId.slice(0, 8)}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function formTemplateId(organizationId: string, name: string): string {
  return `seed-form-${organizationId.slice(0, 8)}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

/** Sample structured data-collection form used by the FORM onboarding step. */
async function upsertNewHireForm(organizationId: string): Promise<string> {
  const id = formTemplateId(organizationId, 'New hire data form');
  const fields: Prisma.InputJsonValue = [
    { key: 'bankName', label: 'Bank name', type: 'text', required: true, section: 'Payroll' },
    { key: 'bankBranch', label: 'Bank branch', type: 'text', required: false, section: 'Payroll' },
    { key: 'accountNumber', label: 'Account number', type: 'text', required: true, section: 'Payroll' },
    { key: 'kraPin', label: 'KRA PIN', type: 'text', required: true, section: 'Statutory' },
    { key: 'nssfNumber', label: 'NSSF number', type: 'text', required: false, section: 'Statutory' },
    { key: 'nhifNumber', label: 'SHIF/NHIF number', type: 'text', required: false, section: 'Statutory' },
    { key: 'kinName', label: 'Next of kin name', type: 'text', required: true, section: 'Next of kin' },
    {
      key: 'kinRelationship',
      label: 'Relationship',
      type: 'select',
      required: true,
      options: ['Spouse', 'Parent', 'Sibling', 'Child', 'Other'],
      section: 'Next of kin',
    },
    { key: 'kinPhone', label: 'Next of kin phone', type: 'phone', required: true, section: 'Next of kin' },
  ];

  const form = await prisma.onboardingFormTemplate.upsert({
    where: { id },
    update: { name: 'New hire data form', fields, isActive: true, organizationId },
    create: {
      id,
      organizationId,
      name: 'New hire data form',
      description: 'Payroll, statutory, and next-of-kin details collected from new hires.',
      fields,
      isActive: true,
    },
  });
  return form.id;
}

async function upsertTemplate(
  organizationId: string,
  name: string,
  type: WorkflowType,
  isDefault: boolean,
  steps: StepSeed[],
) {
  const id = templateId(organizationId, name);
  const template = await prisma.onboardingTemplate.upsert({
    where: { id },
    update: { name, type, isDefault, organizationId },
    create: { id, organizationId, name, type, isDefault },
  });

  await prisma.onboardingTemplateStep.deleteMany({ where: { templateId: template.id } });
  await prisma.onboardingTemplateStep.createMany({
    data: steps.map((step, index) => ({
      organizationId,
      templateId: template.id,
      title: step.title,
      description: step.description ?? null,
      assignedRole: step.assignedRole,
      order: index + 1,
      dueDaysOffset: step.dueDaysOffset,
      isRequired: step.isRequired,
      category: step.category,
      taskType: step.taskType ?? OnboardingTaskType.CHECKLIST,
      formTemplateId: step.taskType === OnboardingTaskType.FORM ? step.formTemplateId ?? null : null,
      signatureDocumentTitle:
        step.taskType === OnboardingTaskType.SIGNATURE ? step.signatureDocumentTitle ?? null : null,
    })),
  });
}

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true } });
  const organizationIds = orgs.length > 0 ? orgs.map((org) => org.id) : [SEED_DEFAULT_ORG_ID];

  for (const organizationId of organizationIds) {
    const newHireFormId = await upsertNewHireForm(organizationId);

    await upsertTemplate(organizationId, 'Clinical staff onboarding', WorkflowType.ONBOARDING, true, [
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

    await upsertTemplate(organizationId, 'Non-clinical staff onboarding', WorkflowType.ONBOARDING, true, [
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
    {
      title: 'Complete new hire data form',
      assignedRole: 'employee',
      dueDaysOffset: 3,
      category: 'Documents',
      isRequired: true,
      description: 'Provide your payroll, statutory, and next-of-kin details.',
      taskType: OnboardingTaskType.FORM,
      formTemplateId: newHireFormId,
    },
    {
      title: 'Sign code of conduct',
      assignedRole: 'employee',
      dueDaysOffset: 3,
      category: 'Compliance',
      isRequired: true,
      description: 'Read and electronically sign the staff code of conduct.',
      taskType: OnboardingTaskType.SIGNATURE,
      signatureDocumentTitle: 'Employee Code of Conduct',
    },
  ]);

    await upsertTemplate(organizationId, 'Staff offboarding', WorkflowType.OFFBOARDING, true, [
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
  }

  console.log(`Onboarding/offboarding templates seeded for ${organizationIds.length} organization(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
