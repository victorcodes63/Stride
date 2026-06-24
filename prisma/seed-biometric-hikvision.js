/**
 * Seed Hikvision-like biometric devices and sample punches for demo/testing.
 *
 * Run:
 *   node prisma/seed-biometric-hikvision.js
 *   npm run db:seed-biometric-hikvision
 *
 * Notes:
 * - Requires outsourcing clients (and ideally employees) to already exist.
 * - Re-run safe for these seeded device names: existing records are removed first.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEVICE_NAME_PREFIX = 'HIK-DEMO';
const TARGET_CLIENTS = 3;
const DAYS_TO_SEED = 3;

const DEVICE_TEMPLATES = [
  {
    suffix: 'Main Gate Entry',
    direction: 'in',
    lane: 'entry',
    minuteOffset: -10,
  },
  {
    suffix: 'Main Gate Exit',
    direction: 'out',
    lane: 'exit',
    minuteOffset: 8,
  },
  {
    suffix: 'Canteen Shared Terminal',
    direction: 'unknown',
    lane: 'shared',
    minuteOffset: 0,
  },
];

function atTime(dayOffset, hour, minute = 0, jitterMinutes = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  d.setMinutes(d.getMinutes() + jitterMinutes);
  return d;
}

function asIp(clientIndex, deviceIndex) {
  // Private-range sample IPs (no real devices).
  return `10.20.${clientIndex + 1}.${40 + deviceIndex}`;
}

function buildDeviceConfig(clientIndex, template, ip) {
  return {
    vendor: 'Hikvision',
    protocol: 'ISAPI',
    host: ip,
    port: 80,
    tls: false,
    authMode: 'digest',
    timezone: 'Africa/Nairobi',
    eventPath: '/ISAPI/AccessControl/AcsEvent',
    pollWindowMinutes: 5,
    readTimeoutMs: 8000,
    terminal: {
      lane: template.lane,
      expectedDirection: template.direction,
      serialHint: `DS-K1T-${String(clientIndex + 1).padStart(2, '0')}${template.suffix
        .replace(/[^A-Za-z]/g, '')
        .slice(0, 4)
        .toUpperCase()}`,
    },
  };
}

function buildPunchPayload({ eventId, employee, observedAt, direction, ip }) {
  return {
    eventId,
    employeeNo: employee.employeeNumber ?? employee.id.slice(-6).toUpperCase(),
    personName: `${employee.firstName} ${employee.lastName}`,
    major: 5,
    minor: direction === 'in' ? 75 : direction === 'out' ? 76 : 0,
    verifyMode: 'card_or_fingerprint',
    eventTime: observedAt.toISOString(),
    ipAddress: ip,
    source: 'hikvision_isapi',
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const clients = await prisma.outsourcingClient.findMany({
    orderBy: { name: 'asc' },
    take: TARGET_CLIENTS,
    include: {
      employees: {
        where: { employmentStatus: 'active' },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        take: 8,
      },
    },
  });

  if (clients.length === 0) {
    console.log('No outsourcing clients found. Seed outsourcing clients first.');
    process.exit(1);
  }

  let totalDevices = 0;
  let totalPunches = 0;

  for (let clientIndex = 0; clientIndex < clients.length; clientIndex++) {
    const client = clients[clientIndex];
    if (client.employees.length === 0) {
      console.log(`Skipping ${client.name}: no active employees to map punches.`);
      continue;
    }

    await prisma.biometricDevice.deleteMany({
      where: {
        outsourcingClientId: client.id,
        name: { startsWith: `${DEVICE_NAME_PREFIX} -` },
      },
    });

    for (let deviceIndex = 0; deviceIndex < DEVICE_TEMPLATES.length; deviceIndex++) {
      const template = DEVICE_TEMPLATES[deviceIndex];
      const ip = asIp(clientIndex, deviceIndex);
      const deviceName = `${DEVICE_NAME_PREFIX} - ${client.name} - ${template.suffix}`;
      const config = buildDeviceConfig(clientIndex, template, ip);

      const device = await prisma.biometricDevice.create({
        data: {
          outsourcingClientId: client.id,
          name: deviceName,
          adapterKind: 'hikvision_isapi',
          isActive: true,
          config,
        },
      });
      totalDevices += 1;

      for (let dayOffset = -(DAYS_TO_SEED - 1); dayOffset <= 0; dayOffset++) {
        for (let employeeIndex = 0; employeeIndex < client.employees.length; employeeIndex++) {
          const employee = client.employees[employeeIndex];
          const jitter = (employeeIndex % 5) - 2 + template.minuteOffset;

          const observedAt =
            template.direction === 'in'
              ? atTime(dayOffset, 7, 55, jitter)
              : template.direction === 'out'
                ? atTime(dayOffset, 17, 20, jitter)
                : atTime(dayOffset, 13, 5, jitter);

          const externalEventId = [
            'HIK',
            clientIndex + 1,
            deviceIndex + 1,
            employee.employeeNumber ?? employee.id.slice(-5).toUpperCase(),
            observedAt.toISOString(),
          ].join('-');

          await prisma.biometricPunch.create({
            data: {
              biometricDeviceId: device.id,
              externalEventId,
              observedAt,
              rawSubjectId: employee.employeeNumber ?? employee.id,
              employeeId: employee.id,
              source: 'device',
              direction: template.direction,
              rawPayload: buildPunchPayload({
                eventId: externalEventId,
                employee,
                observedAt,
                direction: template.direction,
                ip,
              }),
            },
          });
          totalPunches += 1;
        }
      }
    }

    console.log(
      `Seeded Hikvision demo devices for ${client.name} (${client.employees.length} employees).`,
    );
  }

  console.log(`\nDone. Devices created: ${totalDevices}. Punches created: ${totalPunches}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
