import React from 'react';
import {
  IconBriefcase,
  IconUsersGroup,
  IconTrendingUp,
  IconSettings,
  IconShoppingCart,
  IconDeviceLaptop,
  IconHeartRateMonitor,
  IconScale,
  IconSpeakerphone,
  IconBuilding,
  IconSchool,
  IconTools,
  IconTruck,
  IconChartHistogram,
  IconGlobe,
  IconShieldCheck,
  IconFlask,
  IconBuildingSkyscraper,
  IconBuildingBank,
  IconHammer,
} from '@tabler/icons-react';

/**
 * Maps a job category name to a relevant Lucide icon.
 * Matching is case-insensitive substring — first match wins.
 * Falls back to Briefcase for anything unrecognised.
 */
type CategoryIcon = React.ComponentType<{ className?: string }>;

const CATEGORY_ICON_MAP: Array<{ keywords: string[]; icon: CategoryIcon }> = [
  { keywords: ['executive', 'c-suite', 'director', 'leadership', 'management'], icon: IconUsersGroup },
  { keywords: ['human resource', 'hr', 'people', 'talent', 'recruitment', 'staffing'], icon: IconUsersGroup },
  { keywords: ['finance', 'accounting', 'account', 'audit', 'tax', 'treasury', 'payroll'], icon: IconBuildingBank },
  { keywords: ['technology', 'software', 'engineer', 'developer', 'it ', 'data', 'cyber', 'cloud', 'devops'], icon: IconDeviceLaptop },
  { keywords: ['marketing', 'brand', 'digital', 'social media', 'content', 'seo', 'growth'], icon: IconSpeakerphone },
  { keywords: ['sales', 'business development', 'revenue', 'account manager'], icon: IconTrendingUp },
  { keywords: ['operation', 'logistics', 'supply chain', 'warehouse', 'distribution'], icon: IconTruck },
  { keywords: ['procurement', 'purchasing', 'buying', 'sourcing', 'vendor', 'supply'], icon: IconShoppingCart },
  { keywords: ['health', 'medical', 'clinical', 'nurse', 'doctor', 'pharma', 'clinic'], icon: IconHeartRateMonitor },
  { keywords: ['legal', 'compliance', 'law', 'counsel', 'regulatory', 'paralegal'], icon: IconScale },
  { keywords: ['education', 'training', 'teaching', 'academic', 'learning', 'instructor'], icon: IconSchool },
  { keywords: ['engineering', 'mechanical', 'electrical', 'civil', 'structural'], icon: IconTools },
  { keywords: ['construction', 'architect', 'site', 'project manager'], icon: IconHammer },
  { keywords: ['analytics', 'research', 'intelligence', 'insight', 'strategy'], icon: IconChartHistogram },
  { keywords: ['communications', 'public relation', 'pr', 'media'], icon: IconGlobe },
  { keywords: ['security', 'safety', 'risk', 'guard'], icon: IconShieldCheck },
  { keywords: ['science', 'laboratory', 'research', 'r&d', 'quality'], icon: IconFlask },
  { keywords: ['hospitality', 'hotel', 'tourism', 'travel', 'events', 'catering'], icon: IconBuildingSkyscraper },
  { keywords: ['admin', 'office', 'secretary', 'receptionist', 'clerical'], icon: IconBuilding },
  { keywords: ['customer service', 'support', 'call centre', 'helpdesk'], icon: IconSettings },
];

export function getCategoryIcon(category: string): CategoryIcon {
  const lower = category.toLowerCase();
  for (const entry of CATEGORY_ICON_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.icon;
    }
  }
  return IconBriefcase;
}
