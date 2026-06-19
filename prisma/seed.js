/**
 * ERA Fleet — database seed (demo data).
 *
 * Run with:  npm run db:seed
 *
 * Heads-up on roles: the app promotes the *first* person who signs in with
 * Google to MANAGER automatically — but that only works on an EMPTY user
 * table. Because this seed inserts demo users, after seeding you should pick
 * who the real manager is and set their role in Prisma Studio
 * (`npm run db:studio` → User → role → MANAGER). The demo accounts below use
 * @example.com addresses purely so the dashboards look populated; they can't
 * actually log in unless that domain is in ALLOWED_EMAIL_DOMAINS.
 *
 * Safe to re-run: users/vehicles are upserted, and sample service requests
 * are only created if none exist yet.
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Helper: a date N days from now (negative = in the past).
const inDays = (n) => new Date(Date.now() + n * 86400000);

async function main() {
  console.log("Seeding ERA Fleet demo data…");

  // --- People --------------------------------------------------------------
  const manager = await prisma.user.upsert({
    where: { email: "manager@example.com" },
    update: {},
    create: { email: "manager@example.com", name: "Dana Fleet (Manager)", role: "MANAGER" },
  });

  const supervisor = await prisma.user.upsert({
    where: { email: "supervisor@example.com" },
    update: {},
    create: { email: "supervisor@example.com", name: "Sam Lane (Supervisor)", role: "SUPERVISOR" },
  });

  const driverData = [
    { email: "driver1@example.com", name: "Alex Rivera" },
    { email: "driver2@example.com", name: "Jordan Pike" },
    { email: "driver3@example.com", name: "Casey Monroe" },
    { email: "driver4@example.com", name: "Taylor Quinn" },
  ];
  const drivers = [];
  for (const d of driverData) {
    drivers.push(
      await prisma.user.upsert({
        where: { email: d.email },
        update: {},
        create: { email: d.email, name: d.name, role: "DRIVER" },
      })
    );
  }

  // --- Vehicles ------------------------------------------------------------
  // A mix that intentionally triggers a few maintenance alerts so the
  // dashboard and reminder sweep have something to show.
  const vehicles = [
    {
      licensePlate: "ERA-101",
      unitNumber: "Truck 1",
      make: "Ford",
      model: "F-250",
      year: 2021,
      currentMileage: 64200,
      mileageAsOf: new Date(),
      lastOilChangeMileage: 59400, // due ~200 mi out → "due soon" alert
      lastOilChangeDate: inDays(-95),
      oilChangeIntervalMi: 5000,
      registrationExpiry: inDays(15), // within 30 days → alert
      inspectionExpiry: inDays(140),
      emissionsExpiry: inDays(140),
      insuranceExpiry: inDays(220),
      wexCardId: "WEX-0101",
      turnpikeTransponder: "EZP-55012",
      assignedDriverId: drivers[0].id,
    },
    {
      licensePlate: "ERA-102",
      unitNumber: "Truck 2",
      make: "Chevrolet",
      model: "Silverado 2500",
      year: 2020,
      currentMileage: 88110,
      mileageAsOf: new Date(),
      lastOilChangeMileage: 84000,
      lastOilChangeDate: inDays(-60),
      oilChangeIntervalMi: 5000,
      registrationExpiry: inDays(180),
      inspectionExpiry: inDays(20), // within 30 days → alert
      emissionsExpiry: inDays(20),
      insuranceExpiry: inDays(300),
      wexCardId: "WEX-0102",
      turnpikeTransponder: "EZP-55013",
      assignedDriverId: drivers[1].id,
    },
    {
      licensePlate: "ERA-103",
      unitNumber: "Truck 3",
      make: "Ram",
      model: "2500",
      year: 2022,
      currentMileage: 41030,
      mileageAsOf: new Date(),
      lastOilChangeMileage: 38500,
      lastOilChangeDate: inDays(-40),
      oilChangeIntervalMi: 5000,
      registrationExpiry: inDays(200),
      inspectionExpiry: inDays(210),
      emissionsExpiry: inDays(210),
      insuranceExpiry: inDays(260),
      wexCardId: "WEX-0103",
      turnpikeTransponder: "EZP-55014",
      assignedDriverId: drivers[2].id,
    },
    {
      licensePlate: "ERA-104",
      unitNumber: "Truck 4",
      make: "Ford",
      model: "Transit",
      year: 2019,
      currentMileage: 102540,
      mileageAsOf: new Date(),
      lastOilChangeMileage: 98000,
      lastOilChangeDate: inDays(-70),
      oilChangeIntervalMi: 6000,
      registrationExpiry: inDays(150),
      inspectionExpiry: inDays(150),
      emissionsExpiry: inDays(150),
      insuranceExpiry: inDays(150),
      wexCardId: "WEX-0104",
      turnpikeTransponder: "EZP-55015",
      assignedDriverId: drivers[3].id,
    },
    {
      licensePlate: "ERA-900",
      unitNumber: "Spare A",
      make: "Toyota",
      model: "Tacoma",
      year: 2023,
      currentMileage: 15600,
      mileageAsOf: new Date(),
      lastOilChangeMileage: 12000,
      lastOilChangeDate: inDays(-30),
      oilChangeIntervalMi: 5000,
      registrationExpiry: inDays(250),
      inspectionExpiry: inDays(250),
      emissionsExpiry: inDays(250),
      insuranceExpiry: inDays(250),
      isSpare: true,
      assignedDriverId: null,
    },
  ];

  for (const v of vehicles) {
    await prisma.vehicle.upsert({
      where: { licensePlate: v.licensePlate },
      update: v,
      create: v,
    });
  }

  // --- Sample service requests (only if the table is empty) ----------------
  const existingRequests = await prisma.serviceRequest.count();
  if (existingRequests === 0) {
    const t1 = await prisma.vehicle.findUnique({ where: { licensePlate: "ERA-101" } });
    const t2 = await prisma.vehicle.findUnique({ where: { licensePlate: "ERA-102" } });

    await prisma.serviceRequest.create({
      data: {
        status: "PENDING",
        issue: "Brakes squealing at low speed; pulls slightly right.",
        priority: "high",
        vehicleId: t1.id,
        driverId: drivers[0].id,
        supervisorId: supervisor.id,
      },
    });

    await prisma.serviceRequest.create({
      data: {
        status: "SCHEDULED",
        issue: "Check-engine light on, code P0420.",
        priority: "normal",
        vehicleId: t2.id,
        driverId: drivers[1].id,
        supervisorId: supervisor.id,
        serviceShop: "Main St. Garage",
        scheduledFor: inDays(3),
        logistics: "RIDING_WITH",
        logisticsDetail: "Alex Rivera",
      },
    });

    console.log("  • Created 2 sample service requests");
  } else {
    console.log(`  • Skipped sample requests (${existingRequests} already present)`);
  }

  console.log(
    `Done. Users: ${drivers.length + 2}, Vehicles: ${vehicles.length}.\n` +
      "Next: open Prisma Studio (npm run db:studio) and set YOUR real account's role to MANAGER."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
