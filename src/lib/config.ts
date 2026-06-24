import { DEFAULT_BRAND_LOGO_SRC } from '@/lib/brand-constants';
import { brand } from '@/lib/brand';

// ATS Configuration
export const ATS_CONFIG = {
  // API Configuration
  API_BASE_URL: process.env.NEXT_PUBLIC_ATS_API_URL || 'https://api.example.com',
  API_KEY: process.env.NEXT_PUBLIC_ATS_API_KEY || '',
  
  // Feature Flags
  FEATURES: {
    JOB_POSTING: true,
    CANDIDATE_MANAGEMENT: true,
    APPLICATION_TRACKING: true,
    ANALYTICS: true,
    EMAIL_NOTIFICATIONS: true,
    RESUME_PARSING: true,
    ADVANCED_SEARCH: true,
    EMPLOYER_DASHBOARD: true,
  },
  
  // Branding (defaults; override via NEXT_PUBLIC_* — see src/lib/brand.ts)
  BRANDING: {
    PRIMARY_COLOR: '#FF5436',
    SECONDARY_COLOR: '#1A1714',
    LOGO: process.env.NEXT_PUBLIC_BRAND_LOGO || DEFAULT_BRAND_LOGO_SRC,
    COMPANY_NAME: brand.appName,
    DOMAIN: 'example.com',
  },
  
  // File Upload Settings
  UPLOAD: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    UPLOAD_PATH: '/uploads/resumes/',
  },
  
  // Pagination
  PAGINATION: {
    JOBS_PER_PAGE: 10,
    APPLICATIONS_PER_PAGE: 20,
    CANDIDATES_PER_PAGE: 15,
  },
  
  // Email Templates
  EMAIL_TEMPLATES: {
    APPLICATION_RECEIVED: 'application_received',
    APPLICATION_STATUS_UPDATE: 'application_status_update',
    JOB_POSTED: 'job_posted',
    CANDIDATE_SHORTLISTED: 'candidate_shortlisted',
  },
  
  // Job Categories
  JOB_CATEGORIES: [
    'Executive',
    'Sales & Marketing',
    'Education & Training',
    'Technology',
    'Operations',
    'Finance & Accounting',
    'Human Resources',
    'Customer Service',
    'Healthcare',
    'Engineering',
  ],
  
  // Job Types
  JOB_TYPES: [
    'Full Time',
    'Part Time',
    'Contract',
    'Remote',
    'Internship',
    'Freelance',
  ],
  
  // Experience Levels
  EXPERIENCE_LEVELS: [
    'Entry Level (0-2 years)',
    'Mid Level (3-5 years)',
    'Senior Level (6-10 years)',
    'Executive Level (10+ years)',
  ],
  
  // Salary Ranges (in KES)
  SALARY_RANGES: [
    { min: 0, max: 50000, label: 'Under KSh 50,000' },
    { min: 50000, max: 100000, label: 'KSh 50,000 - 100,000' },
    { min: 100000, max: 200000, label: 'KSh 100,000 - 200,000' },
    { min: 200000, max: 500000, label: 'KSh 200,000 - 500,000' },
    { min: 500000, max: 1000000, label: 'KSh 500,000 - 1,000,000' },
    { min: 1000000, max: 0, label: 'Above KSh 1,000,000' },
  ],
  
  // Application Statuses
  APPLICATION_STATUSES: [
    'pending',
    'reviewed',
    'shortlisted',
    'interview_scheduled',
    'interview_completed',
    'rejected',
    'hired',
    'withdrawn',
  ],
  
  // Notification Settings
  NOTIFICATIONS: {
    EMAIL_ENABLED: true,
    SMS_ENABLED: false,
    PUSH_ENABLED: false,
    APPLICATION_ALERTS: true,
    JOB_MATCH_ALERTS: true,
    STATUS_UPDATE_ALERTS: true,
  },
  
  // Analytics Settings
  ANALYTICS: {
    TRACK_APPLICATIONS: true,
    TRACK_JOB_VIEWS: true,
    TRACK_SEARCHES: true,
    TRACK_USER_BEHAVIOR: true,
    GOOGLE_ANALYTICS_ID: process.env.GOOGLE_ANALYTICS_ID || '',
  },
  
  // Security Settings
  SECURITY: {
    RATE_LIMIT_REQUESTS: 100,
    RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
    MAX_LOGIN_ATTEMPTS: 5,
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
  },
  
  // Integration Settings
  INTEGRATIONS: {
    LINKEDIN_ENABLED: false,
    GOOGLE_SIGNIN_ENABLED: false,
    FACEBOOK_SIGNIN_ENABLED: false,
    ZOOM_INTEGRATION: false,
    CALENDLY_INTEGRATION: false,
  },
};

// Helper functions
export const getJobCategoryIcon = (category: string) => {
  const iconMap: Record<string, string> = {
    'Executive': 'users',
    'Sales & Marketing': 'trending-up',
    'Education & Training': 'graduation-cap',
    'Technology': 'laptop',
    'Operations': 'settings',
    'Finance & Accounting': 'calculator',
    'Human Resources': 'users',
    'Customer Service': 'headphones',
    'Healthcare': 'heart',
    'Engineering': 'wrench',
  };
  return iconMap[category] || 'briefcase';
};

export const getJobTypeColor = (type: string) => {
  const colorMap: Record<string, string> = {
    'Full Time': 'bg-green-100 text-green-800',
    'Part Time': 'bg-blue-100 text-blue-800',
    'Contract': 'bg-purple-100 text-purple-800',
    'Remote': 'bg-orange-100 text-orange-800',
    'Internship': 'bg-yellow-100 text-yellow-800',
    'Freelance': 'bg-pink-100 text-pink-800',
  };
  return colorMap[type] || 'bg-gray-100 text-gray-800';
};

export const formatSalary = (min: number, max: number, currency: string = 'KES') => {
  if (min === max) {
    return `${currency} ${min.toLocaleString()}`;
  }
  return `${currency} ${min.toLocaleString()} - ${max.toLocaleString()}`;
};

export const formatDate = (date: string | Date) => {
  const d = new Date(date);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - d.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`; // 2-6 days
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  return d.toLocaleDateString('en-KE', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

export const validateEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone: string) => {
  const phoneRegex = /^(\+254|0)[0-9]{9}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

export const generateApplicationId = () => {
  return `APP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const generateJobId = () => {
  return `JOB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

