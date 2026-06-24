/**
 * One-off builder: generates petroleum-retail/pack.ts from legacy seed-demo constants.
 * Run: npx tsx prisma/demo-packs/petroleum-retail/build-pack.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

function stripEmployeeBlock(raw: string): string {
  const lines = raw.split('\n');
  const out: string[] = [];
  let skip = false;
  for (const line of lines) {
    if (line.startsWith('const kenyanHolidays')) {
      skip = true;
      continue;
    }
    if (skip) {
      if (line === '];') skip = false;
      continue;
    }
    if (line.startsWith('type EmployeeSeed')) continue;
    if (line.startsWith('function d(') || line.startsWith('function daysFromToday(')) continue;
    if (line === '}') continue;
    if (line.startsWith('const DEMO_WORKSPACE')) {
      out.push(line.replace('DEMO_WORKSPACE', 'workspace').replace(' as const;', ';'));
      continue;
    }
    if (line.startsWith('const employeesSeed')) {
      out.push(line.replace('employeesSeed: EmployeeSeed[]', 'employees'));
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

function stripJobsBlock(raw: string): string {
  const lines = raw.split('\n');
  const out: string[] = [];
  let skipType = false;
  for (const line of lines) {
    if (line.startsWith('const STABEX_RECRUITMENT_EMPLOYER')) continue;
    if (line.startsWith('type StabexCareerJobSeed')) {
      skipType = true;
      continue;
    }
    if (skipType) {
      if (line === '};') skipType = false;
      continue;
    }
    if (line.startsWith('const STABEX_CAREERS_JOBS')) {
      out.push(line.replace('STABEX_CAREERS_JOBS: StabexCareerJobSeed[]', 'careersJobs'));
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

const employeesBlock = stripEmployeeBlock(
  readFileSync(path.join(dir, '_extracted-employees.txt'), 'utf8'),
);
const jobsBlock = stripJobsBlock(readFileSync(path.join(dir, '_extracted-jobs.txt'), 'utf8'));
const credentialsBlock = readFileSync(path.join(dir, '_extracted-credentials.txt'), 'utf8')
  .trim()
  .replace(/^const credentialsSeed = /, 'const credentials = ');

const packSource = `import type { DemoPack } from '../types';
import { d, daysFromToday } from '../date-helpers';

${employeesBlock}

${jobsBlock}

${credentialsBlock}

export const petroleumRetailPack: DemoPack = {
  id: 'petroleum-retail',
  label: 'Petroleum Retail (Stabex-style)',
  workspace,
  recruitmentEmployer: 'Stabex International',
  entities: {
    ke: {
      code: 'ke',
      legalName: 'Stabex Kenya Ltd',
      contactName: workspace.contactName,
      contactEmail: 'hr.ke@stabexintl.com',
      contactPhone: '+254 709 000000',
      postalAddress: 'Nairobi — retail, depot, fleet',
      county: 'Kenya',
      employeeNumberPrefix: 'STB-KE',
      currency: 'KES',
    },
    ug: {
      code: 'ug',
      legalName: 'Stabex Uganda Ltd',
      contactName: workspace.contactName,
      contactEmail: 'hr.ug@stabexintl.com',
      contactPhone: '+256 414 000000',
      postalAddress: 'Kampala — retail, depot, LPG',
      county: 'Uganda',
      employeeNumberPrefix: 'STB-UG',
      currency: 'UGX',
    },
  },
  legacyWorkspaceNames: ['Stabex International', 'Stabex Kenya Ltd', 'Demo Corporation'],
  departments,
  employees,
  careersJobs,
  credentials,
  pipelineEmailDomain: 'pipeline.demo.stabexintl.com',
  jobReferenceCode: 'STB',
  slugToken: 'stb',
  demoPassword: 'Demo@2026!',
  staffUsers: {
    admin: { email: 'demo@stabexintl.com', name: 'Amina Njeri' },
    hr: { email: 'diana.namutebi@stabexintl.com', name: 'Diana Namutebi' },
    finance: { email: 'james.mwangi@stabexintl.com', name: 'James Mwangi' },
    ess: { email: 'moses.okello@stabexintl.com', name: 'Moses Okello' },
    roleEmails: {
      brian: 'brian.otieno@stabexintl.com',
      grace: 'grace.nakato@stabexintl.com',
      aisha: 'aisha.wanjiru@stabexintl.com',
      robert: 'robert.ssem@stabexintl.com',
      james: 'james.mwangi@stabexintl.com',
      paul: 'paul.mugisha@stabexintl.com',
      moses: 'moses.okello@stabexintl.com',
      harriet: 'harriet.amanya@stabexintl.com',
      kevin: 'kevin.kamau@stabexintl.com',
      diana: 'diana.namutebi@stabexintl.com',
    },
  },
  interviewLocations: {
    video: 'https://meet.stabexintl.com/demo-interview-room',
    onsite: 'Stabex — Kampala HQ, Boardroom East (demo address)',
  },
  interviewBreakJobTitleIncludes: 'Station Supervisor',
};
`;

writeFileSync(path.join(dir, 'pack.ts'), packSource, 'utf8');
console.log('Wrote petroleum-retail/pack.ts');
