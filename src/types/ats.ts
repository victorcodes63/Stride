// ATS-specific types for job board integration
export interface JobListing {
  id: string;
  referenceId?: string; // e.g. JOB-2026-0001 for ease of reference
  slug?: string; // URL-safe e.g. senior-accountant-nairobi for /careers/apply/[slug]
  title: string;
  company: string;
  location: string;
  type: 'Full Time' | 'Part Time' | 'Contract' | 'Remote';
  category: string;
  postedDate: string;
  description: string;
  requirements: string;
  responsibilities: string;
  benefits: string;
  salary?: {
    min: number;
    max: number;
    currency: string;
  };
  experience: string;
  education: string;
  skills: string[];
  isActive: boolean;
  applicationStartAt?: string; // when applications open (ISO); if null, open immediately
  applicationDeadline?: string; // expiry date (ISO); visible on board and dashboard
  applicationCount: number;
  views: number;
}

export interface JobApplication {
  id: string;
  jobId: string;
  candidateId: string;
  status: 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired';
  appliedDate: string;
  coverLetter?: string;
  resumeUrl: string;
  notes?: string;
}

export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  experience: number;
  resumeUrl?: string;
  profilePicture?: string;
  createdAt: string;
  lastActive: string;
}

export interface Employer {
  id: string;
  companyName: string;
  email: string;
  phone: string;
  location: string;
  industry: string;
  companySize: string;
  logo?: string;
  website?: string;
  description: string;
  isVerified: boolean;
  subscriptionPlan: 'basic' | 'premium' | 'enterprise';
}

export interface JobAnalytics {
  jobId: string;
  views: number;
  applicationCount: number;
  applicationTrend?: { date: string; count: number }[];
  conversionRate?: number;
}

export interface JobSearchFilters {
  employerId?: string;
  keyword?: string;
  location?: string;
  category?: string;
  type?: string;
  experience?: string;
  salaryMin?: number;
  salaryMax?: number;
  postedWithin?: string; // '24h', '7d', '30d', '90d'
}

export interface ATSConfig {
  apiBaseUrl: string;
  apiKey: string;
  features: {
    jobPosting: boolean;
    candidateManagement: boolean;
    applicationTracking: boolean;
    analytics: boolean;
    emailNotifications: boolean;
    resumeParsing: boolean;
  };
  branding: {
    primaryColor: string;
    secondaryColor: string;
    logo?: string;
    customDomain?: string;
  };
}

