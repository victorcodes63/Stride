import { buildVerticalPackFromGeneric } from '../build-from-generic';

export const constructionPack = buildVerticalPackFromGeneric({
  id: 'construction',
  label: 'Construction demo',
  orgName: 'Kilimani Builders Ltd',
  emailDomain: 'kilimani.imara.co.ke',
  prefix: 'KBL',
  tagline: 'Site projects, plant tracking, and subcontractor spend on one platform.',
  publicFooterText:
    'Kilimani Builders Ltd runs on Stride — site budgets, milestones, and workforce costs in one view.',
  departments: [
    'Site Operations',
    'Plant & Equipment',
    'Procurement',
    'Quantity Surveying',
    'Finance',
    'HR',
  ],
  departmentMap: {
    Operations: 'Site Operations',
    Sales: 'Quantity Surveying',
    Logistics: 'Plant & Equipment',
    Finance: 'Finance',
    'Human Resources': 'HR',
    ICT: 'Procurement',
  },
  postalAddress: 'Industrial Area, Nairobi — civil & building contractor',
});
