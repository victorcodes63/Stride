 

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const LOGIN_EMAIL = process.env.SMOKE_LOGIN_EMAIL;
const LOGIN_PASSWORD = process.env.SMOKE_LOGIN_PASSWORD;
const APPLICATION_EMAIL =
  process.env.SMOKE_APPLICATION_EMAIL || `smoke+${Date.now()}@example.com`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function jsonOrText(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  console.log('Running ATS smoke test against:', BASE_URL);
  assert(LOGIN_EMAIL, 'Missing SMOKE_LOGIN_EMAIL');
  assert(LOGIN_PASSWORD, 'Missing SMOKE_LOGIN_PASSWORD');

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: LOGIN_EMAIL,
      password: LOGIN_PASSWORD,
      rememberMe: false,
    }),
  });
  const loginPayload = await jsonOrText(loginRes);
  assert(loginRes.ok, `Login failed: ${JSON.stringify(loginPayload)}`);
  const cookieHeader = loginRes.headers.get('set-cookie');
  assert(cookieHeader, 'Login succeeded but no session cookie was returned.');
  const sessionCookie = cookieHeader.split(';')[0];
  console.log('1) Login: OK');

  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: sessionCookie },
  });
  const me = await jsonOrText(meRes);
  assert(meRes.ok, `Current user fetch failed: ${JSON.stringify(me)}`);
  console.log(`2) Current user: OK (${me.email})`);

  const jobsRes = await fetch(`${BASE_URL}/api/jobs`);
  const jobs = await jsonOrText(jobsRes);
  assert(jobsRes.ok && Array.isArray(jobs) && jobs.length > 0, 'No jobs available for smoke test.');
  const job = jobs.find((j) => j.isActive) || jobs[0];
  assert(job?.id, 'Could not resolve a job id for smoke test.');
  console.log(`3) Jobs: OK (using "${job.title}")`);

  const applicationPayload = {
    jobId: job.id,
    coverLetter: 'Smoke test submission for end-to-end ATS health check.',
    resumePath: '/uploads/resumes/smoke-test-cv.pdf',
    salaryExpectations: '120000',
    candidate: {
      firstName: 'Smoke',
      lastName: 'Tester',
      email: APPLICATION_EMAIL,
      phone: `+2547${String(Date.now()).slice(-8)}`,
      location: 'Nairobi',
      nationality: 'Kenyan',
      homeCounty: 'Nairobi',
      experience: 5,
      education: 'Bachelor of Human Resource Management',
    },
    formData: {
      gender: 'Other',
      education: [
        {
          level: 'undergraduate',
          institution: 'University of Nairobi',
          grade: 'Second Class Upper',
          discipline: 'Human Resource Management',
        },
      ],
      employmentHistory: [
        {
          jobTitle: 'HR Officer',
          companyName: 'Smoke Co',
          industry: 'HR',
          employmentType: 'Full-time',
          startDate: '2021-01',
          endDate: '2024-12',
          isCurrentJob: false,
        },
      ],
      professionalCertificationsList: [{ name: 'CHRP-K' }],
      professionalMemberships: [{ name: 'IHRM', membershipNo: 'SMOKE-1234' }],
      declarations: {
        accurate: true,
        dataProcessing: true,
        backgroundChecks: true,
        talentPool: true,
      },
    },
  };

  const applyRes = await fetch(`${BASE_URL}/api/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(applicationPayload),
  });
  const application = await jsonOrText(applyRes);
  assert(applyRes.ok, `Application submission failed: ${JSON.stringify(application)}`);
  assert(application.id, 'Application submission succeeded but no application id returned.');
  console.log(`4) Application submit: OK (${application.id})`);
  console.log('   - Confirmation email should be triggered asynchronously.');

  const patchRes = await fetch(`${BASE_URL}/api/applications/${application.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie,
    },
    body: JSON.stringify({ status: 'reviewed', notes: 'Smoke test status update.' }),
  });
  const patched = await jsonOrText(patchRes);
  assert(patchRes.ok, `Status update failed: ${JSON.stringify(patched)}`);
  console.log(`5) Status update: OK (${patched.status})`);

  const exportRes = await fetch(`${BASE_URL}/api/applications/export?status=reviewed`, {
    headers: { Cookie: sessionCookie },
  });
  assert(exportRes.ok, `Export failed: HTTP ${exportRes.status}`);
  const contentType = exportRes.headers.get('content-type') || '';
  assert(
    contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    `Unexpected export content-type: ${contentType}`
  );
  console.log('6) Export: OK (xlsx response)');

  console.log('\nSmoke test complete: PASS');
}

main().catch((error) => {
  console.error('\nSmoke test failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
