'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import {
  Upload,
  FileText,
  User,
  Mail,
  Phone,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  X,
  GraduationCap,
  Briefcase,
  Paperclip,
  ShieldCheck,
  ClipboardList,
} from 'lucide-react';
import { JobListing } from '@/types/ats';
import { useATS } from '@/lib/use-ats';
import { yearsBetweenEmploymentDates } from '@/lib/employment-sort';
import type {
  ApplicationFormData,
  EducationEntry,
  EducationLevel,
  EmploymentEntry,
  EmploymentType,
  ProfessionalCertificationEntry,
  ProfessionalMembershipEntry,
} from '@/types/dashboard';

const EDUCATION_LEVELS_SINGLE: { value: EducationLevel; label: string }[] = [
  { value: 'high_school', label: 'High School' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'diploma', label: 'Diploma' },
];
const EDUCATION_LEVELS_MULTI: { value: EducationLevel; label: string }[] = [
  { value: 'undergraduate', label: 'Undergraduate' },
  { value: 'masters', label: 'Masters' },
  { value: 'phd', label: 'PhD / Doctorate' },
];

const GENDER_OPTIONS = [
  { value: '', label: 'Select gender' },
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
  { value: 'Prefer not to say', label: 'Prefer not to say' },
];

const EMPLOYMENT_TYPES: EmploymentType[] = ['Full-time', 'Contract', 'Freelance'];

const NATIONALITIES = [
  'Kenyan',
  'Ugandan',
  'Tanzanian',
  'Rwandan',
  'Ethiopian',
  'Somali',
  'South Sudanese',
  'Burundian',
  'Congolese',
  'Egyptian',
  'Nigerian',
  'Ghanaian',
  'South African',
  'Zimbabwean',
  'Malawian',
  'Zambian',
  'Botswanan',
  'Namibian',
  'British',
  'American',
  'Canadian',
  'Indian',
  'Pakistani',
  'Chinese',
  'Australian',
  'Other',
];

const KENYA_HOME_COUNTIES = [
  'Mombasa',
  'Kwale',
  'Kilifi',
  'Tana River',
  'Lamu',
  'Taita/Taveta',
  'Garissa',
  'Wajir',
  'Mandera',
  'Marsabit',
  'Isiolo',
  'Meru',
  'Tharaka-Nithi',
  'Embu',
  'Kitui',
  'Machakos',
  'Makueni',
  'Nyandarua',
  'Nyeri',
  'Kirinyaga',
  "Murang'a",
  'Kiambu',
  'Turkana',
  'West Pokot',
  'Samburu',
  'Trans Nzoia',
  'Uasin Gishu',
  'Elgeyo/Marakwet',
  'Nandi',
  'Baringo',
  'Laikipia',
  'Nakuru',
  'Narok',
  'Kajiado',
  'Kericho',
  'Bomet',
  'Kakamega',
  'Vihiga',
  'Bungoma',
  'Busia',
  'Siaya',
  'Kisumu',
  'Homa Bay',
  'Migori',
  'Kisii',
  'Nyamira',
  'Nairobi City',
] as const;
const HOME_COUNTY_OTHER_VALUE = '__other__';

function normalizeCountyName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0)
  );
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function getCountySuggestion(input: string): string | null {
  const normalizedInput = normalizeCountyName(input);
  if (!normalizedInput) return null;

  let bestMatch: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const county of KENYA_HOME_COUNTIES) {
    const normalizedCounty = normalizeCountyName(county);
    if (normalizedCounty === normalizedInput) return county;
    const distance = levenshteinDistance(normalizedInput, normalizedCounty);
    if (distance < bestScore) {
      bestScore = distance;
      bestMatch = county;
    }
  }

  // Suggest only when the value is likely a misspelling of an existing county.
  if (bestMatch && bestScore <= 2) return bestMatch;
  return null;
}

function emptyEducation(level: EducationLevel): EducationEntry {
  return { level, institution: '', grade: '', discipline: '', certificatePath: undefined };
}

const EMPTY_EMPLOYMENT: EmploymentEntry = {
  jobTitle: '',
  companyName: '',
  industry: '',
  employmentType: 'Full-time',
  startDate: '',
  endDate: '',
  isCurrentJob: false,
};

const EMPTY_PROF_CERT: ProfessionalCertificationEntry = { name: '' };
const EMPTY_MEMBERSHIP: ProfessionalMembershipEntry = { name: '', membershipNo: '' };

/** Format digits as number with comma every 3 digits (e.g. 80000 -> "80,000"). */
function formatSalaryDisplay(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits === '') return '';
  return Number(digits).toLocaleString();
}

/** Strip non-digits and return numeric string for submission. */
function parseSalaryForSubmit(value: string): string {
  return value.replace(/\D/g, '');
}

/** Compute total work experience years from employment entries (start/end dates). */
function totalWorkExperienceYears(
  entries: { startDate?: string; endDate?: string; isCurrentJob?: boolean }[]
): number {
  if (!entries?.length) return 0;
  return entries.reduce((sum, e) => {
    const end = e.isCurrentJob ? 'Present' : (e.endDate ?? '');
    return sum + yearsBetweenEmploymentDates(e.startDate ?? '', end);
  }, 0);
}

interface JobApplicationFormProps {
  job: JobListing;
  onSuccess?: (applicationId: string) => void;
  onClose?: () => void;
}

export default function JobApplicationForm({ job, onSuccess, onClose }: JobApplicationFormProps) {
  const { submitApplicationFull, uploadResume, uploadDocument } = useATS();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Stage 1: Candidate profile
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    nationality: '',
    homeCounty: '',
    salaryExpectations: '',
    gender: '',
  });
  const [homeCountyOther, setHomeCountyOther] = useState('');
  const [isHomeCountyOther, setIsHomeCountyOther] = useState(false);

  // Stage 2: Education (high_school, certificate, diploma single; undergrad, masters, phd multiple)
  const [education, setEducation] = useState<EducationEntry[]>(() => [
    emptyEducation('high_school'),
    emptyEducation('certificate'),
    emptyEducation('diploma'),
    emptyEducation('undergraduate'),
  ]);
  const [educationFiles, setEducationFiles] = useState<(File | null)[]>(() => [null, null, null, null]);

  // Stage 3: Employment (up to 10)
  const [employment, setEmployment] = useState<EmploymentEntry[]>([
    { ...EMPTY_EMPLOYMENT },
  ]);
  const employmentMax = 10;

  // Stage 4: Attachments
  const [coverLetter, setCoverLetter] = useState('');
  const [professionalCertificationsList, setProfessionalCertificationsList] = useState<ProfessionalCertificationEntry[]>(() => [{ ...EMPTY_PROF_CERT }]);
  const [professionalCertFiles, setProfessionalCertFiles] = useState<(File | null)[]>(() => [null]);
  const [professionalMemberships, setProfessionalMemberships] = useState<ProfessionalMembershipEntry[]>(() => [{ ...EMPTY_MEMBERSHIP }]);
  const [professionalMembershipFiles, setProfessionalMembershipFiles] = useState<(File | null)[]>(() => [null]);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvPath, setCvPath] = useState('');

  // Stage 5: Declarations
  const [declarations, setDeclarations] = useState({
    accurate: false,
    dataProcessing: false,
    backgroundChecks: false,
    talentPool: false,
  });

  const inputClass = (key: string) =>
    `w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
      errors[key] ? 'border-red-300' : 'border-neutral-300'
    }`;
  const showError = (key: string) =>
    errors[key] && (
      <p className="text-red-500 text-sm mt-1 flex items-center">
        <AlertCircle className="w-4 h-4 mr-1 shrink-0" />
        {errors[key]}
      </p>
    );

  const validateStage1 = () => {
    const e: Record<string, string> = {};
    const first = profile.firstName.trim();
    const last = profile.lastName.trim();
    if (!first) e.firstName = 'First name is required';
    else if (first.length < 2) e.firstName = 'First name must be at least 2 characters';
    if (!last) e.lastName = 'Last name is required';
    else if (last.length < 2) e.lastName = 'Last name must be at least 2 characters';
    if (!profile.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(profile.email)) e.email = 'Please enter a valid email address';
    else if (profile.email.length > 254) e.email = 'Email is too long';
    const phoneDigits = (profile.phone || '').replace(/\D/g, '');
    if (!profile.phone.trim()) e.phone = 'Phone number is required';
    else if (phoneDigits.length < 9) e.phone = 'Phone number must have at least 9 digits';
    if (!profile.nationality.trim()) e.nationality = 'Nationality is required';
    const homeCounty = (isHomeCountyOther ? homeCountyOther : profile.homeCounty).trim();
    if (!homeCounty) e.homeCounty = 'Home county is required';
    else if (homeCounty.length < 2) e.homeCounty = 'Home county must be at least 2 characters';
    else if (isHomeCountyOther) {
      const suggestion = getCountySuggestion(homeCounty);
      if (suggestion) {
        e.homeCounty = `Did you mean "${suggestion}"? Please select it from the county list instead of Other.`;
      }
    }
    if (!profile.gender.trim()) e.gender = 'Gender is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStage2 = () => {
    const e: Record<string, string> = {};
    education.forEach((entry, i) => {
      const hasContent = entry.institution.trim() || entry.grade.trim() || (entry.discipline ?? '').trim();
      if (hasContent && !educationFiles[i] && !entry.certificatePath) {
        e[`edu_cert_${i}`] = 'Certificate is required when institution or grade is filled';
      }
      if (entry.institution.trim() && !entry.grade.trim()) {
        e[`edu_grade_${i}`] = 'Grade is required when institution is filled';
      }
      if (entry.grade.trim() && !entry.institution.trim()) {
        e[`edu_institution_${i}`] = 'Institution is required when grade is filled';
      }
      if ((entry.institution.trim() || entry.grade.trim()) && !(entry.discipline ?? '').trim()) {
        e[`edu_discipline_${i}`] = 'Discipline is required';
      }
    });
    const hasCompleteEntry = education.some(
      (entry, i) =>
        entry.institution.trim() &&
        entry.grade.trim() &&
        (entry.discipline ?? '').trim() &&
        (educationFiles[i] || entry.certificatePath)
    );
    if (!hasCompleteEntry) {
      e.education = 'Please add at least one education entry with institution, grade, discipline, and certificate.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStage3 = () => {
    const e: Record<string, string> = {};
    const salaryDigits = parseSalaryForSubmit(profile.salaryExpectations);
    if (!salaryDigits) e.salaryExpectations = 'Minimum expected salary is required';
    else if (!/^\d+$/.test(salaryDigits) || parseInt(salaryDigits, 10) < 1) {
      e.salaryExpectations = 'Please enter a valid amount (numbers only)';
    } else if (salaryDigits.length > 12) {
      e.salaryExpectations = 'Please enter a reasonable amount';
    }
    const completeEntries = employment.filter(
      (entry) =>
        entry.jobTitle.trim() &&
        entry.companyName.trim() &&
        entry.startDate.trim() &&
        (entry.isCurrentJob || entry.endDate.trim())
    );
    if (completeEntries.length === 0) {
      e.employment = 'Please add at least one work experience entry (job title, company, start date, and end date or “Current job”).';
    }
    employment.forEach((entry, i) => {
      const hasAny = entry.jobTitle.trim() || entry.companyName.trim() || entry.industry.trim() || entry.endDate;
      if (hasAny && !entry.startDate.trim()) {
        e[`emp_start_${i}`] = 'Start date is required when employment details are provided';
      }
      if (hasAny && !entry.isCurrentJob && !entry.endDate.trim()) {
        e[`emp_end_${i}`] = 'End date is required when employment details are provided';
      }
      if (
        hasAny &&
        !entry.isCurrentJob &&
        entry.startDate.trim() &&
        entry.endDate.trim()
      ) {
        const start = new Date(entry.startDate);
        const end = new Date(entry.endDate);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end < start) {
          e[`emp_dates_${i}`] = 'End date must be on or after start date';
        }
      }
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStage4 = () => {
    const e: Record<string, string> = {};
    if (!cvFile && !cvPath) e.cv = 'CV is required';
    professionalCertificationsList.forEach((entry, i) => {
      if (entry.name.trim() && !professionalCertFiles[i]) {
        e[`prof_cert_${i}`] = 'Certificate is required when certification name is filled';
      }
    });
    professionalMemberships.forEach((entry, i) => {
      const hasName = entry.name.trim().length > 0;
      const hasMembershipNo = entry.membershipNo.trim().length > 0;
      const hasContent = hasName || hasMembershipNo;
      if (hasName && !hasMembershipNo) {
        e[`prof_mem_no_${i}`] = 'Membership number is required when membership name is provided';
      }
      if (hasContent && !professionalMembershipFiles[i]) {
        e[`prof_mem_${i}`] = 'Certificate is required when membership details are filled';
      }
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStage5 = () => {
    const e: Record<string, string> = {};
    if (!declarations.accurate) e.accurate = 'Please confirm the information is accurate';
    if (!declarations.dataProcessing) e.dataProcessing = 'Please consent to data processing';
    if (!declarations.backgroundChecks) e.backgroundChecks = 'Please consent to background checks';
    if (!declarations.talentPool) e.talentPool = 'Please agree to be added to the talent pool';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    setErrors({});
    if (step === 1 && !validateStage1()) return;
    if (step === 2 && !validateStage2()) return;
    if (step === 3 && !validateStage3()) return;
    if (step === 4 && !validateStage4()) return;
    if (step === 5 && !validateStage5()) return;
    if (step < 6) setStep((s) => s + 1);
  };

  const handleBack = () => {
    setErrors({});
    if (step > 1) setStep((s) => s - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!validateStage1()) { setStep(1); return; }
    if (!validateStage2()) { setStep(2); return; }
    if (!validateStage3()) { setStep(3); return; }
    if (!validateStage4()) { setStep(4); return; }
    if (!validateStage5()) { setStep(5); return; }

    setLoading(true);
    try {
      let resumePath = cvPath;
      if (cvFile && !resumePath) {
        resumePath = (await uploadResume(cvFile)) ?? '';
        if (!resumePath) {
          setErrors({ cv: 'Failed to upload CV. Please try again.' });
          setStep(4);
          setLoading(false);
          return;
        }
      }

      const certPaths: (string | undefined)[] = [];
      for (let i = 0; i < educationFiles.length; i++) {
        const file = educationFiles[i];
        if (file) {
          const path = await uploadDocument(file);
          certPaths[i] = path ?? undefined;
        } else {
          certPaths[i] = undefined;
        }
      }

      const educationPayload = education.map((entry, i) => ({
        level: entry.level,
        institution: entry.institution.trim(),
        grade: entry.grade.trim(),
        discipline: (entry.discipline ?? '').trim() || undefined,
        certificatePath: certPaths[i] ?? entry.certificatePath,
      }));

      const profCertPaths: string[] = [];
      for (let i = 0; i < professionalCertFiles.length; i++) {
        const file = professionalCertFiles[i];
        if (file) {
          const path = await uploadDocument(file);
          if (path) profCertPaths[i] = path;
        }
      }
      const memPaths: string[] = [];
      for (let i = 0; i < professionalMembershipFiles.length; i++) {
        const file = professionalMembershipFiles[i];
        if (file) {
          const path = await uploadDocument(file);
          if (path) memPaths[i] = path;
        }
      }

      const employmentPayload = employment
        .filter(
          (e) =>
            e.jobTitle.trim() ||
            e.companyName.trim() ||
            e.industry.trim() ||
            e.startDate ||
            e.endDate
        )
        .map((e) => ({
          jobTitle: e.jobTitle.trim(),
          companyName: e.companyName.trim(),
          industry: e.industry.trim(),
          employmentType: e.employmentType,
          startDate: e.startDate,
          endDate: e.isCurrentJob ? 'Present' : e.endDate,
          isCurrentJob: e.isCurrentJob ?? false,
        }));

      const professionalCertificationsListPayload = professionalCertificationsList
        .map((c, i) => ({
          name: c.name.trim(),
          certificatePath: profCertPaths[i] ?? undefined,
        }))
        .filter((c) => c.name);

      const professionalMembershipsPayload = professionalMemberships
        .map((m, i) => ({
          name: m.name.trim(),
          membershipNo: m.membershipNo.trim(),
          certificatePath: memPaths[i] ?? undefined,
        }))
        .filter((m) => m.name || m.membershipNo);

      const formData: ApplicationFormData = {
        gender: profile.gender.trim() || undefined,
        education: educationPayload,
        employmentHistory: employmentPayload,
        professionalCertificationsList: professionalCertificationsListPayload.length ? professionalCertificationsListPayload : undefined,
        professionalMemberships: professionalMembershipsPayload.length ? professionalMembershipsPayload : undefined,
        declarations,
      };

      const salaryValue = parseSalaryForSubmit(profile.salaryExpectations);
      const experienceYears = totalWorkExperienceYears(employmentPayload);
      const application = await submitApplicationFull({
        jobId: job.id,
        candidate: {
          firstName: profile.firstName.trim(),
          lastName: profile.lastName.trim(),
          email: profile.email.trim(),
          phone: profile.phone.trim(),
          nationality: profile.nationality.trim(),
          homeCounty: profile.homeCounty.trim(),
          experience: Math.round(experienceYears * 10) / 10,
        },
        salaryExpectations: salaryValue ? formatSalaryDisplay(salaryValue) : '',
        coverLetter: coverLetter.trim() || undefined,
        resumePath: resumePath || undefined,
        formData,
      });

      if (application?.id) {
        onSuccess?.(application.id);
        setStep(7);
      } else {
        setErrors({ general: 'Failed to submit application. Please try again.' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred. Please try again.';
      setErrors({ general: message });
    } finally {
      setLoading(false);
    }
  };

  const setEducationEntry = (index: number, field: keyof EducationEntry, value: string) => {
    setEducation((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addEducationEntry = (level: EducationLevel) => {
    setEducation((prev) => [...prev, emptyEducation(level)]);
    setEducationFiles((prev) => [...prev, null]);
  };

  const removeEducationEntry = (index: number) => {
    setEducation((prev) => prev.filter((_, i) => i !== index));
    setEducationFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const setEducationFile = (index: number, file: File | null) => {
    setEducationFiles((prev) => {
      const next = [...prev];
      while (next.length <= index) next.push(null);
      next[index] = file;
      return next;
    });
  };

  const setEmploymentEntry = (index: number, field: keyof EmploymentEntry, value: string | EmploymentType | boolean) => {
    setEmployment((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addEmployment = () => {
    if (employment.length < employmentMax) {
      setEmployment((prev) => [...prev, { ...EMPTY_EMPLOYMENT }]);
    }
  };

  const removeEmployment = (index: number) => {
    if (employment.length > 1) {
      setEmployment((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const setProfCertEntry = (index: number, field: keyof ProfessionalCertificationEntry, value: string) => {
    setProfessionalCertificationsList((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };
  const addProfCert = () => setProfessionalCertificationsList((prev) => [...prev, { ...EMPTY_PROF_CERT }]);
  const removeProfCert = (index: number) => {
    if (professionalCertificationsList.length > 1) {
      setProfessionalCertificationsList((prev) => prev.filter((_, i) => i !== index));
      setProfessionalCertFiles((prev) => prev.filter((_, i) => i !== index));
    }
  };
  const setProfCertFile = (index: number, file: File | null) => {
    setProfessionalCertFiles((prev) => {
      const next = [...prev];
      while (next.length <= index) next.push(null);
      next[index] = file;
      return next;
    });
  };

  const setMembershipEntry = (index: number, field: keyof ProfessionalMembershipEntry, value: string) => {
    setProfessionalMemberships((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };
  const addMembership = () => setProfessionalMemberships((prev) => [...prev, { ...EMPTY_MEMBERSHIP }]);
  const removeMembership = (index: number) => {
    if (professionalMemberships.length > 1) {
      setProfessionalMemberships((prev) => prev.filter((_, i) => i !== index));
      setProfessionalMembershipFiles((prev) => prev.filter((_, i) => i !== index));
    }
  };
  const setMembershipFile = (index: number, file: File | null) => {
    setProfessionalMembershipFiles((prev) => {
      const next = [...prev];
      while (next.length <= index) next.push(null);
      next[index] = file;
      return next;
    });
  };

  const cvAllowedType = 'application/pdf';
  const maxFileSize = 5 * 1024 * 1024;

  /** PDF-only handler for certificates/documents: rejects .doc/.docx immediately and resets input. */
  const handleDocumentFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (f: File | null) => void,
    errorKey: string
  ) => {
    const input = e.target;
    const file = input.files?.[0] ?? null;
    if (!file) {
      setter(null);
      setErrors((err) => ({ ...err, [errorKey]: '' }));
      return;
    }
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    const isWord = ext === 'doc' || ext === 'docx' || file.type === 'application/msword' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (isWord) {
      setter(null);
      input.value = '';
      setErrors((err) => ({ ...err, [errorKey]: 'Only PDF files are accepted. Word documents (.doc, .docx) are not accepted.' }));
      return;
    }
    if (ext !== 'pdf' || file.type !== 'application/pdf') {
      setter(null);
      input.value = '';
      setErrors((err) => ({ ...err, [errorKey]: 'Only PDF files are accepted.' }));
      return;
    }
    if (file.size > maxFileSize) {
      setter(null);
      input.value = '';
      setErrors((err) => ({ ...err, [errorKey]: 'File must be under 5MB.' }));
      return;
    }
    setter(file);
    setErrors((err) => ({ ...err, [errorKey]: '' }));
  };

  const steps = [
    { num: 1, title: 'Candidate profile' },
    { num: 2, title: 'Education' },
    { num: 3, title: 'Employment history' },
    { num: 4, title: 'Attachments' },
    { num: 5, title: 'Declarations' },
    { num: 6, title: 'Review & submit' },
  ];
  const selectedCounty =
    !isHomeCountyOther &&
    KENYA_HOME_COUNTIES.includes(profile.homeCounty as (typeof KENYA_HOME_COUNTIES)[number])
      ? profile.homeCounty
      : '';
  const homeCountySuggestion = isHomeCountyOther ? getCountySuggestion(homeCountyOther.trim()) : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl max-w-4xl w-full my-8 shadow-xl"
      >
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-4 sm:px-6 py-4 rounded-t-xl z-10">
          <div className="flex items-center justify-between gap-3 sm:gap-4 min-w-0">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-primary-900 line-clamp-2">Apply for {job.title}</h2>
              <p className="text-sm text-neutral-500">at {job.company}</p>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="flex gap-1 mt-3">
            {steps.map((s) => (
              <div
                key={s.num}
                className={`h-1 flex-1 rounded-full ${
                  step >= s.num ? 'bg-primary-600' : 'bg-neutral-200'
                }`}
                title={s.title}
              />
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-6 max-h-[70vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="s1"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <h3 className="text-base font-semibold text-primary-900 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Candidate profile
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">First name *</label>
                    <input
                      type="text"
                      value={profile.firstName}
                      onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))}
                      className={inputClass('firstName')}
                      placeholder="First name"
                      maxLength={100}
                      autoComplete="given-name"
                    />
                    {showError('firstName')}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Last name *</label>
                    <input
                      type="text"
                      value={profile.lastName}
                      onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))}
                      className={inputClass('lastName')}
                      placeholder="Last name"
                      maxLength={100}
                      autoComplete="family-name"
                    />
                    {showError('lastName')}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Gender *</label>
                  <select
                    value={profile.gender}
                    onChange={(e) => setProfile((p) => ({ ...p, gender: e.target.value }))}
                    className={inputClass('gender')}
                    aria-label="Gender"
                  >
                    {GENDER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {showError('gender')}
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                    className={inputClass('email')}
                    placeholder="email@example.com"
                    maxLength={254}
                    autoComplete="email"
                  />
                  <p className="mt-1 text-sm text-neutral-600">
                    This email will be used for application confirmation, interview invites, and outcomes.
                  </p>
                  {showError('email')}
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Phone number *</label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                    className={inputClass('phone')}
                    placeholder="+254..."
                    maxLength={30}
                    autoComplete="tel"
                  />
                  {showError('phone')}
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Nationality *</label>
                    <select
                      value={profile.nationality}
                      onChange={(e) => setProfile((p) => ({ ...p, nationality: e.target.value }))}
                      className={inputClass('nationality')}
                      aria-label="Nationality"
                    >
                      <option value="">Select nationality</option>
                      {NATIONALITIES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    {showError('nationality')}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Home county *</label>
                    <select
                      value={isHomeCountyOther ? HOME_COUNTY_OTHER_VALUE : selectedCounty}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === HOME_COUNTY_OTHER_VALUE) {
                          setIsHomeCountyOther(true);
                          setProfile((p) => ({ ...p, homeCounty: homeCountyOther.trim() }));
                          return;
                        }
                        setIsHomeCountyOther(false);
                        setHomeCountyOther('');
                        setProfile((p) => ({ ...p, homeCounty: value }));
                      }}
                      className={inputClass('homeCounty')}
                      aria-label="Home county"
                    >
                      <option value="">Select home county</option>
                      {KENYA_HOME_COUNTIES.map((county) => (
                        <option key={county} value={county}>
                          {county}
                        </option>
                      ))}
                      <option value={HOME_COUNTY_OTHER_VALUE}>Other (specify)</option>
                    </select>
                    {isHomeCountyOther && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={homeCountyOther}
                          onChange={(e) => {
                            const value = e.target.value;
                            setHomeCountyOther(value);
                            setProfile((p) => ({ ...p, homeCounty: value }));
                          }}
                          className={inputClass('homeCounty')}
                          placeholder="Enter home county"
                          maxLength={100}
                          autoComplete="address-level2"
                        />
                        {homeCountySuggestion && !errors.homeCounty && (
                          <p className="text-amber-700 text-sm mt-1">
                            Did you mean <strong>{homeCountySuggestion}</strong>? You can select it from the county list.
                          </p>
                        )}
                      </div>
                    )}
                    {showError('homeCounty')}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="s2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <h3 className="text-base font-semibold text-primary-900 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5" />
                  Education
                </h3>
                <p className="text-sm text-neutral-600">Add at least one education entry with institution, grade, discipline, and certificate.</p>
                {showError('education')}
                {EDUCATION_LEVELS_SINGLE.map(({ value, label }, idx) => (
                  <div key={`${value}-${idx}`} className="border border-neutral-200 rounded-lg p-4 space-y-3">
                    <h4 className="text-sm font-medium text-neutral-800">{label}</h4>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-neutral-600 mb-1">Institution *</label>
                        <input
                          type="text"
                          value={education[idx]?.institution ?? ''}
                          onChange={(e) => setEducationEntry(idx, 'institution', e.target.value)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                          placeholder="Institution name"
                        />
                        {showError(`edu_institution_${idx}`)}
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-600 mb-1">Grade *</label>
                        <input
                          type="text"
                          value={education[idx]?.grade ?? ''}
                          onChange={(e) => setEducationEntry(idx, 'grade', e.target.value)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                          placeholder={value === 'high_school' ? 'A' : 'Grade / class'}
                        />
                        {showError(`edu_grade_${idx}`)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-600 mb-1">Discipline *</label>
                      <input
                        type="text"
                        value={education[idx]?.discipline ?? ''}
                        onChange={(e) => setEducationEntry(idx, 'discipline', e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                        placeholder={value === 'high_school' ? 'KCSE/GCSE' : 'e.g. Sciences, Commerce, Nursing, Engineering'}
                      />
                      {showError(`edu_discipline_${idx}`)}
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-600 mb-1">Certificate * (required if above filled)</label>
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={(e) => handleDocumentFile(e, (f) => setEducationFile(idx, f), `edu_cert_${idx}`)}
                        className="w-full text-sm"
                      />
                      <p className="text-xs text-neutral-500 mt-1">PDF only</p>
                      {educationFiles[idx] && (
                        <p className="text-xs text-neutral-500 mt-1">{educationFiles[idx]?.name}</p>
                      )}
                      {showError(`edu_cert_${idx}`)}
                    </div>
                  </div>
                ))}
                {EDUCATION_LEVELS_MULTI.map(({ value, label }) => {
                  const indices = education.map((e, i) => (e.level === value ? i : -1)).filter((i) => i >= 0);
                  return (
                    <div key={value} className="border border-neutral-200 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-medium text-neutral-800">{label}</h4>
                        <button
                          type="button"
                          onClick={() => addEducationEntry(value)}
                          className="text-sm text-primary-600 hover:underline"
                        >
                          + Add entry
                        </button>
                      </div>
                      {indices.map((idx, subIdx) => {
                        return (
                          <div key={idx} className="bg-neutral-50 rounded-lg p-3 space-y-2 border border-neutral-100">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium text-neutral-600">Entry {subIdx + 1}</span>
                              {indices.length > 1 && (
                                <button type="button" onClick={() => removeEducationEntry(idx)} className="text-xs text-red-600 hover:underline">
                                  Remove
                                </button>
                              )}
                            </div>
                            <div className="grid md:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-neutral-600 mb-1">Institution *</label>
                                <input
                                  type="text"
                                  value={education[idx]?.institution ?? ''}
                                  onChange={(e) => setEducationEntry(idx, 'institution', e.target.value)}
                                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                                  placeholder="Institution name"
                                />
                                {showError(`edu_institution_${idx}`)}
                              </div>
                              <div>
                                <label className="block text-xs text-neutral-600 mb-1">Grade *</label>
                                <input
                                  type="text"
                                  value={education[idx]?.grade ?? ''}
                                  onChange={(e) => setEducationEntry(idx, 'grade', e.target.value)}
                                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                                  placeholder={value === 'high_school' ? 'A' : 'Grade / class'}
                                />
                                {showError(`edu_grade_${idx}`)}
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs text-neutral-600 mb-1">Discipline *</label>
                              <input
                                type="text"
                                value={education[idx]?.discipline ?? ''}
                                onChange={(e) => setEducationEntry(idx, 'discipline', e.target.value)}
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                                placeholder={value === 'high_school' ? 'KCSE/GCSE' : 'e.g. Sciences, Commerce, Nursing, Engineering'}
                              />
                              {showError(`edu_discipline_${idx}`)}
                            </div>
                            <div>
                              <label className="block text-xs text-neutral-600 mb-1">Certificate * (required if above filled)</label>
                              <input
                                type="file"
                                accept=".pdf,application/pdf"
                                onChange={(e) => handleDocumentFile(e, (f) => setEducationFile(idx, f), `edu_cert_${idx}`)}
                                className="w-full text-sm"
                              />
                              <p className="text-xs text-neutral-500 mt-1">PDF only</p>
                              {educationFiles[idx] && <p className="text-xs text-neutral-500 mt-1">{educationFiles[idx]?.name}</p>}
                              {showError(`edu_cert_${idx}`)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="s3"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <h3 className="text-base font-semibold text-primary-900 flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Employment history
                </h3>
                <p className="text-sm font-bold text-amber-700">
                  Add up to 10 relevant roles.
                  <br />
                  Applicants are required to provide a comprehensive summary of their work experience and qualifications. Kindly note that information will not be extracted from uploaded CVs. The details provided will significantly influence the shortlisting process.
                </p>
                {showError('employment')}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Minimum expected salary *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={profile.salaryExpectations}
                    onChange={(e) => {
                      const formatted = formatSalaryDisplay(e.target.value);
                      setProfile((p) => ({ ...p, salaryExpectations: formatted }));
                    }}
                    className={inputClass('salaryExpectations')}
                    placeholder="e.g. 80,000"
                    maxLength={18}
                  />
                  {showError('salaryExpectations')}
                </div>
                {employment.map((entry, idx) => (
                  <div key={idx} className="border border-neutral-200 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-neutral-700">Entry {idx + 1}</span>
                      {employment.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEmployment(idx)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-neutral-600 mb-1">Job title</label>
                        <input
                          type="text"
                          value={entry.jobTitle}
                          onChange={(e) => setEmploymentEntry(idx, 'jobTitle', e.target.value)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                          placeholder="Job title"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-600 mb-1">Company name</label>
                        <input
                          type="text"
                          value={entry.companyName}
                          onChange={(e) => setEmploymentEntry(idx, 'companyName', e.target.value)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                          placeholder="Company"
                        />
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-neutral-600 mb-1">Industry</label>
                        <input
                          type="text"
                          value={entry.industry}
                          onChange={(e) => setEmploymentEntry(idx, 'industry', e.target.value)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                          placeholder="Industry"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-600 mb-1">Employment type</label>
                        <select
                          value={entry.employmentType}
                          onChange={(e) =>
                            setEmploymentEntry(idx, 'employmentType', e.target.value as EmploymentType)
                          }
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                        >
                          {EMPLOYMENT_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-neutral-600 mb-1">Start date</label>
                        <input
                          type="month"
                          value={entry.startDate}
                          onChange={(e) => setEmploymentEntry(idx, 'startDate', e.target.value)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-600 mb-1">End date</label>
                        <input
                          type="month"
                          value={entry.isCurrentJob ? '' : entry.endDate}
                          onChange={(e) => setEmploymentEntry(idx, 'endDate', e.target.value)}
                          disabled={entry.isCurrentJob}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm disabled:bg-neutral-100 disabled:text-neutral-500"
                        />
                        {entry.isCurrentJob && (
                          <p className="text-xs text-neutral-500 mt-0.5">Current job — end date shown as Present</p>
                        )}
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer mt-2">
                      <input
                        type="checkbox"
                        checked={entry.isCurrentJob ?? false}
                        onChange={(e) => setEmploymentEntry(idx, 'isCurrentJob', e.target.checked)}
                        className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-neutral-700">This is my current job</span>
                    </label>
                    {(errors[`emp_start_${idx}`] || errors[`emp_end_${idx}`] || errors[`emp_dates_${idx}`]) && (
                      <p className="text-red-500 text-sm mt-1 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1 shrink-0" />
                        {errors[`emp_start_${idx}`] ?? errors[`emp_end_${idx}`] ?? errors[`emp_dates_${idx}`]}
                      </p>
                    )}
                  </div>
                ))}
                {employment.length < employmentMax && (
                  <button
                    type="button"
                    onClick={addEmployment}
                    className="text-sm text-primary-600 hover:underline"
                  >
                    + Add another employment
                  </button>
                )}
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="s4"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <h3 className="text-base font-semibold text-primary-900 flex items-center gap-2">
                  <Paperclip className="w-5 h-5" />
                  Attachments
                </h3>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Cover letter (optional)</label>
                  <textarea
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    placeholder="Why are you a good fit for this role? Add a brief cover letter for the employer."
                    rows={5}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y min-h-[100px] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">CV *</label>
                  <div className="border-2 border-dashed border-neutral-300 rounded-lg p-4 text-center">
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(e) => {
                        const input = e.target;
                        const f = input.files?.[0] ?? null;
                        if (!f) {
                          setCvFile(null);
                          setErrors((err) => ({ ...err, cv: '' }));
                          return;
                        }
                        const ext = (f.name.split('.').pop() ?? '').toLowerCase();
                        const isWord = ext === 'doc' || ext === 'docx' || f.type === 'application/msword' || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                        if (isWord) {
                          setCvFile(null);
                          input.value = '';
                          setErrors((err) => ({ ...err, cv: 'CV must be a PDF file. Word documents (.doc, .docx) are not accepted.' }));
                          return;
                        }
                        if (ext !== 'pdf' || f.type !== cvAllowedType) {
                          setCvFile(null);
                          input.value = '';
                          setErrors((err) => ({ ...err, cv: 'CV must be a PDF file so we can preview it in your application.' }));
                          return;
                        }
                        if (f.size > maxFileSize) {
                          setCvFile(null);
                          input.value = '';
                          setErrors((err) => ({ ...err, cv: 'File must be under 5MB.' }));
                          return;
                        }
                        setCvFile(f);
                        setCvPath('');
                        setErrors((err) => ({ ...err, cv: '' }));
                      }}
                      className="hidden"
                      id="cv-upload"
                    />
                    <label htmlFor="cv-upload" className="cursor-pointer">
                      <Upload className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                      <p className="text-sm text-neutral-600">
                        {cvFile ? cvFile.name : cvPath ? 'CV uploaded' : 'Click to upload CV'}
                      </p>
                      <p className="text-xs text-neutral-500">PDF only, max 5MB (required for preview)</p>
                    </label>
                  </div>
                  {showError('cv')}
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-neutral-700">
                      Professional certifications
                    </label>
                    <button type="button" onClick={addProfCert} className="text-sm text-primary-600 hover:underline">
                      + Add certification
                    </button>
                  </div>
                  <p className="text-xs text-neutral-600 mb-2">Certificate is required when you enter a certification name.</p>
                  {professionalCertificationsList.map((entry, i) => (
                    <div key={i} className="border border-neutral-200 rounded-lg p-3 mb-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-neutral-600">Certification {i + 1}</span>
                        {professionalCertificationsList.length > 1 && (
                          <button type="button" onClick={() => removeProfCert(i)} className="text-xs text-red-600 hover:underline">
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={entry.name}
                        onChange={(e) => setProfCertEntry(i, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                        placeholder="e.g. CPA, PMP"
                      />
                      <div>
                        <label className="block text-xs text-neutral-600 mb-1">Certificate * (required if above filled)</label>
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={(e) => handleDocumentFile(e, (f) => setProfCertFile(i, f), `prof_cert_${i}`)}
                          className="w-full text-sm"
                        />
                        <p className="text-xs text-neutral-500 mt-1">PDF only</p>
                        {professionalCertFiles[i] && <p className="text-xs text-neutral-500 mt-1">{professionalCertFiles[i]?.name}</p>}
                        {showError(`prof_cert_${i}`)}
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-neutral-700">
                      Professional memberships
                    </label>
                    <button type="button" onClick={addMembership} className="text-sm text-primary-600 hover:underline">
                      + Add membership
                    </button>
                  </div>
                  <p className="text-xs text-neutral-600 mb-2">When you provide a membership name, membership number is required. Certificate is required when membership details are filled.</p>
                  {professionalMemberships.map((entry, i) => (
                    <div key={i} className="border border-neutral-200 rounded-lg p-3 mb-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-neutral-600">Membership {i + 1}</span>
                        {professionalMemberships.length > 1 && (
                          <button type="button" onClick={() => removeMembership(i)} className="text-xs text-red-600 hover:underline">
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={entry.name}
                        onChange={(e) => setMembershipEntry(i, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm mb-2"
                        placeholder="e.g. Institute of Certified Public Accountants"
                      />
                      <div>
                        <input
                          type="text"
                          value={entry.membershipNo}
                          onChange={(e) => setMembershipEntry(i, 'membershipNo', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg text-sm ${showError(`prof_mem_no_${i}`) ? 'border-red-500' : 'border-neutral-300'}`}
                          placeholder="Membership number (required when name is provided)"
                        />
                        {showError(`prof_mem_no_${i}`)}
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-600 mb-1">Certificate * (required if above filled)</label>
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={(e) => handleDocumentFile(e, (f) => setMembershipFile(i, f), `prof_mem_${i}`)}
                          className="w-full text-sm"
                        />
                        <p className="text-xs text-neutral-500 mt-1">PDF only</p>
                        {professionalMembershipFiles[i] && <p className="text-xs text-neutral-500 mt-1">{professionalMembershipFiles[i]?.name}</p>}
                        {showError(`prof_mem_${i}`)}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="s5"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <h3 className="text-base font-semibold text-primary-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" />
                  Declarations and consent
                </h3>
                <div className="space-y-3">
                  {[
                    {
                      key: 'accurate' as const,
                      label: 'I confirm the information provided is accurate',
                    },
                    {
                      key: 'dataProcessing' as const,
                      label: 'I consent to data processing for recruitment purposes',
                    },
                    {
                      key: 'backgroundChecks' as const,
                      label: 'I consent to background and reference checks',
                    },
                    {
                      key: 'talentPool' as const,
                      label: 'I agree to be added to the talent pool for future roles',
                    },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={declarations[key]}
                        onChange={(e) =>
                          setDeclarations((d) => ({ ...d, [key]: e.target.checked }))
                        }
                        className="mt-1 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-neutral-700">{label}</span>
                    </label>
                  ))}
                </div>
                {showError('accurate')}
                {showError('dataProcessing')}
                {showError('backgroundChecks')}
                {showError('talentPool')}
              </motion.div>
            )}

            {step === 6 && (
              <motion.div
                key="s6"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <h3 className="text-base font-semibold text-primary-900 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" />
                  Final review
                </h3>
                <div className="bg-neutral-50 rounded-lg p-4 space-y-3 text-sm">
                  <div>
                    <p className="font-medium text-neutral-800">Profile</p>
                    <p className="text-neutral-600">
                      {profile.firstName} {profile.lastName} · {profile.email} · {profile.phone}
                    </p>
                    <p className="text-neutral-600">
                      {profile.nationality} · {profile.homeCounty}
                      {profile.gender && ` · ${profile.gender}`}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-neutral-800">Education</p>
                    {education
                      .filter((e) => e.institution || e.grade || (e.discipline ?? '').trim())
                      .map((e, i) => (
                        <p key={i} className="text-neutral-600">
                          {e.level.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}: {e.institution} {e.grade}
                          {(e.discipline ?? '').trim() && ` · ${e.discipline}`}
                        </p>
                      ))}
                  </div>
                  <div>
                    <p className="font-medium text-neutral-800">Employment</p>
                    {employment
                      .filter(
                        (e) =>
                          e.jobTitle || e.companyName || e.industry || e.startDate || e.endDate
                      )
                      .map((e, i) => (
                        <p key={i} className="text-neutral-600">
                          {e.jobTitle} at {e.companyName} ({e.employmentType}) · {e.startDate} – {e.isCurrentJob ? 'Present' : e.endDate}
                        </p>
                      ))}
                  </div>
                  <div>
                    <p className="font-medium text-neutral-800">Attachments</p>
                    {coverLetter.trim() && (
                      <p className="text-neutral-600 mb-1">
                        Cover letter: {coverLetter.trim().slice(0, 80)}{coverLetter.trim().length > 80 ? '…' : ''}
                      </p>
                    )}
                    <p className="text-neutral-600">
                      CV: {cvFile?.name ?? (cvPath ? 'Uploaded' : '—')}
                    </p>
                    {professionalCertificationsList.some((c) => c.name.trim()) && (
                      <p className="text-neutral-600">
                        Certifications: {professionalCertificationsList.filter((c) => c.name.trim()).map((c) => c.name).join(', ')}
                      </p>
                    )}
                    {professionalMemberships.some((m) => m.name.trim() || m.membershipNo.trim()) && (
                      <p className="text-neutral-600">
                        Memberships: {professionalMemberships.filter((m) => m.name.trim() || m.membershipNo.trim()).map((m) => `${m.name} (${m.membershipNo})`).join('; ')}
                      </p>
                    )}
                  </div>
                </div>
                {errors.general && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {errors.general}
                  </div>
                )}
                <p className="text-xs text-neutral-500">
                  Use &quot;Previous&quot; to edit any section, then &quot;Submit application&quot; to send.
                </p>
              </motion.div>
            )}

            {step === 7 && (
              <motion.div
                key="s7"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-6"
              >
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-primary-900 mb-2">Application submitted</h3>
                <p className="text-neutral-600 mb-6">
                  Thank you for applying to {job.title} at {job.company}. We&apos;ll review and be in touch.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {onClose && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-5 py-2.5 bg-primary-900 text-white rounded-lg font-medium hover:bg-primary-800"
                    >
                      Close
                    </button>
                  )}
                  <a
                    href="/careers"
                    className="px-5 py-2.5 border border-primary-900 text-primary-900 rounded-lg font-medium hover:bg-primary-50"
                  >
                    Browse more jobs
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {step >= 1 && step <= 6 && (
          <div className="sticky bottom-0 border-t border-neutral-200 px-6 py-4 bg-white rounded-b-xl flex justify-between gap-4">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 1}
              className="px-4 py-2.5 border border-neutral-300 rounded-lg text-neutral-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4 inline mr-1" />
              Previous
            </button>
            {step < 6 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2.5 bg-primary-900 text-white rounded-lg font-semibold hover:bg-primary-800"
              >
                Next
                <ArrowRight className="w-4 h-4 inline ml-1" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="px-4 py-2.5 bg-primary-900 text-white rounded-lg font-semibold hover:bg-primary-800 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Submit application
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
