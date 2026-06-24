/**
 * Seed fleet demo data (vehicles, drivers, partners, customers, trips across all statuses).
 * Run: npx tsx prisma/seed-fleet-demo.ts
 * Optional: FLEET_CLIENT_NAME="SwiftFreight East Africa Ltd"
 */
import {
  FleetComplianceResult,
  FleetDriverStatus,
  FleetIncidentSeverity,
  FleetIncidentStatus,
  FleetIncidentType,
  FleetOrderStatus,
  FleetSettlementStatus,
  FleetSettlementType,
  FleetTripDocumentType,
  FleetTripStatus,
  FleetVehicleOwnership,
  FleetVehicleStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_CLIENT = 'SwiftFreight East Africa Ltd';

const VEHICLES = [
  {
    registration: 'KCA 123A',
    label: 'Actros 2545',
    vehicleType: 'Prime mover',
    capacityKg: 28000,
    ownership: FleetVehicleOwnership.managed,
    status: FleetVehicleStatus.available,
    depotLocation: 'Nairobi — Industrial Area',
    odometerKm: 412_500,
  },
  {
    registration: 'KCB 456B',
    label: 'Volvo FH16',
    vehicleType: 'Prime mover',
    capacityKg: 30000,
    ownership: FleetVehicleOwnership.managed,
    status: FleetVehicleStatus.in_transit,
    depotLocation: 'Mombasa — Port Reitz',
    odometerKm: 287_100,
  },
  {
    registration: 'KCC 789C',
    label: 'Isuzu FRR',
    vehicleType: 'Rigid truck',
    capacityKg: 12000,
    ownership: FleetVehicleOwnership.managed,
    status: FleetVehicleStatus.maintenance,
    depotLocation: 'Nairobi — Embakasi',
    odometerKm: 156_800,
  },
  {
    registration: 'KCD 012D',
    label: 'MAN TGS',
    vehicleType: 'Prime mover',
    capacityKg: 26000,
    ownership: FleetVehicleOwnership.outsourced,
    status: FleetVehicleStatus.available,
    depotLocation: 'Partner yard — Athi River',
    odometerKm: null,
  },
  {
    registration: 'KCE 345E',
    label: 'Scania R450',
    vehicleType: 'Prime mover',
    capacityKg: 32000,
    ownership: FleetVehicleOwnership.managed,
    status: FleetVehicleStatus.in_transit,
    depotLocation: 'Nairobi — Industrial Area',
    odometerKm: 198_400,
  },
  {
    registration: 'KCF 678F',
    label: 'Fuso Fighter',
    vehicleType: 'Distribution',
    capacityKg: 8000,
    ownership: FleetVehicleOwnership.managed,
    status: FleetVehicleStatus.available,
    depotLocation: 'Nairobi — Ruiru',
    odometerKm: 92_300,
  },
] as const;

const DRIVERS = [
  {
    fullName: 'Moses Okello',
    phone: '+254 722 410001',
    licenceNumber: 'DL-KE-88421',
    licenceClass: 'CE',
    status: FleetDriverStatus.on_trip,
    employeeEmailHint: 'moses.okello',
  },
  {
    fullName: 'James Wanjiru',
    phone: '+254 733 220045',
    licenceNumber: 'DL-KE-77102',
    licenceClass: 'CE',
    status: FleetDriverStatus.available,
    employeeEmailHint: 'james.wanjiru',
  },
  {
    fullName: 'Peter Otieno',
    phone: '+254 711 998877',
    licenceNumber: 'DL-KE-65019',
    licenceClass: 'C',
    status: FleetDriverStatus.on_trip,
    employeeEmailHint: 'peter.otieno',
  },
  {
    fullName: 'Grace Akinyi',
    phone: '+254 700 554433',
    licenceNumber: 'DL-KE-90211',
    licenceClass: 'C',
    status: FleetDriverStatus.off_duty,
    employeeEmailHint: null,
  },
] as const;

const PARTNERS = [
  {
    name: 'Coastal Hauliers Ltd',
    contactName: 'Hassan Mwangi',
    contactPhone: '+254 722 880011',
    contactEmail: 'dispatch@coastalhauliers.co.ke',
  },
  {
    name: 'BorderLink Transport',
    contactName: 'Sarah Njoroge',
    contactPhone: '+254 733 441122',
    contactEmail: 'ops@borderlink.co.ke',
  },
] as const;

const CUSTOMERS = [
  {
    name: 'East Africa Breweries Ltd',
    contactName: 'David Kiprono',
    contactPhone: '+254 722 100200',
    billingTerms: 'Net 30',
  },
  {
    name: 'Bamburi Cement',
    contactName: 'Anne Muthoni',
    contactPhone: '+254 733 300400',
    billingTerms: 'Net 45',
  },
  {
    name: 'Twiga Foods',
    contactName: 'Kevin Ochieng',
    contactPhone: '+254 711 550066',
    billingTerms: 'Net 14',
  },
  {
    name: 'Flour Mills of Kenya',
    contactName: 'Lucy Chebet',
    contactPhone: '+254 700 778899',
    billingTerms: 'Net 30',
  },
] as const;

type TripSeed = {
  tripNumber: string;
  orderNumber: string;
  customerIndex: number;
  status: FleetTripStatus;
  origin: string;
  destination: string;
  cargoType: string;
  cargoWeightKg: number;
  plannedDistanceKm: number;
  actualDistanceKm?: number;
  vehicleIndex?: number;
  driverIndex?: number;
  partnerIndex?: number;
  isOutsourced?: boolean;
  plannedDeliveryAt?: Date;
  actualDeliveryAt?: Date;
  notes?: string;
  events: { eventType: string; message: string }[];
};

const TRIPS: TripSeed[] = [
  {
    tripNumber: 'TR-2026-001',
    orderNumber: 'ORD-2026-101',
    customerIndex: 0,
    status: 'planned',
    origin: 'Nairobi — Industrial Area',
    destination: 'Mombasa — Port Reitz',
    cargoType: 'Beer & spirits (palletised)',
    cargoWeightKg: 22000,
    plannedDistanceKm: 485,
    plannedDeliveryAt: daysFromNow(3),
    events: [{ eventType: 'order_intake', message: 'Transport order validated — awaiting vehicle allocation.' }],
  },
  {
    tripNumber: 'TR-2026-002',
    orderNumber: 'ORD-2026-102',
    customerIndex: 1,
    status: 'allocated',
    origin: 'Bamburi — Mombasa Road plant',
    destination: 'Kisumu — depot',
    cargoType: 'Bagged cement',
    cargoWeightKg: 26000,
    plannedDistanceKm: 345,
    vehicleIndex: 0,
    driverIndex: 1,
    plannedDeliveryAt: daysFromNow(2),
    events: [
      { eventType: 'allocated', message: 'Vehicle KCA 123A and driver James Wanjiru assigned.' },
    ],
  },
  {
    tripNumber: 'TR-2026-003',
    orderNumber: 'ORD-2026-103',
    customerIndex: 2,
    status: 'compliance_check',
    origin: 'Nairobi — Ruiru cold store',
    destination: 'Nakuru — distribution hub',
    cargoType: 'Fresh produce (chilled)',
    cargoWeightKg: 7500,
    plannedDistanceKm: 160,
    vehicleIndex: 5,
    driverIndex: 3,
    plannedDeliveryAt: daysFromNow(1),
    events: [
      { eventType: 'compliance', message: 'Pre-trip checklist started — licence and insurance verified.' },
    ],
  },
  {
    tripNumber: 'TR-2026-004',
    orderNumber: 'ORD-2026-104',
    customerIndex: 3,
    status: 'loaded',
    origin: 'Nairobi — Embakasi mill',
    destination: 'Eldoret — wholesaler',
    cargoType: 'Wheat flour (50kg bags)',
    cargoWeightKg: 18000,
    plannedDistanceKm: 310,
    vehicleIndex: 4,
    driverIndex: 2,
    plannedDeliveryAt: daysFromNow(1),
    events: [
      { eventType: 'loaded', message: 'Cargo loaded and secured — delivery note issued.' },
    ],
  },
  {
    tripNumber: 'TR-2026-005',
    orderNumber: 'ORD-2026-105',
    customerIndex: 0,
    status: 'in_transit',
    origin: 'Nairobi — Industrial Area',
    destination: 'Mombasa — Port Reitz',
    cargoType: 'Beer & spirits (palletised)',
    cargoWeightKg: 24000,
    plannedDistanceKm: 485,
    actualDistanceKm: 210,
    vehicleIndex: 1,
    driverIndex: 0,
    plannedDeliveryAt: daysFromNow(0),
    events: [
      { eventType: 'dispatch', message: 'Departed Nairobi — ETA Mombasa 18:30.' },
      { eventType: 'checkpoint', message: 'Passed Mtito Andei weighbridge — no issues.' },
    ],
  },
  {
    tripNumber: 'TR-2026-006',
    orderNumber: 'ORD-2026-106',
    customerIndex: 1,
    status: 'delivered',
    origin: 'Mombasa — plant',
    destination: 'Nairobi — construction site',
    cargoType: 'Bulk cement',
    cargoWeightKg: 28000,
    plannedDistanceKm: 485,
    actualDistanceKm: 492,
    vehicleIndex: 4,
    driverIndex: 2,
    plannedDeliveryAt: daysFromNow(-1),
    actualDeliveryAt: daysFromNow(-1),
    events: [
      { eventType: 'delivered', message: 'Offloaded and signed POD received at site.' },
    ],
  },
  {
    tripNumber: 'TR-2026-007',
    orderNumber: 'ORD-2026-107',
    customerIndex: 2,
    status: 'settled',
    origin: 'Naivasha — pack house',
    destination: 'Nairobi — market hub',
    cargoType: 'Vegetables (ambient)',
    cargoWeightKg: 6000,
    plannedDistanceKm: 95,
    actualDistanceKm: 98,
    vehicleIndex: 5,
    driverIndex: 1,
    plannedDeliveryAt: daysFromNow(-2),
    actualDeliveryAt: daysFromNow(-2),
    events: [
      { eventType: 'settlement', message: 'Driver mileage and trip expenses approved for payout.' },
    ],
  },
  {
    tripNumber: 'TR-2026-008',
    orderNumber: 'ORD-2026-108',
    customerIndex: 3,
    status: 'invoiced',
    origin: 'Nairobi — Embakasi',
    destination: 'Malaba — border',
    cargoType: 'Packaged goods (transit)',
    cargoWeightKg: 15000,
    plannedDistanceKm: 520,
    actualDistanceKm: 528,
    vehicleIndex: 0,
    driverIndex: 0,
    plannedDeliveryAt: daysFromNow(-4),
    actualDeliveryAt: daysFromNow(-4),
    events: [
      { eventType: 'invoiced', message: 'Client invoice INV-2026-0442 raised for completed trip.' },
    ],
  },
  {
    tripNumber: 'TR-2026-009',
    orderNumber: 'ORD-2026-109',
    customerIndex: 0,
    status: 'closed',
    origin: 'Thika — brewery',
    destination: 'Nyeri — depot',
    cargoType: 'Beer (crates)',
    cargoWeightKg: 9000,
    plannedDistanceKm: 120,
    actualDistanceKm: 118,
    vehicleIndex: 5,
    driverIndex: 3,
    plannedDeliveryAt: daysFromNow(-7),
    actualDeliveryAt: daysFromNow(-7),
    events: [
      { eventType: 'closed', message: 'Trip closed — payment received and file archived.' },
    ],
  },
  {
    tripNumber: 'TR-2026-010',
    orderNumber: 'ORD-2026-110',
    customerIndex: 1,
    status: 'exception',
    origin: 'Nairobi — Industrial Area',
    destination: 'Mombasa — Port Reitz',
    cargoType: 'Bagged cement',
    cargoWeightKg: 25000,
    plannedDistanceKm: 485,
    vehicleIndex: 1,
    driverIndex: 0,
    isOutsourced: true,
    partnerIndex: 0,
    notes: 'Tyre blowout near Voi — recovery dispatched. Customer notified of 6h delay.',
    events: [
      { eventType: 'incident', message: 'Driver reported tyre failure at km 312 — vehicle stationary.' },
      { eventType: 'escalation', message: 'Exception raised — ops coordinating recovery and ETA update.' },
    ],
  },
  {
    tripNumber: 'TR-2026-011',
    orderNumber: 'ORD-2026-111',
    customerIndex: 2,
    status: 'in_transit',
    origin: 'Nairobi — JKIA cargo village',
    destination: 'Kampala — warehouse',
    cargoType: 'Perishables (cross-border)',
    cargoWeightKg: 11000,
    plannedDistanceKm: 680,
    vehicleIndex: 3,
    partnerIndex: 1,
    isOutsourced: true,
    plannedDeliveryAt: daysFromNow(1),
    events: [
      { eventType: 'dispatch', message: 'BorderLink partner departed — transit docs cleared at Busia.' },
    ],
  },
];

const COMPLIANCE_CHECK_TYPES = [
  'driver_licence',
  'vehicle_insurance',
  'vehicle_inspection',
  'cargo_documents',
  'transport_permit_local',
  'transport_permit_transit',
] as const;

const ALL_CHECKS_PASSED_STATUSES = new Set<FleetTripStatus>([
  'loaded',
  'in_transit',
  'delivered',
  'settled',
  'invoiced',
  'closed',
  'exception',
]);

function complianceResultForTrip(
  status: FleetTripStatus,
  checkType: (typeof COMPLIANCE_CHECK_TYPES)[number],
): FleetComplianceResult {
  if (!ALL_CHECKS_PASSED_STATUSES.has(status) && status !== 'compliance_check') {
    return FleetComplianceResult.pending;
  }
  if (status === 'compliance_check' && checkType === 'transport_permit_transit') {
    return FleetComplianceResult.pending;
  }
  if (status === 'compliance_check' && checkType === 'cargo_documents') {
    return FleetComplianceResult.failed;
  }
  return FleetComplianceResult.passed;
}

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(17, 0, 0, 0);
  return d;
}

function driverSettlementKes(km: number | undefined) {
  return Math.round((km ?? 100) * 12 + 2500);
}

function partnerSettlementKes(km: number | undefined) {
  return Math.round((km ?? 100) * 55 + 8000);
}

async function clearFleetData(clientId: string) {
  await prisma.fleetTripEvent.deleteMany({
    where: { trip: { outsourcingClientId: clientId } },
  });
  await prisma.fleetTrip.deleteMany({ where: { outsourcingClientId: clientId } });
  await prisma.fleetOrder.deleteMany({ where: { outsourcingClientId: clientId } });
  await prisma.fleetCustomer.deleteMany({ where: { outsourcingClientId: clientId } });
  await prisma.fleetDriver.deleteMany({ where: { outsourcingClientId: clientId } });
  await prisma.fleetTransportPartner.deleteMany({ where: { outsourcingClientId: clientId } });
  await prisma.fleetVehicle.deleteMany({ where: { outsourcingClientId: clientId } });
}

async function main() {
  const clientName = process.env.FLEET_CLIENT_NAME?.trim() || DEFAULT_CLIENT;
  let client = await prisma.outsourcingClient.findFirst({ where: { name: clientName } });
  if (!client) {
    client = await prisma.outsourcingClient.findFirst({ orderBy: { createdAt: 'asc' } });
  }
  if (!client) {
    console.error('No outsourcing client found — run demo seed first.');
    process.exit(1);
  }

  console.log(`→ Fleet seed for: ${client.name} (${client.id})`);
  await clearFleetData(client.id);

  const billingProfile = await prisma.accountsClient.findUnique({
    where: { outsourcingClientId: client.id },
  });
  if (!billingProfile) {
    await prisma.accountsClient.create({
      data: {
        type: 'outsourcing',
        outsourcingClientId: client.id,
        name: client.name,
        currency: client.currency || 'KES',
        contactName: client.contactName,
        contactEmail: client.contactEmail,
        contactPhone: client.contactPhone,
      },
    });
    console.log('→ Linked accounts billing profile for fleet client.');
  }

  const vehicleIds: string[] = [];
  for (const v of VEHICLES) {
    const row = await prisma.fleetVehicle.create({
      data: { outsourcingClientId: client.id, ...v },
    });
    vehicleIds.push(row.id);
  }

  const driverIds: string[] = [];
  for (const d of DRIVERS) {
    let employeeId: string | undefined;
    if (d.employeeEmailHint) {
      const emp = await prisma.employee.findFirst({
        where: {
          outsourcingClientId: client.id,
          email: { contains: d.employeeEmailHint, mode: 'insensitive' },
        },
        select: { id: true },
      });
      employeeId = emp?.id;
    }
    const row = await prisma.fleetDriver.create({
      data: {
        outsourcingClientId: client.id,
        fullName: d.fullName,
        phone: d.phone,
        licenceNumber: d.licenceNumber,
        licenceClass: d.licenceClass,
        status: d.status,
        employeeId,
      },
    });
    driverIds.push(row.id);
  }

  const partnerIds: string[] = [];
  for (const p of PARTNERS) {
    const row = await prisma.fleetTransportPartner.create({
      data: { outsourcingClientId: client.id, ...p },
    });
    partnerIds.push(row.id);
  }

  const customerIds: string[] = [];
  for (const c of CUSTOMERS) {
    const row = await prisma.fleetCustomer.create({
      data: { outsourcingClientId: client.id, ...c },
    });
    customerIds.push(row.id);
  }

  let tripCount = 0;
  for (const t of TRIPS) {
    const customerId = customerIds[t.customerIndex];
    const order = await prisma.fleetOrder.create({
      data: {
        outsourcingClientId: client.id,
        customerId,
        orderNumber: t.orderNumber,
        pickupLocation: t.origin,
        deliveryLocation: t.destination,
        cargoType: t.cargoType,
        cargoWeightKg: t.cargoWeightKg,
        status:
          t.status === 'planned'
            ? FleetOrderStatus.validated
            : t.status === 'closed' || t.status === 'invoiced'
              ? FleetOrderStatus.completed
              : FleetOrderStatus.in_progress,
        requestedPickupAt: daysFromNow(-1),
      },
    });

    const trip = await prisma.fleetTrip.create({
      data: {
        outsourcingClientId: client.id,
        tripNumber: t.tripNumber,
        orderId: order.id,
        customerId,
        status: t.status,
        origin: t.origin,
        destination: t.destination,
        cargoType: t.cargoType,
        cargoWeightKg: t.cargoWeightKg,
        plannedDistanceKm: t.plannedDistanceKm,
        actualDistanceKm: t.actualDistanceKm,
        vehicleId: t.vehicleIndex != null ? vehicleIds[t.vehicleIndex] : undefined,
        driverId: t.driverIndex != null ? driverIds[t.driverIndex] : undefined,
        partnerId: t.partnerIndex != null ? partnerIds[t.partnerIndex] : undefined,
        isOutsourced: t.isOutsourced ?? false,
        plannedDeliveryAt: t.plannedDeliveryAt,
        actualDeliveryAt: t.actualDeliveryAt,
        notes: t.notes,
        events: {
          create: t.events.map((e, i) => ({
            eventType: e.eventType,
            message: e.message,
            createdAt: new Date(Date.now() - (t.events.length - i) * 3_600_000),
          })),
        },
      },
    });

    for (const checkType of COMPLIANCE_CHECK_TYPES) {
      const result = complianceResultForTrip(t.status, checkType);
      await prisma.fleetTripComplianceCheck.create({
        data: {
          tripId: trip.id,
          checkType,
          result,
          checkedAt: result !== FleetComplianceResult.pending ? new Date() : null,
        },
      });
    }

    if (['delivered', 'settled', 'invoiced', 'closed'].includes(t.status)) {
      await prisma.fleetTripDocument.create({
        data: {
          tripId: trip.id,
          docType: FleetTripDocumentType.pod,
          title: `Signed POD — ${t.destination}`,
          fileUrl: '/uploads/fleet/demo-pod.pdf',
          fileName: 'demo-pod.pdf',
          mimeType: 'application/pdf',
        },
      });
    }

    const settlementStatuses = new Set<FleetTripStatus>([
      'delivered',
      'settled',
      'invoiced',
      'closed',
    ]);
    if (settlementStatuses.has(t.status)) {
      const paid =
        t.status === 'settled' || t.status === 'invoiced' || t.status === 'closed';
      if (t.isOutsourced && t.partnerIndex != null) {
        await prisma.fleetSettlement.create({
          data: {
            outsourcingClientId: client.id,
            tripId: trip.id,
            settlementType: FleetSettlementType.partner,
            payeeName: PARTNERS[t.partnerIndex].name,
            amountKes: new Prisma.Decimal(partnerSettlementKes(t.plannedDistanceKm)),
            podVerified: true,
            status: paid ? FleetSettlementStatus.paid : FleetSettlementStatus.approved,
            approvedAt: new Date(),
            paidAt: paid ? new Date() : null,
          },
        });
      } else if (t.driverIndex != null) {
        await prisma.fleetSettlement.create({
          data: {
            outsourcingClientId: client.id,
            tripId: trip.id,
            settlementType: FleetSettlementType.driver,
            payeeName: DRIVERS[t.driverIndex].fullName,
            amountKes: new Prisma.Decimal(driverSettlementKes(t.plannedDistanceKm)),
            podVerified: true,
            status: paid ? FleetSettlementStatus.paid : FleetSettlementStatus.pending,
            paidAt: paid ? new Date() : null,
          },
        });
      }
    }

    if (t.tripNumber === 'TR-2026-010') {
      await prisma.fleetIncident.create({
        data: {
          outsourcingClientId: client.id,
          tripId: trip.id,
          incidentType: FleetIncidentType.breakdown,
          severity: FleetIncidentSeverity.high,
          status: FleetIncidentStatus.investigating,
          title: 'Tyre blowout near Voi',
          description:
            t.notes ??
            'Driver reported tyre failure at km 312. Recovery team dispatched; customer notified.',
        },
      });
    }

    tripCount += 1;
  }

  console.log(
    `→ Fleet demo seeded: ${vehicleIds.length} vehicles, ${driverIds.length} drivers, ${partnerIds.length} partners, ${customerIds.length} customers, ${tripCount} trips.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
