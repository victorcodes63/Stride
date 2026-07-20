/**
 * SwiftFreight East Africa — demo JD manual.
 * Titles must match cargo-logistics pack employee `role` / jobTitle exactly
 * so performance cycles bind reviews to the correct scorecard.
 */
import type { JdManualImport } from '@/lib/performance/jd/jd-manual-import';

export const SWIFTFREIGHT_JD_MANUAL: JdManualImport = {
  version: 1,
  name: 'SwiftFreight East Africa — Job Description Manual',
  divisions: [
    'Dispatch',
    'Fleet & Drivers',
    'Warehouse',
    'Customs & Clearing',
    'HR & Administration',
    'Finance',
  ],
  roles: [
    {
      division: 'Dispatch',
      title: 'Operations Manager — East Africa',
      grade: 'Grade 2',
      jobPurpose:
        'Lead regional cargo operations across fleet, warehouse, and dispatch so SwiftFreight meets client SLAs, safety standards, and cost targets across the East Africa corridor.',
      keyActivities:
        'Set and monitor weekly operating plans; coordinate hub and corridor capacity; escalate service exceptions; own monthly operations reviews with Finance and HR; sponsor HSSE drills and incident follow-up.',
      authorityScope:
        'Approve route and capacity changes within the operations DOA; recommend overtime and contractor spend; escalate capital and policy exceptions to the Managing Director.',
      workingConditions:
        'Based at the Nairobi control hub with periodic visits to Mombasa corridor sites and bonded warehouse; on-call for major service disruptions.',
      qualifications:
        'Degree or diploma in logistics, transport, or operations management; 7+ years in freight or 3PL operations with team leadership; strong grasp of Kenya/EAC corridor compliance.',
      relationships:
        'Reports to Managing Director. Direct working relationships with Dispatch, Fleet, Warehouse, Customs, Finance, and HR leads. External: key accounts, port/ICD agents, and insurance partners.',
      kras: [
        {
          title: 'Regional service delivery',
          description: 'On-time performance and client SLA achievement across corridors.',
          bscPerspective: 'customer',
          weightPercent: 35,
          kpis: [
            { name: 'On-time delivery rate', targetValue: '≥95', unit: '%', weightPercent: 50 },
            { name: 'Critical SLA breaches', targetValue: '≤2', unit: '/month', weightPercent: 50 },
          ],
        },
        {
          title: 'Operational cost & utilisation',
          description: 'Balance capacity, fuel, and overtime within budget.',
          bscPerspective: 'financial',
          weightPercent: 30,
          kpis: [
            { name: 'Ops cost vs budget', targetValue: '≤100', unit: '%', weightPercent: 50 },
            { name: 'Fleet utilisation', targetValue: '≥80', unit: '%', weightPercent: 50 },
          ],
        },
        {
          title: 'Safety & compliance',
          description: 'Zero harm culture and regulatory readiness.',
          bscPerspective: 'internal_process',
          weightPercent: 20,
          kpis: [
            { name: 'Lost-time incidents', targetValue: '0', unit: 'LTI', weightPercent: 60 },
            { name: 'Licence compliance rate', targetValue: '100', unit: '%', weightPercent: 40 },
          ],
        },
        {
          title: 'People leadership',
          description: 'Build capable supervisors and complete performance cycles.',
          bscPerspective: 'learning_growth',
          weightPercent: 15,
          kpis: [
            {
              name: 'Review completion for direct reports',
              targetValue: '100',
              unit: '%',
              weightPercent: 100,
            },
          ],
        },
      ],
      competencies: [
        { name: 'Strategic operations leadership', requiredLevel: 5 },
        { name: 'Stakeholder communication', requiredLevel: 4 },
        { name: 'Safety & risk ownership', requiredLevel: 5 },
        { name: 'Decision making under pressure', requiredLevel: 4 },
      ],
    },
    {
      division: 'Dispatch',
      title: 'Dispatch Controller — Nairobi hub',
      grade: 'Grade 4',
      jobPurpose:
        'Coordinate daily fleet movements, driver assignments, and customer ETAs from the Nairobi control tower so cargo moves safely and on schedule.',
      keyActivities:
        'Build and adjust daily dispatch boards; assign drivers and vehicles; monitor telematics exceptions; liaise with warehouse and customers on ETAs; publish peak-season rota patterns with operations leadership.',
      authorityScope:
        'Reassign trips within published capacity plans; escalate overtime and third-party haulage beyond shift limits to Operations Manager.',
      workingConditions:
        'Shift-based control-room environment; peak evenings and weekends during high season.',
      qualifications:
        'Diploma in logistics or transport; 2+ years dispatch or transport control; comfortable with GPS/telematics dashboards.',
      relationships:
        'Reports to Operations Manager. Works with drivers, warehouse supervisors, and customer service. External: client operations contacts.',
      kras: [
        {
          title: 'Dispatch accuracy & punctuality',
          description: 'Trips leave and arrive per plan with clear ETAs.',
          bscPerspective: 'customer',
          weightPercent: 40,
          kpis: [
            { name: 'Departures on plan', targetValue: '≥92', unit: '%', weightPercent: 50 },
            { name: 'ETA accuracy (±2 hrs)', targetValue: '≥90', unit: '%', weightPercent: 50 },
          ],
        },
        {
          title: 'Exception management',
          description: 'Resolve in-transit issues quickly and document outcomes.',
          bscPerspective: 'internal_process',
          weightPercent: 35,
          kpis: [
            { name: 'Exceptions closed same day', targetValue: '≥85', unit: '%', weightPercent: 60 },
            { name: 'Unlogged trip deviations', targetValue: '0', unit: 'events', weightPercent: 40 },
          ],
        },
        {
          title: 'Team coordination',
          description: 'Clear handovers and driver briefing quality.',
          bscPerspective: 'learning_growth',
          weightPercent: 25,
          kpis: [
            { name: 'Shift handover completeness', targetValue: '100', unit: '%', weightPercent: 100 },
          ],
        },
      ],
      competencies: [
        { name: 'Scheduling & prioritisation', requiredLevel: 4 },
        { name: 'Telematics literacy', requiredLevel: 3 },
        { name: 'Calm communication', requiredLevel: 4 },
        { name: 'Customer orientation', requiredLevel: 3 },
      ],
    },
    {
      division: 'Warehouse',
      title: 'Warehouse Supervisor — Industrial Area',
      grade: 'Grade 4',
      jobPurpose:
        'Lead inbound receiving, put-away, picking, and dispatch for the Industrial Area warehouse so stock accuracy and loading SLAs are met safely.',
      keyActivities:
        'Supervise shift teams; run daily stock counts; investigate variances; enforce lifting and bay HSSE rules; coordinate dock slots with dispatch.',
      authorityScope:
        'Allocate warehouse labour within shift roster; approve stock adjustments within policy limits; escalate high-value variances to Operations Manager.',
      workingConditions:
        'Warehouse floor and office; early shifts; PPE mandatory in operational zones.',
      qualifications:
        'Diploma in supply chain or logistics; 3+ years warehouse/3PL supervision; WMS literacy; forklift licence an advantage.',
      relationships:
        'Reports to Operations Manager. Works with Inventory Controller, Dispatch, and Fleet. External: client warehouse auditors where contracted.',
      kras: [
        {
          title: 'Throughput & dispatch readiness',
          description: 'Loads ready for assigned departure windows.',
          bscPerspective: 'customer',
          weightPercent: 35,
          kpis: [
            { name: 'Loads ready on time', targetValue: '≥95', unit: '%', weightPercent: 60 },
            { name: 'Pick accuracy', targetValue: '≥99', unit: '%', weightPercent: 40 },
          ],
        },
        {
          title: 'Inventory integrity',
          description: 'Stock records match physical holdings.',
          bscPerspective: 'internal_process',
          weightPercent: 35,
          kpis: [
            { name: 'Cycle count accuracy', targetValue: '≥98', unit: '%', weightPercent: 70 },
            { name: 'Unresolved variances >48hrs', targetValue: '0', unit: 'lines', weightPercent: 30 },
          ],
        },
        {
          title: 'Warehouse safety',
          description: 'Safe lifting, PPE, and dock discipline.',
          bscPerspective: 'learning_growth',
          weightPercent: 30,
          kpis: [
            { name: 'Safety observations closed', targetValue: '100', unit: '%', weightPercent: 50 },
            { name: 'Lost-time incidents', targetValue: '0', unit: 'LTI', weightPercent: 50 },
          ],
        },
      ],
      competencies: [
        { name: 'Team leadership', requiredLevel: 4 },
        { name: 'Inventory control', requiredLevel: 4 },
        { name: 'HSSE awareness', requiredLevel: 4 },
        { name: 'Problem solving', requiredLevel: 3 },
      ],
    },
    {
      division: 'Customs & Clearing',
      title: 'Customs Clearing Officer',
      grade: 'Grade 4',
      jobPurpose:
        'Process import/export declarations, coordinate with KRA and port agents, and keep clients informed so clearance timelines and compliance standards are met.',
      keyActivities:
        'Prepare and lodge customs entries; track shipments through port and ICDs; manage HS codes and supporting documents; escalate holds, inspections, and duty queries.',
      authorityScope:
        'Lodge entries and respond to KRA queries within mandate; escalate duty disputes and bond issues to Operations Manager and Finance.',
      workingConditions:
        'Office-based with occasional port/ICD visits; deadline-driven around vessel and truck cut-offs.',
      qualifications:
        'Diploma or degree in clearing & forwarding; KRA customs agent licence; 2+ years freight forwarding or clearing; strong EAC trade protocol knowledge.',
      relationships:
        'Reports to Operations Manager. Works with Dispatch, Warehouse, and Finance. External: KRA, port agents, clients, and shipping lines.',
      kras: [
        {
          title: 'Clearance turnaround',
          description: 'Shipments clear within agreed client timelines.',
          bscPerspective: 'customer',
          weightPercent: 40,
          kpis: [
            { name: 'Entries lodged within SLA', targetValue: '≥95', unit: '%', weightPercent: 50 },
            { name: 'Average clearance cycle time', targetValue: '≤3', unit: 'days', weightPercent: 50 },
          ],
        },
        {
          title: 'Compliance quality',
          description: 'Accurate documentation and clean audit outcomes.',
          bscPerspective: 'internal_process',
          weightPercent: 35,
          kpis: [
            { name: 'Document rejection rate', targetValue: '≤2', unit: '%', weightPercent: 50 },
            { name: 'Compliance findings', targetValue: '0', unit: 'major', weightPercent: 50 },
          ],
        },
        {
          title: 'Client communication',
          description: 'Proactive status updates on holds and ETAs.',
          bscPerspective: 'customer',
          weightPercent: 25,
          kpis: [
            {
              name: 'Status updates within 4 business hours',
              targetValue: '≥95',
              unit: '%',
              weightPercent: 100,
            },
          ],
        },
      ],
      competencies: [
        { name: 'Customs compliance', requiredLevel: 5 },
        { name: 'Documentation accuracy', requiredLevel: 4 },
        { name: 'Client communication', requiredLevel: 4 },
        { name: 'Attention to detail', requiredLevel: 5 },
      ],
    },
    {
      division: 'Fleet & Drivers',
      title: 'Long-haul Driver — Mombasa corridor',
      grade: 'Grade 6',
      jobPurpose:
        'Execute assigned long-haul routes between Nairobi, Mombasa, and border points safely, on time, and with complete delivery documentation.',
      keyActivities:
        'Follow journey management plans; complete pre/post-trip inspections; maintain fuel and POD records in ESS; report incidents and delays immediately; protect cargo and vehicle assets.',
      authorityScope:
        'Operate assigned vehicle within route and rest rules; stop the journey for safety concerns; no authority to accept undocumented loads.',
      workingConditions:
        'Long-haul driving across corridor routes; overnight stops per journey plan; strict rest and hours-of-service rules.',
      qualifications:
        'Valid CE licence; 5+ years articulated vehicle experience; clean traffic record; medical fitness; PSV badge for goods vehicles.',
      relationships:
        'Reports to Dispatch Controller / Fleet Maintenance Coordinator for vehicle readiness. External: weighbridge, border, and client receiving staff.',
      kras: [
        {
          title: 'Safe journey execution',
          description: 'Arrive without preventable safety events.',
          bscPerspective: 'internal_process',
          weightPercent: 40,
          kpis: [
            { name: 'Preventable incidents', targetValue: '0', unit: 'events', weightPercent: 60 },
            { name: 'Pre-trip inspection completion', targetValue: '100', unit: '%', weightPercent: 40 },
          ],
        },
        {
          title: 'On-time corridor delivery',
          description: 'Meet planned arrival windows.',
          bscPerspective: 'customer',
          weightPercent: 35,
          kpis: [
            { name: 'Trips on scheduled ETA', targetValue: '≥90', unit: '%', weightPercent: 100 },
          ],
        },
        {
          title: 'Documentation & fuel discipline',
          description: 'Complete PODs, fuel logs, and ESS updates.',
          bscPerspective: 'financial',
          weightPercent: 25,
          kpis: [
            { name: 'POD / paperwork completeness', targetValue: '100', unit: '%', weightPercent: 50 },
            { name: 'Fuel variance vs plan', targetValue: '≤5', unit: '%', weightPercent: 50 },
          ],
        },
      ],
      competencies: [
        { name: 'Defensive driving', requiredLevel: 5 },
        { name: 'Route & border knowledge', requiredLevel: 4 },
        { name: 'Documentation discipline', requiredLevel: 3 },
        { name: 'Safety mindset', requiredLevel: 5 },
      ],
    },
    {
      division: 'HR & Administration',
      title: 'HR & Payroll Officer',
      grade: 'Grade 3',
      jobPurpose:
        'Run end-to-end people operations for SwiftFreight — payroll accuracy, statutory compliance, leave, credentials, and employee support — so staff are paid correctly and the company stays audit-ready.',
      keyActivities:
        'Process monthly payroll and statutory returns; maintain employee records; manage leave and credentials expiries; support onboarding and performance cycles; advise managers on HR policy.',
      authorityScope:
        'Process payroll within approved inputs; escalate salary exceptions and disciplinary matters per policy; no unilateral grade or compensation changes.',
      workingConditions:
        'Office-based at Nairobi HQ; peak workload around payroll cut-off and year-end statutory filings.',
      qualifications:
        'Degree/diploma in HR, business, or accounting; 4+ years HR/payroll in Kenya; strong PAYE/NSSF/SHIF/AHL literacy; HRIS experience preferred.',
      relationships:
        'Reports to Operations Manager (demo admin line) / Managing Director. Works with Finance and all department heads. External: KRA, NSSF, and benefits providers.',
      kras: [
        {
          title: 'Payroll accuracy & timeliness',
          description: 'Staff paid correctly and on schedule.',
          bscPerspective: 'financial',
          weightPercent: 40,
          kpis: [
            { name: 'Payroll error rate', targetValue: '≤0.5', unit: '%', weightPercent: 50 },
            { name: 'Payroll run on calendar', targetValue: '100', unit: '%', weightPercent: 50 },
          ],
        },
        {
          title: 'Statutory & credential compliance',
          description: 'Filings and licence tracking kept current.',
          bscPerspective: 'internal_process',
          weightPercent: 35,
          kpis: [
            { name: 'Statutory filings on time', targetValue: '100', unit: '%', weightPercent: 50 },
            { name: 'Expired credentials unresolved', targetValue: '0', unit: 'items', weightPercent: 50 },
          ],
        },
        {
          title: 'Employee experience',
          description: 'Responsive HR support and clean people data.',
          bscPerspective: 'customer',
          weightPercent: 25,
          kpis: [
            {
              name: 'HR tickets resolved within SLA',
              targetValue: '≥90',
              unit: '%',
              weightPercent: 100,
            },
          ],
        },
      ],
      competencies: [
        { name: 'Payroll & statutory expertise', requiredLevel: 5 },
        { name: 'Confidentiality & integrity', requiredLevel: 5 },
        { name: 'Stakeholder service', requiredLevel: 4 },
        { name: 'Process discipline', requiredLevel: 4 },
      ],
    },
    {
      division: 'Fleet & Drivers',
      title: 'City Delivery Driver — last mile',
      grade: 'Grade 6',
      jobPurpose:
        'Deliver last-mile consignments across the Nairobi metro area safely and on schedule, with accurate POD capture and professional client handovers.',
      keyActivities:
        'Execute assigned city routes; complete vehicle checks; collect and upload PODs in ESS; handle cash-on-delivery where authorised; report delays, damages, and access issues promptly.',
      authorityScope:
        'Operate assigned light/medium vehicle within city route plans; refuse unsafe loads or destinations; no authority to alter delivery addresses without dispatch confirmation.',
      workingConditions:
        'Urban driving with multiple stops per shift; early starts and peak-hour traffic; PPE and reflective gear required at client sites.',
      qualifications:
        'Valid Class C licence; 2+ years urban delivery experience; clean traffic record; basic smartphone literacy for ESS POD capture.',
      relationships:
        'Reports to Dispatch Controller. Works with warehouse for load collection. External: client receiving clerks and security gate staff.',
      kras: [
        {
          title: 'Last-mile on-time delivery',
          description: 'Complete assigned stops within the daily window.',
          bscPerspective: 'customer',
          weightPercent: 40,
          kpis: [
            { name: 'Stops delivered on time', targetValue: '≥92', unit: '%', weightPercent: 60 },
            { name: 'Failed delivery rate', targetValue: '≤5', unit: '%', weightPercent: 40 },
          ],
        },
        {
          title: 'Safe urban driving',
          description: 'Zero preventable incidents in city operations.',
          bscPerspective: 'internal_process',
          weightPercent: 35,
          kpis: [
            { name: 'Preventable incidents', targetValue: '0', unit: 'events', weightPercent: 70 },
            { name: 'Pre-trip checks completed', targetValue: '100', unit: '%', weightPercent: 30 },
          ],
        },
        {
          title: 'POD & cash discipline',
          description: 'Accurate delivery proof and remittance handling.',
          bscPerspective: 'financial',
          weightPercent: 25,
          kpis: [
            { name: 'POD capture same day', targetValue: '100', unit: '%', weightPercent: 60 },
            { name: 'COD remittance variance', targetValue: '0', unit: 'KES', weightPercent: 40 },
          ],
        },
      ],
      competencies: [
        { name: 'Urban defensive driving', requiredLevel: 4 },
        { name: 'Customer service at handover', requiredLevel: 3 },
        { name: 'Documentation discipline', requiredLevel: 3 },
        { name: 'Safety mindset', requiredLevel: 4 },
      ],
    },
    {
      division: 'Warehouse',
      title: 'Inventory Controller — bonded warehouse',
      grade: 'Grade 5',
      jobPurpose:
        'Maintain accurate bonded-warehouse stock records, reconcile physical counts to system balances, and support customs-controlled inventory integrity for SwiftFreight clients.',
      keyActivities:
        'Run cycle counts and full stocktakes; investigate variances; update WMS/stock ledgers; flag damaged or expired goods; support bonded release documentation with Customs Clearing.',
      authorityScope:
        'Post stock adjustments within policy thresholds; quarantine suspect stock; escalate high-value or bonded discrepancies to Warehouse Supervisor and Customs Clearing Officer.',
      workingConditions:
        'Bonded warehouse floor and inventory office; PPE in storage zones; occasional evening counts during peak seasons.',
      qualifications:
        'Diploma in logistics, supply chain, or accounting; 2+ years inventory control in warehouse/3PL; bonded or customs-controlled stock experience preferred.',
      relationships:
        'Reports to Warehouse Supervisor. Works with Customs Clearing, Dispatch, and Finance. External: client inventory auditors where contracted.',
      kras: [
        {
          title: 'Stock accuracy',
          description: 'System balances match physical holdings.',
          bscPerspective: 'internal_process',
          weightPercent: 45,
          kpis: [
            { name: 'Cycle count accuracy', targetValue: '≥99', unit: '%', weightPercent: 60 },
            { name: 'Open variance ageing >72hrs', targetValue: '0', unit: 'lines', weightPercent: 40 },
          ],
        },
        {
          title: 'Bonded inventory control',
          description: 'Customs-controlled stock remains auditable.',
          bscPerspective: 'customer',
          weightPercent: 30,
          kpis: [
            { name: 'Bonded stock record completeness', targetValue: '100', unit: '%', weightPercent: 50 },
            { name: 'Audit findings on inventory', targetValue: '0', unit: 'major', weightPercent: 50 },
          ],
        },
        {
          title: 'Reporting discipline',
          description: 'Timely inventory reports to operations and finance.',
          bscPerspective: 'financial',
          weightPercent: 25,
          kpis: [
            {
              name: 'Weekly inventory report on time',
              targetValue: '100',
              unit: '%',
              weightPercent: 100,
            },
          ],
        },
      ],
      competencies: [
        { name: 'Inventory & WMS literacy', requiredLevel: 4 },
        { name: 'Attention to detail', requiredLevel: 5 },
        { name: 'Analytical problem solving', requiredLevel: 3 },
        { name: 'Compliance awareness', requiredLevel: 4 },
      ],
    },
    {
      division: 'Fleet & Drivers',
      title: 'Fleet Maintenance Coordinator',
      grade: 'Grade 4',
      jobPurpose:
        'Keep SwiftFreight’s fleet roadworthy and available by planning preventive maintenance, coordinating repairs, and tracking licence/inspection readiness for corridor and city vehicles.',
      keyActivities:
        'Schedule service intervals; book workshops; track spare parts and tyre life; verify inspection certificates; coordinate with Dispatch on vehicle downtime; maintain maintenance cost logs.',
      authorityScope:
        'Approve routine maintenance within fleet budget limits; ground vehicles for safety defects; escalate major repairs and accident claims to Operations Manager.',
      workingConditions:
        'Mix of office planning and yard/workshop presence; occasional after-hours call-outs for breakdowns.',
      qualifications:
        'Diploma in mechanical/automotive or fleet management; 3+ years fleet maintenance coordination; familiarity with NTSA inspection and defect reporting.',
      relationships:
        'Reports to Operations Manager. Works with Dispatch Controllers and drivers. External: authorised workshops, tyre suppliers, and inspection centres.',
      kras: [
        {
          title: 'Fleet availability',
          description: 'Maximise vehicles fit for planned trips.',
          bscPerspective: 'customer',
          weightPercent: 35,
          kpis: [
            { name: 'Fleet availability rate', targetValue: '≥90', unit: '%', weightPercent: 60 },
            { name: 'Unplanned downtime events', targetValue: '≤3', unit: '/month', weightPercent: 40 },
          ],
        },
        {
          title: 'Preventive maintenance compliance',
          description: 'Services and inspections completed on schedule.',
          bscPerspective: 'internal_process',
          weightPercent: 35,
          kpis: [
            { name: 'PM jobs completed on plan', targetValue: '≥95', unit: '%', weightPercent: 50 },
            { name: 'Overdue inspections', targetValue: '0', unit: 'vehicles', weightPercent: 50 },
          ],
        },
        {
          title: 'Maintenance cost control',
          description: 'Contain repair and parts spend within budget.',
          bscPerspective: 'financial',
          weightPercent: 30,
          kpis: [
            { name: 'Maintenance cost vs budget', targetValue: '≤100', unit: '%', weightPercent: 100 },
          ],
        },
      ],
      competencies: [
        { name: 'Fleet technical knowledge', requiredLevel: 4 },
        { name: 'Planning & prioritisation', requiredLevel: 4 },
        { name: 'Vendor management', requiredLevel: 3 },
        { name: 'Safety & defect ownership', requiredLevel: 5 },
      ],
    },
    {
      division: 'Finance',
      title: 'Finance Analyst — operations',
      grade: 'Grade 3',
      jobPurpose:
        'Provide timely financial analysis for SwiftFreight operations — trip costs, margin by corridor, payroll inputs, and management reporting — so leaders make cost-aware decisions.',
      keyActivities:
        'Prepare monthly ops P&L and variance packs; analyse fuel, trip, and overtime costs; support payroll finance checks; track receivables related to freight invoices; assist statutory and audit schedules.',
      authorityScope:
        'Recommend cost actions and accrual adjustments; no independent bank payments beyond finance DOA; escalate material variances to Finance lead / Operations Manager.',
      workingConditions:
        'Office-based at Nairobi HQ; month-end and payroll cut-off peaks; occasional site visits for cost verification.',
      qualifications:
        'Degree/diploma in accounting, finance, or economics; 3+ years management accounting; strong Excel/ERP skills; CPA(K) progress an advantage.',
      relationships:
        'Reports to Finance lead / Operations Manager. Works with HR Payroll, Dispatch, and Fleet. External: auditors and banking contacts as assigned.',
      kras: [
        {
          title: 'Management reporting quality',
          description: 'Accurate, timely ops finance packs.',
          bscPerspective: 'financial',
          weightPercent: 40,
          kpis: [
            { name: 'Month-end pack by T+5', targetValue: '100', unit: '%', weightPercent: 50 },
            { name: 'Material reporting restatements', targetValue: '0', unit: 'items', weightPercent: 50 },
          ],
        },
        {
          title: 'Cost & margin insight',
          description: 'Clear visibility of corridor and fleet cost drivers.',
          bscPerspective: 'internal_process',
          weightPercent: 35,
          kpis: [
            { name: 'Trip cost analyses delivered', targetValue: '≥4', unit: '/month', weightPercent: 50 },
            { name: 'Fuel variance investigations closed', targetValue: '≥90', unit: '%', weightPercent: 50 },
          ],
        },
        {
          title: 'Stakeholder support',
          description: 'Responsive finance support to ops and payroll.',
          bscPerspective: 'customer',
          weightPercent: 25,
          kpis: [
            {
              name: 'Finance queries resolved within SLA',
              targetValue: '≥90',
              unit: '%',
              weightPercent: 100,
            },
          ],
        },
      ],
      competencies: [
        { name: 'Financial analysis', requiredLevel: 4 },
        { name: 'Business partnering', requiredLevel: 3 },
        { name: 'Data accuracy', requiredLevel: 5 },
        { name: 'Commercial awareness', requiredLevel: 3 },
      ],
    },
  ],
};
