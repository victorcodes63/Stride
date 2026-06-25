/**
 * RAV-94: Seed healthcare wards, credentials, and sample clinical assignments.
 */
import type { PrismaClient } from '@prisma/client';

const WARDS = [
  { code: 'ICU', name: 'Intensive Care Unit', minRestHours: 12 },
  { code: 'MAT', name: 'Maternity', minRestHours: 11 },
  { code: 'PAED', name: 'Paediatrics', minRestHours: 11 },
] as const;

export async function seedHealthcareDemo(
  db: PrismaClient,
  organizationId: string,
  outsourcingClientId: string,
) {
  const existing = await db.healthcareWard.count({ where: { outsourcingClientId } });
  if (existing > 0) {
    console.log('  Healthcare demo already seeded — skipping');
    return;
  }

  console.log('  Seeding healthcare wards and clinical rota…');

  await db.outsourcingClient.update({
    where: { id: outsourcingClientId },
    data: { nhifEmployerNumber: 'NHIF-DEMO-AMC-001' },
  });

  const wards = [];
  for (const w of WARDS) {
    const ward = await db.healthcareWard.create({
      data: {
        organizationId,
        outsourcingClientId,
        code: w.code,
        name: w.name,
        minRestHours: w.minRestHours,
        requiredCredentials: ['medical_license'],
      },
    });
    wards.push(ward);
  }

  const staff = await db.employee.findMany({
    where: { outsourcingClientId, employmentStatus: 'active' },
    orderBy: { employeeNumber: 'asc' },
    take: 8,
  });

  for (const emp of staff) {
    if (!emp.nhifNumber?.trim()) {
      await db.employee.update({
        where: { id: emp.id },
        data: { nhifNumber: `NHIF${emp.employeeNumber?.replace(/\D/g, '').slice(-8) ?? '00001234'}` },
      });
    }

    const hasCred = await db.employeeCredential.findFirst({ where: { employeeId: emp.id } });
    if (!hasCred) {
      await db.employeeCredential.create({
        data: {
          organizationId,
          employeeId: emp.id,
          category: 'medical_license',
          credentialName: 'Nursing Council of Kenya licence',
          credentialNumber: `NCK-${emp.employeeNumber ?? emp.id.slice(0, 6)}`,
          issuingAuthority: 'Nursing Council of Kenya',
          status: 'active',
          expiryDate: new Date('2027-12-31'),
        },
      });
    }
  }

  const workDate = new Date();
  workDate.setDate(workDate.getDate() + 2);
  const dateStr = workDate.toISOString().slice(0, 10);

  for (let i = 0; i < Math.min(4, staff.length); i++) {
    const emp = staff[i]!;
    const ward = wards[i % wards.length]!;
    const startsAt = new Date(`${dateStr}T06:00:00`);
    const endsAt = new Date(`${dateStr}T14:00:00`);

    await db.healthcareClinicalAssignment.create({
      data: {
        organizationId,
        outsourcingClientId,
        wardId: ward.id,
        employeeId: emp.id,
        clinicalRole: i % 2 === 0 ? 'nurse' : 'medical_officer',
        workDate: new Date(`${dateStr}T12:00:00`),
        startsAt,
        endsAt,
        licenseOk: true,
        licenseWarnings: [],
      },
    });
  }

  console.log(`  Healthcare demo: ${wards.length} wards, clinical assignments for ${Math.min(4, staff.length)} staff`);
}
