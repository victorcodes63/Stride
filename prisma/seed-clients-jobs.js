/**
 * Seed 6 new clients and 2 jobs per client (12 jobs total).
 * Run: node prisma/seed-clients-jobs.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CLIENT_SEEDS = [
  { name: 'Apex Healthcare Group', contactName: 'Naomi Kendi', contactEmail: 'naomi.kendi@apex-healthcare.co.ke', contactPhone: '+254 700 121 001' },
  { name: 'BlueWave Logistics Ltd', contactName: 'Peter Mugo', contactEmail: 'peter.mugo@bluewave-logistics.co.ke', contactPhone: '+254 700 121 002' },
  { name: 'Cedar Financial Services', contactName: 'Diana Chebet', contactEmail: 'diana.chebet@cedarfs.co.ke', contactPhone: '+254 700 121 003' },
  { name: 'Delta Agro Industries', contactName: 'Samuel Otieno', contactEmail: 'samuel.otieno@deltaagro.co.ke', contactPhone: '+254 700 121 004' },
  { name: 'Evergreen Education Trust', contactName: 'Lilian Wanjiru', contactEmail: 'lilian.wanjiru@evergreen-edu.org', contactPhone: '+254 700 121 005' },
  { name: 'Frontier Energy Solutions', contactName: 'Eric Kiptoo', contactEmail: 'eric.kiptoo@frontier-energy.co.ke', contactPhone: '+254 700 121 006' },
];

const JOB_TEMPLATES = [
  {
    title: 'Operations Manager',
    location: 'Nairobi',
    type: 'Full Time',
    category: 'Operations',
    description:
      'Lead daily operations, optimize processes, and coordinate cross-functional teams to deliver performance targets.',
    requirements: [
      'Bachelor degree in Business Administration or related field',
      '5+ years operations experience',
      'Strong stakeholder management',
    ],
    responsibilities: [
      'Oversee day-to-day operations',
      'Track and improve KPIs',
      'Coordinate inter-department planning',
    ],
    benefits: ['Medical cover', 'Annual bonus', 'Professional development'],
    salary: { min: 180000, max: 260000, currency: 'KES' },
    experience: '5+ years in operations leadership',
    education: 'Bachelor degree required; Masters preferred',
    minYearsExperience: 5,
    educationLevel: 'undergraduate',
    educationQualification: 'Business Administration, Operations Management, or related',
    requiredCertifications: 'PMP or Lean Six Sigma is an added advantage',
    skills: ['Operations Management', 'Process Improvement', 'Reporting'],
  },
  {
    title: 'HR Officer',
    location: 'Nairobi',
    type: 'Full Time',
    category: 'Human Resources',
    description:
      'Support talent acquisition, onboarding, and employee relations while ensuring policy and labor law compliance.',
    requirements: [
      'Degree in HR, Psychology, or related',
      '3+ years HR generalist experience',
      'Excellent communication skills',
    ],
    responsibilities: [
      'Coordinate recruitment and onboarding',
      'Maintain HR records and documentation',
      'Support performance management cycles',
    ],
    benefits: ['Health insurance', 'Hybrid working options', 'Training budget'],
    salary: { min: 120000, max: 180000, currency: 'KES' },
    experience: '3+ years in HR operations',
    education: 'Bachelor degree in HR or related discipline',
    minYearsExperience: 3,
    educationLevel: 'undergraduate',
    educationQualification: 'Human Resource Management, Psychology, or related',
    requiredCertifications: 'IHRM membership preferred',
    skills: ['Recruitment', 'Employee Relations', 'HRIS'],
  },
];

function nextDeadline(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

function mkReferenceId(clientIdx, jobIdx) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `JOB-${stamp}-${clientIdx + 1}${jobIdx + 1}${Math.floor(Math.random() * 90 + 10)}`;
}

async function main() {
  const created = [];

  for (let i = 0; i < CLIENT_SEEDS.length; i++) {
    const clientSeed = CLIENT_SEEDS[i];
    const suffix = new Date().toISOString().slice(0, 10);

    const client = await prisma.client.create({
      data: {
        name: `${clientSeed.name} (${suffix})`,
        isAnonymous: false,
        contactName: clientSeed.contactName,
        contactEmail: clientSeed.contactEmail,
        contactPhone: clientSeed.contactPhone,
      },
    });

    const jobs = [];
    for (let j = 0; j < 2; j++) {
      const tpl = JOB_TEMPLATES[j % JOB_TEMPLATES.length];
      const job = await prisma.job.create({
        data: {
          referenceId: mkReferenceId(i, j),
          title: tpl.title,
          company: client.name,
          location: tpl.location,
          type: tpl.type,
          category: tpl.category,
          description: tpl.description,
          requirements: tpl.requirements,
          responsibilities: tpl.responsibilities,
          benefits: tpl.benefits,
          salary: tpl.salary,
          salaryPublic: false,
          experience: tpl.experience,
          education: tpl.education,
          minYearsExperience: tpl.minYearsExperience,
          educationLevel: tpl.educationLevel,
          educationQualification: tpl.educationQualification,
          requiredCertifications: tpl.requiredCertifications,
          skills: tpl.skills,
          isActive: true,
          applicationDeadline: nextDeadline(21 + j * 7),
          clientId: client.id,
          concealCompany: false,
        },
      });
      jobs.push(job);
    }

    created.push({ client, jobs });
  }

  console.log(`Created ${created.length} clients and ${created.length * 2} jobs.`);
  created.forEach((row, idx) => {
    console.log(`${idx + 1}. ${row.client.name}`);
    row.jobs.forEach((j) => console.log(`   - ${j.title} (${j.referenceId})`));
  });
}

main()
  .catch((e) => {
    console.error('Seed clients/jobs failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

