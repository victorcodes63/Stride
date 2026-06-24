/**
 * Full dev seed: 5 clients, 30 jobs (6 per client), 100 applicants.
 * All applicants use the same CV path (and optional doc path for certs).
 * Run: SEED_CV_PATH=/path/to/cv.pdf node prisma/seed-full-dev.js
 * Or: node prisma/seed-full-dev.js  (uses default placeholder path)
 *
 * Requires: DATABASE_URL set, migrations applied.
 * WARNING: Deletes all Interview, Application, Candidate, Job, and Client records.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const NUM_CLIENTS = 5;
const JOBS_PER_CLIENT = 6;
const NUM_APPLICANTS = 100;

const SAME_CV_PATH = process.env.SEED_CV_PATH || process.env.SEED_RESUME_PATH || '/uploads/resumes/seed-cv.pdf';
const SAME_DOC_PATH = process.env.SEED_DOC_PATH || '/uploads/documents/seed-doc.pdf';

function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'job';
}

const CLIENT_SEEDS = [
  { name: 'Apex Healthcare Group', contactName: 'Naomi Kendi', contactEmail: 'naomi.kendi@apex-healthcare.co.ke', contactPhone: '+254 700 121 001' },
  { name: 'BlueWave Logistics Ltd', contactName: 'Peter Mugo', contactEmail: 'peter.mugo@bluewave-logistics.co.ke', contactPhone: '+254 700 121 002' },
  { name: 'Cedar Financial Services', contactName: 'Diana Chebet', contactEmail: 'diana.chebet@cedarfs.co.ke', contactPhone: '+254 700 121 003' },
  { name: 'Delta Agro Industries', contactName: 'Samuel Otieno', contactEmail: 'samuel.otieno@deltaagro.co.ke', contactPhone: '+254 700 121 004' },
  { name: 'Evergreen Education Trust', contactName: 'Lilian Wanjiru', contactEmail: 'lilian.wanjiru@evergreen-edu.org', contactPhone: '+254 700 121 005' },
];

const JOB_TEMPLATES = [
  { title: 'Operations Manager', location: 'Nairobi', type: 'Full Time', category: 'Operations', description: 'Lead daily operations and coordinate cross-functional teams.', requirements: ['Bachelor in Business or related', '5+ years operations experience'], responsibilities: ['Oversee operations', 'Track KPIs'], benefits: ['Medical', 'Bonus'], salary: { min: 180000, max: 260000, currency: 'KES' }, experience: '5+ years', education: 'Bachelor required', minYearsExperience: 5, educationLevel: 'Bachelor', educationQualification: 'Business Administration', requiredCertifications: null, skills: ['Operations', 'Process Improvement'] },
  { title: 'HR Officer', location: 'Nairobi', type: 'Full Time', category: 'Human Resources', description: 'Support talent acquisition and employee relations.', requirements: ['Degree in HR or related', '3+ years HR experience'], responsibilities: ['Recruitment', 'Onboarding', 'HR records'], benefits: ['Health insurance', 'Hybrid'], salary: { min: 120000, max: 180000, currency: 'KES' }, experience: '3+ years', education: 'Bachelor in HR', minYearsExperience: 3, educationLevel: 'Bachelor', educationQualification: 'HR Management', requiredCertifications: 'IHRM preferred', skills: ['Recruitment', 'Employee Relations'] },
  { title: 'Finance Officer', location: 'Nairobi', type: 'Full Time', category: 'Finance', description: 'Manage accounts, reporting and compliance.', requirements: ['CPA or ACCA', '4+ years finance'], responsibilities: ['Financial reporting', 'Reconciliation'], benefits: ['Medical', 'Pension'], salary: { min: 150000, max: 220000, currency: 'KES' }, experience: '4+ years', education: 'Bachelor in Finance/Accounting', minYearsExperience: 4, educationLevel: 'Bachelor', educationQualification: 'Commerce, Accounting', requiredCertifications: 'CPA K', skills: ['Accounting', 'Reporting'] },
  { title: 'IT Support Specialist', location: 'Nairobi', type: 'Full Time', category: 'Technology', description: 'Provide technical support and maintain systems.', requirements: ['IT diploma/degree', '2+ years support'], responsibilities: ['Help desk', 'System maintenance'], benefits: ['Medical', 'Training'], salary: { min: 80000, max: 140000, currency: 'KES' }, experience: '2+ years', education: 'Diploma or degree in IT', minYearsExperience: 2, educationLevel: 'Diploma', educationQualification: 'IT, Computer Science', requiredCertifications: null, skills: ['Help Desk', 'Windows', 'Networks'] },
  { title: 'Marketing Coordinator', location: 'Nairobi', type: 'Full Time', category: 'Marketing', description: 'Support marketing campaigns and digital presence.', requirements: ['Degree in Marketing or related', '2+ years marketing'], responsibilities: ['Campaigns', 'Content', 'Social media'], benefits: ['Medical', 'Flexible'], salary: { min: 90000, max: 150000, currency: 'KES' }, experience: '2+ years', education: 'Bachelor in Marketing', minYearsExperience: 2, educationLevel: 'Bachelor', educationQualification: 'Marketing, Communication', requiredCertifications: null, skills: ['Digital Marketing', 'Content'] },
  { title: 'Procurement Officer', location: 'Nairobi', type: 'Full Time', category: 'Procurement', description: 'Manage sourcing and supplier relationships.', requirements: ['Degree in Procurement/Supply Chain', '3+ years procurement'], responsibilities: ['Sourcing', 'Contracts', 'Vendor management'], benefits: ['Medical', 'Bonus'], salary: { min: 110000, max: 170000, currency: 'KES' }, experience: '3+ years', education: 'Bachelor in Procurement', minYearsExperience: 3, educationLevel: 'Bachelor', educationQualification: 'Procurement, Supply Chain', requiredCertifications: 'CIPS preferred', skills: ['Procurement', 'Negotiation'] },
];

const STATUSES = ['pending', 'reviewed', 'shortlisted', 'rejected', 'hired'];
const FIRST_NAMES = ['Jane', 'John', 'Grace', 'Peter', 'Mary', 'James', 'Lucy', 'David', 'Sarah', 'Michael', 'Elizabeth', 'Robert', 'Anne', 'Joseph', 'Faith', 'Daniel', 'Ruth', 'Kevin', 'Catherine', 'Brian', 'Nancy', 'Paul', 'Susan', 'Mark', 'Margaret', 'Thomas', 'Dorothy', 'Charles', 'Helen', 'Christopher', 'Betty', 'George', 'Sandra', 'Edward', 'Ashley', 'Steven', 'Kimberly', 'Kenneth', 'Donna', 'Anthony', 'Carol', 'Matthew', 'Michelle', 'Donald', 'Laura', 'Andrew', 'Sharon', 'Joshua', 'Patricia', 'Ryan', 'Nicole', 'Eric', 'Angela', 'Stephen', 'Rebecca', 'Jason', 'Kathleen', 'Justin', 'Amy', 'Brandon', 'Deborah', 'Benjamin', 'Lisa', 'Samuel', 'Dorothy', 'Raymond', 'Carolyn', 'Gregory', 'Michelle', 'Frank', 'Laura', 'Patrick', 'Maria', 'Alexander', 'Heather', 'Jack', 'Diana', 'Dennis', 'Julie', 'Jerry', 'Joyce', 'Tyler', 'Evelyn', 'Aaron', 'Judith', 'Jose', 'Hannah', 'Henry', 'Olivia', 'Nathan', 'Sophia', 'Zachary', 'Isabella', 'Peter', 'Emma', 'Kyle', 'Ava', 'Noah', 'Mia', 'Liam', 'Charlotte', 'Mason', 'Amelia', 'Ethan', 'Harper'];
const LAST_NAMES = ['Wanjiru', 'Kamau', 'Wanjiku', 'Ochieng', 'Akinyi', 'Mutua', 'Njeri', 'Kipchoge', 'Muthoni', 'Odhiambo', 'Chebet', 'Kariuki', 'Achieng', 'Mwangi', 'Nyambura', 'Koech', 'Wambui', 'Omondi', 'Wairimu', 'Kipruto', 'Otieno', 'Ouma', 'Adhiambo', 'Onyango', 'Aoko', 'Okoth', 'Atieno', 'Odongo', 'Anyango', 'Owiti', 'Oloo', 'Odero', 'Akinyi', 'Opiyo', 'Adongo', 'Ochieng', 'Apiyo', 'Omondi', 'Awuor', 'Oduor', 'Onyango', 'Otieno', 'Achieng', 'Okello', 'Adhiambo', 'Ouma', 'Onyango', 'Odhiambo', 'Akinyi', 'Ochieng', 'Kibet', 'Chepkoech', 'Korir', 'Jepchumba', 'Kiprop', 'Chebet', 'Kiplagat', 'Jepkorir', 'Kemboi', 'Chepngetich', 'Kipchumba', 'Jepchirchir', 'Kosgei', 'Chepchumba', 'Kipngetich', 'Jepkemoi', 'Keter', 'Chepkurui', 'Kiprono', 'Jepngetich', 'Kibiwott', 'Chepkemboi', 'Kipruto', 'Jepkoech', 'Kibet', 'Chebet', 'Korir', 'Jepchumba', 'Kiprop', 'Chepkoech', 'Kiplagat', 'Jepkorir', 'Kemboi', 'Chepngetich', 'Kipchumba', 'Jepchirchir', 'Kosgei', 'Chepchumba', 'Kipngetich', 'Jepkemoi', 'Keter', 'Chepkurui', 'Kiprono', 'Jepngetich', 'Kibiwott', 'Chepkemboi', 'Kipruto', 'Jepkoech'];
const COUNTIES = ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Kiambu', 'Nyeri', 'Meru', 'Machakos', 'Uasin Gishu', 'Kakamega', 'Kisii', 'Kericho', 'Bungoma', 'Garissa', 'Kilifi', "Murang'a", 'Narok', 'Kitui'];
const INSTITUTIONS = ['University of Nairobi', 'Kenyatta University', 'Moi University', 'Strathmore University', 'JKUAT', 'Egerton University', 'Maseno University', 'Technical University of Kenya', 'Mount Kenya University', 'Daystar University'];
const EDUCATION_LEVELS = ['high_school', 'certificate', 'diploma', 'undergraduate', 'masters', 'phd'];
const DISCIPLINES = ['Nursing', 'Commerce', 'Law', 'Engineering', 'Computer Science', 'Medicine', 'Education', 'Public Health', 'Economics', 'Accounting', 'Finance', 'HR Management', 'Communication', 'Data Science', 'Actuarial Science', 'Architecture'];
const CERT_NAMES = ['CPA K', 'ACCA', 'PMP', 'PRINCE2', 'Clinical Nursing', 'Tax Practice', 'Legal Practice', 'Teaching Council', 'Engineering Board', 'IHRM', 'Data Analytics', 'Cybersecurity', 'Project Management', 'CIPS', 'Digital Marketing'];
const MEMBERSHIPS = [{ name: 'KPMDU', noPrefix: 'KPM' }, { name: 'ICPAK', noPrefix: 'ICP' }, { name: 'LSK', noPrefix: 'LSK' }, { name: 'Nursing Council', noPrefix: 'NC' }, { name: 'Engineers Board', noPrefix: 'EBK' }, { name: 'IHRM', noPrefix: 'IHRM' }, { name: 'Marketing Society', noPrefix: 'MSK' }, { name: 'IT Association', noPrefix: 'ITA' }];
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

function nextDeadline(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

function mkReferenceId(year, seq) {
  return `JOB-${year}-${String(seq).padStart(4, '0')}`;
}

function buildFormData(index, docPath) {
  const numEdu = 1 + (index % 4);
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
  const numCerts = index % 3;
  const professionalCertificationsList = [];
  const usedCerts = new Set();
  for (let i = 0; i < numCerts; i++) {
    const name = CERT_NAMES[(index + i * 5) % CERT_NAMES.length];
    if (usedCerts.has(name)) continue;
    usedCerts.add(name);
    professionalCertificationsList.push({ name, certificatePath: docPath });
  }
  const numMemberships = index % 2;
  const professionalMemberships = [];
  const usedMemb = new Set();
  for (let i = 0; i < (numMemberships || (index % 3 === 0 ? 1 : 0)); i++) {
    const m = MEMBERSHIPS[(index + i * 2) % MEMBERSHIPS.length];
    if (usedMemb.has(m.name)) continue;
    usedMemb.add(m.name);
    professionalMemberships.push({
      name: m.name,
      membershipNo: `${m.noPrefix}-${String(10000 + index * 37 + i * 11).slice(-6)}`,
      certificatePath: docPath,
    });
  }
  return {
    gender: index % 2 === 0 ? 'Female' : 'Male',
    education,
    employmentHistory,
    professionalCertificationsList: professionalCertificationsList.length ? professionalCertificationsList : undefined,
    professionalMemberships: professionalMemberships.length ? professionalMemberships : undefined,
    declarations: { accurate: true, dataProcessing: true, backgroundChecks: true, talentPool: true },
  };
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

async function main() {
  console.log('Using CV path:', SAME_CV_PATH);
  console.log('Using doc path for certs/memberships:', SAME_DOC_PATH);
  console.log('Cleaning existing data...');
  try {
    await prisma.interview.deleteMany({});
    await prisma.application.deleteMany({});
    await prisma.candidate.deleteMany({});
    await prisma.job.deleteMany({});
    await prisma.client.deleteMany({});
  } catch (e) {
    if (e.code === 'P2021') {
      console.error('One or more tables are missing. Run: npx prisma migrate deploy');
      process.exit(1);
    }
    throw e;
  }
  console.log('Creating 5 clients and 30 jobs...');

  const year = new Date().getFullYear();
  let jobSeq = 1;
  const allJobs = [];

  for (let i = 0; i < NUM_CLIENTS; i++) {
    const c = CLIENT_SEEDS[i];
    const client = await prisma.client.create({
      data: {
        name: c.name,
        isAnonymous: false,
        contactName: c.contactName,
        contactEmail: c.contactEmail,
        contactPhone: c.contactPhone,
      },
    });
    for (let j = 0; j < JOBS_PER_CLIENT; j++) {
      const tpl = JOB_TEMPLATES[j % JOB_TEMPLATES.length];
      const job = await prisma.job.create({
        data: {
          referenceId: mkReferenceId(year, jobSeq++),
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
      const slugBase = slugify(tpl.title + ' ' + tpl.location);
      const slug = `${slugBase}-${job.id.slice(0, 8)}`;
      await prisma.job.update({ where: { id: job.id }, data: { slug } });
      allJobs.push({ ...job, slug });
    }
  }

  const allApplications = [];
  console.log('Creating 100 candidates and 100 applications...');
  for (let i = 0; i < NUM_APPLICANTS; i++) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const email = `dev.${String(i + 1).padStart(3, '0')}.${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/'/g, '')}@example.com`;
    const phone = `+254 7${String(10 + (i % 3))} ${String(1000000 + i * 12345).slice(0, 3)} ${String(100 + i * 7).slice(-3)}`;
    const county = COUNTIES[i % COUNTIES.length];
    const experience = 1 + (i % 15);
    const formData = buildFormData(i, SAME_DOC_PATH);
    const topEdu = formData.education && formData.education.length ? formData.education[formData.education.length - 1] : {};
    const educationLabel = `${(topEdu.level || 'undergraduate').replace('_', ' ')} ${topEdu.discipline || 'General'}`;

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

    const job = allJobs[i % allJobs.length];
    const status = STATUSES[i % STATUSES.length];
    const app = await prisma.application.create({
      data: {
        jobId: job.id,
        candidateId: candidate.id,
        status,
        appliedDate: daysAgo(1 + (i % 30)),
        coverLetter: i % 4 !== 0 ? `I am interested in the ${job.title} role and believe my experience is a strong match.` : null,
        resumePath: SAME_CV_PATH,
        salaryExpectations: i % 3 === 0 ? '' : `${80000 + (i % 15) * 10000}-${120000 + (i % 15) * 10000} KES`,
        notes: status === 'shortlisted' ? 'Strong fit. Schedule interview.' : null,
        formData,
      },
    });
    allApplications.push(app);
  }

  // Seed 10 interviews for demo (mix of scheduled, completed, cancelled)
  const INTERVIEW_TYPES = ['phone', 'video', 'onsite'];
  const INTERVIEW_DURATIONS = [30, 45, 60];
  const pickApps = [2, 12, 22, 32, 42, 52, 62, 72, 82, 92]; // spread across jobs/candidates
  const now = new Date();
  const scheduleTime = (daysFromNow, hour = 10) => {
    const d = new Date(now);
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  const interviewSeeds = [
    { days: 2, hour: 9, type: 'video', duration: 45, status: 'scheduled', link: 'https://meet.google.com/abc-defg-hij', notes: 'First round - technical discussion.', inviteSent: true },
    { days: 1, hour: 14, type: 'phone', duration: 30, status: 'scheduled', link: null, notes: 'Screening call.', inviteSent: false },
    { days: 0, hour: 11, type: 'onsite', duration: 60, status: 'scheduled', link: 'Head Office, Nairobi - Room 3', notes: 'Panel interview with hiring manager.', inviteSent: true },
    { days: 3, hour: 10, type: 'video', duration: 45, status: 'scheduled', link: 'https://zoom.us/j/123456789', notes: 'Final round - culture fit.', inviteSent: false },
    { days: -2, hour: 15, type: 'phone', duration: 30, status: 'completed', link: null, notes: 'Screening completed. Proceed to next round.', inviteSent: true },
    { days: -1, hour: 10, type: 'video', duration: 45, status: 'completed', link: 'https://meet.google.com/xyz-uvwx-rst', notes: 'Strong technical skills. Shortlist for onsite.', inviteSent: true },
    { days: 5, hour: 9, type: 'onsite', duration: 60, status: 'scheduled', link: 'Apex Healthcare HQ, Eldoret', notes: 'Onsite with department head.', inviteSent: false },
    { days: -3, hour: 11, type: 'video', duration: 45, status: 'cancelled', link: null, notes: 'Candidate withdrew. Reschedule if they re-apply.', inviteSent: true },
    { days: 4, hour: 14, type: 'phone', duration: 30, status: 'scheduled', link: null, notes: 'Initial screening for Operations Manager role.', inviteSent: false },
    { days: 7, hour: 10, type: 'onsite', duration: 60, status: 'scheduled', link: 'BlueWave Logistics, Mombasa Office', notes: 'Final onsite - offer discussion.', inviteSent: false },
  ];
  for (let idx = 0; idx < 10 && idx < pickApps.length && pickApps[idx] < allApplications.length; idx++) {
    const app = allApplications[pickApps[idx]];
    const s = interviewSeeds[idx];
    if (!app) continue;
    await prisma.interview.create({
      data: {
        applicationId: app.id,
        scheduledAt: scheduleTime(s.days, s.hour),
        durationMinutes: s.duration,
        type: s.type,
        locationOrLink: s.link,
        notes: s.notes,
        status: s.status,
        inviteSentAt: s.inviteSent ? scheduleTime(s.days, s.hour - 1) : null,
      },
    });
  }
  console.log('Created 10 interviews (scheduled, completed, cancelled).');

  const appCounts = await prisma.application.groupBy({
    by: ['jobId'],
    _count: true,
    where: { jobId: { in: allJobs.map((j) => j.id) } },
  });
  const countByJob = Object.fromEntries(appCounts.map((a) => [a.jobId, a._count]));
  for (const job of allJobs) {
    await prisma.job.update({
      where: { id: job.id },
      data: { applicationCount: countByJob[job.id] || 0 },
    });
  }

  console.log('\nDone.');
  console.log('Clients:', NUM_CLIENTS);
  console.log('Jobs:', allJobs.length, '(6 per client, with slugs)');
  console.log('Applicants:', NUM_APPLICANTS, '(candidates + applications, same CV path for all)');
  console.log('Interviews: 10 (mix of phone/video/onsite, scheduled/completed/cancelled)');
  console.log('\nSet SEED_CV_PATH (and optionally SEED_DOC_PATH) to use your uploaded CV/document paths.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
