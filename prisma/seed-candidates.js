/**
 * Remove all existing applicants, then seed 50 candidates with full application data.
 * All fields an applicant can have are populated (education with discipline, employment with isCurrentJob,
 * professionalCertificationsList, professionalMemberships). Same CV path used for all.
 * Run: node prisma/seed-candidates.js
 * Requires: DATABASE_URL set and migrations applied.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SAME_CV_PATH = '/uploads/resumes/CV%20Justin%20Ombui.pdf';

const STATUSES = ['pending', 'reviewed', 'shortlisted', 'rejected', 'hired'];

const FIRST_NAMES = [
  'Jane', 'John', 'Grace', 'Peter', 'Mary', 'James', 'Lucy', 'David', 'Sarah', 'Michael',
  'Elizabeth', 'Robert', 'Anne', 'Joseph', 'Faith', 'Daniel', 'Ruth', 'Kevin', 'Catherine', 'Brian',
  'Nancy', 'Paul', 'Susan', 'Mark', 'Margaret', 'Thomas', 'Dorothy', 'Charles', 'Helen', 'Christopher',
  'Betty', 'George', 'Sandra', 'Edward', 'Ashley', 'Steven', 'Kimberly', 'Kenneth', 'Donna', 'Anthony',
  'Carol', 'Matthew', 'Michelle', 'Donald', 'Laura', 'Andrew', 'Sharon', 'Joshua', 'Patricia', 'Ryan',
];

const LAST_NAMES = [
  'Wanjiru', 'Kamau', 'Wanjiku', 'Ochieng', 'Akinyi', 'Mutua', 'Njeri', 'Kipchoge', 'Muthoni', 'Odhiambo',
  'Chebet', 'Kariuki', 'Achieng', 'Mwangi', 'Nyambura', 'Koech', 'Wambui', 'Omondi', 'Wairimu', 'Kipruto',
  'Otieno', 'Ouma', 'Adhiambo', 'Onyango', 'Aoko', 'Okoth', 'Atieno', 'Odongo', 'Anyango', 'Owiti',
  'Oloo', 'Odero', 'Akinyi', 'Opiyo', 'Adongo', 'Ochieng', 'Apiyo', 'Omondi', 'Awuor', 'Oduor',
  'Onyango', 'Otieno', 'Achieng', 'Okello', 'Adhiambo', 'Ouma', 'Onyango', 'Odhiambo', 'Akinyi', 'Ochieng',
];

const COUNTIES = [
  'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Kiambu', 'Nyeri', 'Meru', 'Machakos',
  'Uasin Gishu', 'Kakamega', 'Kisii', 'Kericho', 'Bungoma', 'Garissa', 'Kilifi', 'Murang\'a', 'Narok', 'Kitui',
];

const INSTITUTIONS = [
  'University of Nairobi', 'Kenyatta University', 'Moi University', 'Strathmore University', 'JKUAT',
  'Egerton University', 'Maseno University', 'Technical University of Kenya', 'Mount Kenya University', 'Daystar University',
];

const EDUCATION_LEVELS = ['high_school', 'certificate', 'diploma', 'undergraduate', 'masters', 'phd'];

const DISCIPLINES = [
  'Nursing', 'Commerce', 'Law', 'Engineering', 'Computer Science', 'Medicine', 'Education', 'Public Health',
  'Economics', 'Accounting', 'Finance', 'HR Management', 'Communication', 'Data Science', 'Actuarial Science', 'Architecture',
];

const CERT_NAMES = [
  'CPA K', 'ACCA', 'PMP', 'PRINCE2', 'BioHacking', 'Clinical Nursing', 'Health Informatics', 'Tax Practice',
  'Legal Practice', 'Teaching Council', 'Engineering Board', 'Medical Board', 'HR Certification', 'Data Analytics',
  'Cybersecurity', 'Project Management', 'Risk Management', 'Internal Audit', 'Financial Modelling', 'Digital Marketing',
];

const MEMBERSHIPS = [
  { name: 'KPMDU', noPrefix: 'KPM' },
  { name: 'ICPAK', noPrefix: 'ICP' },
  { name: 'LSK', noPrefix: 'LSK' },
  { name: 'Nursing Council', noPrefix: 'NC' },
  { name: 'Engineers Board', noPrefix: 'EBK' },
  { name: 'Medical Board', noPrefix: 'KMPDB' },
  { name: 'IHRM', noPrefix: 'IHRM' },
  { name: 'Marketing Society', noPrefix: 'MSK' },
  { name: 'Actuarial Society', noPrefix: 'ASKE' },
  { name: 'IT Association', noPrefix: 'ITA' },
];

const EMPLOYMENT_TEMPLATES = [
  { jobTitle: 'Accountant', companyName: 'ABC Ltd', industry: 'Finance', employmentType: 'Full-time' },
  { jobTitle: 'Sales Representative', companyName: 'Tech Solutions', industry: 'Technology', employmentType: 'Full-time' },
  { jobTitle: 'Consultant', companyName: 'Freelance', industry: 'Consulting', employmentType: 'Freelance' },
  { jobTitle: 'Project Manager', companyName: 'BuildCo', industry: 'Construction', employmentType: 'Contract' },
  { jobTitle: 'HR Officer', companyName: 'HR Solutions Kenya', industry: 'HR', employmentType: 'Full-time' },
  { jobTitle: 'Nurse', companyName: 'County Health Services', industry: 'Healthcare', employmentType: 'Full-time' },
  { jobTitle: 'Legal Officer', companyName: 'Law Firm LLP', industry: 'Legal', employmentType: 'Contract' },
  { jobTitle: 'Software Developer', companyName: 'DevHub', industry: 'Technology', employmentType: 'Full-time' },
  { jobTitle: 'Finance Manager', companyName: 'Bank Ltd', industry: 'Finance', employmentType: 'Full-time' },
  { jobTitle: 'Teacher', companyName: 'National School', industry: 'Education', employmentType: 'Full-time' },
];

function buildFormData(index) {
  const numEdu = 1 + (index % 4); // 1–4 education entries, varying levels
  const education = [];
  const usedLevels = new Set();
  for (let i = 0; i < numEdu; i++) {
    const level = EDUCATION_LEVELS[(index + i * 3) % EDUCATION_LEVELS.length];
    if (usedLevels.has(level)) continue;
    usedLevels.add(level);
    const discipline = DISCIPLINES[(index + i * 2) % DISCIPLINES.length];
    education.push({
      level,
      institution: INSTITUTIONS[(index + i) % INSTITUTIONS.length],
      grade: i === 0 ? 'Second Class Upper' : (i === 1 ? 'Distinction' : 'Credit'),
      discipline: level !== 'high_school' ? discipline : undefined,
    });
  }

  const numEmp = 1 + (index % 3);
  const employmentHistory = [];
  for (let i = 0; i < numEmp; i++) {
    const t = EMPLOYMENT_TEMPLATES[(index + i) % EMPLOYMENT_TEMPLATES.length];
    const startYear = 2018 + (index % 4);
    const endYear = 2023 + (i === numEmp - 1 ? 1 : 0);
    const isCurrent = i === numEmp - 1 && index % 2 === 0;
    employmentHistory.push({
      jobTitle: t.jobTitle,
      companyName: t.companyName,
      industry: t.industry,
      employmentType: t.employmentType,
      startDate: `${startYear}-${String(1 + (i % 12)).padStart(2, '0')}`,
      endDate: isCurrent ? '' : `${endYear}-${String(6 + (i % 6)).padStart(2, '0')}`,
      isCurrentJob: isCurrent,
    });
  }

  const numCerts = 0 + (index % 3); // 0–2 certs
  const professionalCertificationsList = [];
  const usedCerts = new Set();
  for (let i = 0; i < numCerts; i++) {
    const name = CERT_NAMES[(index + i * 5) % CERT_NAMES.length];
    if (usedCerts.has(name)) continue;
    usedCerts.add(name);
    professionalCertificationsList.push({ name });
  }

  const numMemberships = 0 + (index % 2); // 0–1 membership (some have 2)
  const professionalMemberships = [];
  const usedMemb = new Set();
  for (let i = 0; i < (numMemberships === 0 && index % 3 === 0 ? 1 : numMemberships + (index % 2)); i++) {
    const m = MEMBERSHIPS[(index + i * 2) % MEMBERSHIPS.length];
    if (usedMemb.has(m.name)) continue;
    usedMemb.add(m.name);
    professionalMemberships.push({
      name: m.name,
      membershipNo: `${m.noPrefix}-${String(10000 + index * 37 + i * 11).slice(-6)}`,
    });
  }

  return {
    gender: index % 2 === 0 ? 'Female' : 'Male',
    education,
    employmentHistory,
    professionalCertificationsList: professionalCertificationsList.length ? professionalCertificationsList : undefined,
    professionalMemberships: professionalMemberships.length ? professionalMemberships : undefined,
    declarations: {
      accurate: true,
      dataProcessing: true,
      backgroundChecks: true,
      talentPool: true,
    },
  };
}

function pickStatus(index) {
  return STATUSES[index % STATUSES.length];
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

async function main() {
  const jobCount = await prisma.job.count();
  if (jobCount === 0) {
    console.log('No job openings found. Create at least one job in Dashboard → Job openings, then run this seed again.');
    process.exit(1);
  }

  const jobs = await prisma.job.findMany({ take: 50, orderBy: { postedDate: 'desc' } });

  console.log('Removing all existing applications and candidates...');
  await prisma.interview.deleteMany({});
  await prisma.application.deleteMany({});
  await prisma.candidate.deleteMany({});
  console.log('Done. Seeding 50 candidates with full qualifications...');

  const created = [];
  for (let i = 0; i < 50; i++) {
    const firstName = FIRST_NAMES[i];
    const lastName = LAST_NAMES[i];
    const email = `seed.${String(i + 1).padStart(2, '0')}.${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/'/g, '')}@example.com`;
    const phone = `+254 7${String(10 + (i % 3))} ${String(1000000 + i * 12345).slice(0, 3)} ${String(100 + i * 7).slice(-3)}`;
    const county = COUNTIES[i % COUNTIES.length];
    const experience = 1 + (i % 15);
    const formData = buildFormData(i);
    const topLevel = formData.education && formData.education.length ? formData.education[formData.education.length - 1].level : 'undergraduate';
    const topDiscipline = formData.education && formData.education.length && formData.education[formData.education.length - 1].discipline
      ? formData.education[formData.education.length - 1].discipline
      : 'General';
    const educationLabel = `${topLevel.replace('_', ' ')} ${topDiscipline}`;

    const candidate = await prisma.candidate.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        location: county,
        nationality: 'Kenyan',
        homeCounty: county,
        experience,
        education: educationLabel,
        resumePath: SAME_CV_PATH,
      },
    });

    const job = jobs[i % jobs.length];
    const status = pickStatus(i);
    const appliedDate = daysAgo(1 + (i % 21));

    await prisma.application.create({
      data: {
        jobId: job.id,
        candidateId: candidate.id,
        status,
        appliedDate,
        coverLetter: i % 4 !== 0 ? `I am interested in the ${job.title} role and believe my experience is a strong match.` : null,
        resumePath: SAME_CV_PATH,
        notes: status === 'shortlisted' ? 'Strong fit. Schedule interview.' : null,
        formData,
      },
    });

    created.push({ name: `${firstName} ${lastName}`, job: job.title, status });
  }

  console.log('\nSeeded 50 applicants (same CV for all):');
  created.forEach((r, i) => console.log(`  ${i + 1}. ${r.name} → ${r.job} (${r.status})`));
  console.log('\nYou can now test filtering by Education, Certificate, Membership and the Applications tab.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
