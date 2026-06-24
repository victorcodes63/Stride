import { buildVerticalPackFromGeneric } from '../build-from-generic';

export const travelAgencyPack = buildVerticalPackFromGeneric({
  id: 'travel-agency',
  label: 'Travel agency demo',
  orgName: 'Horizon Travels Ltd',
  emailDomain: 'horizon.imara.co.ke',
  prefix: 'HZT',
  tagline: 'Commission payroll, leave, and people ops for travel and tour operators.',
  publicFooterText:
    'Horizon Travels Ltd runs on Stride — agent commissions, seasonal staffing, and payroll for travel businesses.',
  departments: [
    'Sales & Reservations',
    'Tour Operations',
    'Customer Service',
    'Marketing',
    'Finance',
    'HR',
  ],
  departmentMap: {
    Operations: 'Tour Operations',
    Sales: 'Sales & Reservations',
    Logistics: 'Tour Operations',
    Finance: 'Finance',
    'Human Resources': 'HR',
    ICT: 'Customer Service',
  },
  postalAddress: 'Upper Hill, Nairobi — IATA-accredited agency',
});
