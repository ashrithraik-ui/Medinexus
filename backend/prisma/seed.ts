import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("Demo@12345", 10);
  await prisma.trafficPriorityRequest.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.emergencyHistory.deleteMany();
  await prisma.ambulanceLocation.deleteMany();
  await prisma.emergencyRequest.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.doctorAvailability.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.emergencyBeds.deleteMany();
  await prisma.ambulance.deleteMany();
  await prisma.user.deleteMany();
  await prisma.trafficSignal.deleteMany();
  await prisma.hospital.deleteMany();
  await prisma.systemLog.deleteMany();

  const hospitals = await Promise.all([
    prisma.hospital.create({
      data: {
        name: "JSS Hospital Mysore",
        address: "Mahatma Gandhi Road, Mysuru",
        city: "Mysore",
        latitude: 12.3395,
        longitude: 76.6228,
        phone: "0821-2548330",
        facilities: JSON.stringify(["Trauma bay", "CT", "Emergency OT", "Blood bank", "ICU"]),
        traumaCapable: true,
        cardiacCapable: true,
        maternityCapable: true,
        readinessStatus: "READY",
        isDemoData: true,
        beds: { create: { total: 8, available: 5 } },
      },
    }),
    prisma.hospital.create({
      data: {
        name: "Apollo BGS Hospitals Mysore",
        address: "Adichunchanagiri Road, Kuvempunagar",
        city: "Mysore",
        latitude: 12.3238,
        longitude: 76.6335,
        phone: "0821-2568888",
        facilities: JSON.stringify(["Cardiac cath lab", "ICU", "Emergency OT"]),
        traumaCapable: true,
        cardiacCapable: true,
        maternityCapable: true,
        readinessStatus: "READY",
        isDemoData: true,
        beds: { create: { total: 6, available: 3 } },
      },
    }),
    prisma.hospital.create({
      data: {
        name: "K.R. Hospital Mysore",
        address: "Sayyaji Rao Road, Mysuru",
        city: "Mysore",
        latitude: 12.3118,
        longitude: 76.6509,
        phone: "0821-2421100",
        facilities: JSON.stringify(["Government trauma", "Emergency medicine", "General OT"]),
        traumaCapable: true,
        cardiacCapable: false,
        maternityCapable: true,
        readinessStatus: "LIMITED",
        isDemoData: true,
        beds: { create: { total: 10, available: 4 } },
      },
    }),
    prisma.hospital.create({
      data: {
        name: "Manipal Hospital Mysore",
        address: "Bangalore-Mysore Ring Road",
        city: "Mysore",
        latitude: 12.3462,
        longitude: 76.6391,
        phone: "0821-4001000",
        facilities: JSON.stringify(["ICU", "Maternity", "Emergency"]),
        traumaCapable: false,
        cardiacCapable: true,
        maternityCapable: true,
        readinessStatus: "READY",
        isDemoData: true,
        beds: { create: { total: 5, available: 2 } },
      },
    }),
    prisma.hospital.create({
      data: {
        name: "Mysore City Care Clinic (Demo)",
        address: "Near Mysore Palace, Irwin Road",
        city: "Mysore",
        latitude: 12.3061,
        longitude: 76.6544,
        phone: "0821-0000000",
        facilities: JSON.stringify(["OPD", "Basic first aid"]),
        traumaCapable: false,
        cardiacCapable: false,
        maternityCapable: false,
        readinessStatus: "READY",
        isDemoData: true,
        beds: { create: { total: 2, available: 1 } },
      },
    }),
  ]);

  const [jss, apollo, kr, manipal, clinic] = hospitals;

  const doctorRows = [
    { hospitalId: jss.id, name: "Dr. Ananya Rao", specialization: "ORTHOPEDIC" },
    { hospitalId: jss.id, name: "Dr. Vikram Shetty", specialization: "EMERGENCY_MEDICINE" },
    { hospitalId: jss.id, name: "Dr. Nisha Patel", specialization: "CARDIOLOGIST" },
    { hospitalId: apollo.id, name: "Dr. Rahul Menon", specialization: "CARDIOLOGIST" },
    { hospitalId: apollo.id, name: "Dr. Sneha Iyer", specialization: "EMERGENCY_MEDICINE" },
    { hospitalId: apollo.id, name: "Dr. Kavya Prasad", specialization: "GYNECOLOGIST" },
    { hospitalId: kr.id, name: "Dr. Mahesh Gowda", specialization: "EMERGENCY_MEDICINE" },
    { hospitalId: kr.id, name: "Dr. Poornima Das", specialization: "GENERAL_PHYSICIAN" },
    { hospitalId: manipal.id, name: "Dr. Aisha Khan", specialization: "GYNECOLOGIST" },
    { hospitalId: manipal.id, name: "Dr. Arjun Nair", specialization: "CARDIOLOGIST" },
    { hospitalId: clinic.id, name: "Dr. Ramesh Bhat", specialization: "GENERAL_PHYSICIAN" },
  ];

  for (const doctor of doctorRows) {
    await prisma.doctor.create({
      data: {
        ...doctor,
        isDemoData: true,
        availability: { create: { isAvailable: doctor.specialization !== "GENERAL_PHYSICIAN" || doctor.hospitalId !== clinic.id, shiftNote: "DEMO DATA" } },
      },
    });
  }

  await prisma.user.create({
    data: {
      email: "admin@lifeline360.demo",
      passwordHash: password,
      name: "System Administrator",
      role: "ADMIN",
    },
  });

  const driver = await prisma.user.create({
    data: {
      email: "driver.mysore@lifeline360.demo",
      passwordHash: password,
      name: "Sanjay Driver",
      role: "AMBULANCE_DRIVER",
      phone: "9876500001",
    },
  });
  const driver2 = await prisma.user.create({
    data: {
      email: "driver2.mysore@lifeline360.demo",
      passwordHash: password,
      name: "Lakshmi Driver",
      role: "AMBULANCE_DRIVER",
    },
  });
  const driver3 = await prisma.user.create({
    data: {
      email: "driver3.mysore@lifeline360.demo",
      passwordHash: password,
      name: "Imran Driver",
      role: "AMBULANCE_DRIVER",
    },
  });

  await prisma.ambulance.createMany({
    data: [
      { userId: driver.id, vehicleCode: "KA-09-G-3601", currentLat: 12.3054, currentLng: 76.6551, isDemoData: true },
      { userId: driver2.id, vehicleCode: "KA-09-G-3602", currentLat: 12.3201, currentLng: 76.6402, isDemoData: true },
      { userId: driver3.id, vehicleCode: "KA-09-G-3603", currentLat: 12.2988, currentLng: 76.6419, isDemoData: true },
    ],
  });

  await prisma.user.create({
    data: {
      email: "jss.hospital@lifeline360.demo",
      passwordHash: password,
      name: "JSS Emergency Desk",
      role: "HOSPITAL_STAFF",
      hospitalId: jss.id,
    },
  });
  await prisma.user.create({
    data: {
      email: "apollo.hospital@lifeline360.demo",
      passwordHash: password,
      name: "Apollo Emergency Desk",
      role: "HOSPITAL_STAFF",
      hospitalId: apollo.id,
    },
  });
  await prisma.user.create({
    data: {
      email: "traffic.mysore@lifeline360.demo",
      passwordHash: password,
      name: "Mysore Traffic Control",
      role: "TRAFFIC_CONTROL",
    },
  });

  const signals = [
    { code: "SIG-01", name: "Palace Road Junction", latitude: 12.3078, longitude: 76.6534, status: "RED" },
    { code: "SIG-02", name: "Sayyaji Rao Circle", latitude: 12.3124, longitude: 76.6506, status: "GREEN" },
    { code: "SIG-03", name: "Irwin Road Signal", latitude: 12.3176, longitude: 76.6474, status: "YELLOW" },
    { code: "SIG-04", name: "K.R. Circle Approach", latitude: 12.3204, longitude: 76.6452, status: "RED" },
    { code: "SIG-05", name: "Hunsur Road Crossing", latitude: 12.3264, longitude: 76.6406, status: "GREEN" },
    { code: "SIG-06", name: "Kuvempunagar Junction", latitude: 12.3326, longitude: 76.6352, status: "RED" },
    { code: "SIG-07", name: "JSS Approach Signal", latitude: 12.3376, longitude: 76.6296, status: "YELLOW" },
    { code: "SIG-08", name: "Hospital Gate Crossing", latitude: 12.3388, longitude: 76.6264, status: "RED" },
  ];

  for (const [index, signal] of signals.entries()) {
    await prisma.trafficSignal.create({
      data: { ...signal, sequenceOrder: index + 1, mode: "NORMAL", isDemoData: true },
    });
  }

  await prisma.systemLog.create({
    data: { action: "SEED", detail: "Mysore DEMO DATA loaded for LIFELINE 360 hackathon" },
  });

  console.log("Seeded LIFELINE 360 demo data for Mysore.");
  console.log("Demo logins (password: Demo@12345):");
  console.log("  admin@lifeline360.demo");
  console.log("  driver.mysore@lifeline360.demo");
  console.log("  jss.hospital@lifeline360.demo");
  console.log("  traffic.mysore@lifeline360.demo");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
