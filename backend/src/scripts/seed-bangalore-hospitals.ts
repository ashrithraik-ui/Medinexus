import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BANGALORE_HOSPITALS = [
  {
    name: "Manipal Hospital Old Airport Road",
    address: "98, HAL Old Airport Road, Kodihalli, Bengaluru",
    city: "Bangalore",
    latitude: 12.9592,
    longitude: 77.6499,
    phone: "080-25024444",
    facilities: JSON.stringify(["Trauma bay", "Cardiac Cath Lab", "Emergency OT", "Blood Bank", "ICU", "CT/MRI"]),
    traumaCapable: true,
    cardiacCapable: true,
    maternityCapable: true,
    readinessStatus: "READY",
    beds: { total: 16, available: 9 },
    doctors: [
      { name: "Dr. Arvind Kumar", specialization: "ORTHOPEDIC", shiftNote: "Senior Trauma Surgeon on duty" },
      { name: "Dr. Sneha Rao", specialization: "CARDIOLOGIST", shiftNote: "Cath Lab Primary On-call" },
      { name: "Dr. Priya Nair", specialization: "GYNECOLOGIST", shiftNote: "Obstetrics Lead" },
      { name: "Dr. Rajesh Hegde", specialization: "EMERGENCY_MEDICINE", shiftNote: "ER Incharge" },
    ],
  },
  {
    name: "Apollo Hospitals Bannerghatta Road",
    address: "154/11, Opp. IIM-B, Bannerghatta Road, Bengaluru",
    city: "Bangalore",
    latitude: 12.8938,
    longitude: 77.5979,
    phone: "080-26304050",
    facilities: JSON.stringify(["Level-1 Trauma", "Cardiac Cath Lab", "Neonatal ICU", "Emergency OT", "CT/MRI"]),
    traumaCapable: true,
    cardiacCapable: true,
    maternityCapable: true,
    readinessStatus: "READY",
    beds: { total: 14, available: 7 },
    doctors: [
      { name: "Dr. Vikram Sharma", specialization: "ORTHOPEDIC", shiftNote: "Trauma specialist available" },
      { name: "Dr. Ramesh Murthy", specialization: "CARDIOLOGIST", shiftNote: "Interventional Cardiologist" },
      { name: "Dr. Kavitha Reddy", specialization: "GYNECOLOGIST", shiftNote: "High-risk pregnancy lead" },
      { name: "Dr. Ananya Sen", specialization: "EMERGENCY_MEDICINE", shiftNote: "Emergency triage physician" },
    ],
  },
  {
    name: "St. John's Medical College Hospital Koramangala",
    address: "Sarjapur Road, John Nagar, Koramangala, Bengaluru",
    city: "Bangalore",
    latitude: 12.9304,
    longitude: 77.6200,
    phone: "080-22065000",
    facilities: JSON.stringify(["Comprehensive Trauma Center", "Emergency OT", "Blood Bank", "ICU", "Cath Lab"]),
    traumaCapable: true,
    cardiacCapable: true,
    maternityCapable: true,
    readinessStatus: "READY",
    beds: { total: 20, available: 12 },
    doctors: [
      { name: "Dr. Joseph Mathew", specialization: "ORTHOPEDIC", shiftNote: "Trauma & Ortho on duty" },
      { name: "Dr. Maria D'Souza", specialization: "CARDIOLOGIST", shiftNote: "Cardiology consultant" },
      { name: "Dr. Sunita Thomas", specialization: "GYNECOLOGIST", shiftNote: "Labor room incharge" },
      { name: "Dr. George Varghese", specialization: "EMERGENCY_MEDICINE", shiftNote: "Chief Medical Officer ER" },
    ],
  },
  {
    name: "Fortis Hospital Cunningham Road",
    address: "14, Cunningham Road, Vasanth Nagar, Bengaluru",
    city: "Bangalore",
    latitude: 12.9872,
    longitude: 77.5956,
    phone: "080-41994444",
    facilities: JSON.stringify(["Emergency Cardiac Care", "Cath Lab", "Stroke Center", "ICU", "OT"]),
    traumaCapable: true,
    cardiacCapable: true,
    maternityCapable: true,
    readinessStatus: "READY",
    beds: { total: 12, available: 6 },
    doctors: [
      { name: "Dr. Deepak Joshi", specialization: "CARDIOLOGIST", shiftNote: "Cath lab team ready" },
      { name: "Dr. Pradeep Nair", specialization: "ORTHOPEDIC", shiftNote: "Joint & trauma surgeon" },
      { name: "Dr. Meera Shenoy", specialization: "EMERGENCY_MEDICINE", shiftNote: "ER Attending" },
    ],
  },
  {
    name: "Aster CMI Hospital Hebbal",
    address: "No. 43/42, Bellary Road, NH 44, Sahakar Nagar, Hebbal, Bengaluru",
    city: "Bangalore",
    latitude: 13.0560,
    longitude: 77.5925,
    phone: "080-43420100",
    facilities: JSON.stringify(["Level-1 Trauma Center", "Neuro & Spine", "Cath Lab", "Emergency ICU"]),
    traumaCapable: true,
    cardiacCapable: true,
    maternityCapable: true,
    readinessStatus: "READY",
    beds: { total: 15, available: 8 },
    doctors: [
      { name: "Dr. Harish Gowda", specialization: "ORTHOPEDIC", shiftNote: "Spine & Trauma specialist" },
      { name: "Dr. Sandeep Patil", specialization: "CARDIOLOGIST", shiftNote: "Cardiac Emergency lead" },
      { name: "Dr. Rekha Bharadwaj", specialization: "GYNECOLOGIST", shiftNote: "Maternity lead on floor" },
      { name: "Dr. Naveen Kumar", specialization: "EMERGENCY_MEDICINE", shiftNote: "Emergency physician" },
    ],
  },
  {
    name: "Manipal Hospital Whitefield",
    address: "ITPL Main Road, KIADB Industrial Area, Whitefield, Bengaluru",
    city: "Bangalore",
    latitude: 12.9830,
    longitude: 77.7490,
    phone: "080-28414000",
    facilities: JSON.stringify(["24/7 Emergency Care", "Pediatric ICU", "Trauma OT", "Cath Lab"]),
    traumaCapable: true,
    cardiacCapable: true,
    maternityCapable: true,
    readinessStatus: "READY",
    beds: { total: 12, available: 5 },
    doctors: [
      { name: "Dr. Karthik Iyer", specialization: "ORTHOPEDIC", shiftNote: "Trauma duty surgeon" },
      { name: "Dr. Anita Roy", specialization: "CARDIOLOGIST", shiftNote: "Cardiologist on site" },
      { name: "Dr. Pooja Menon", specialization: "GYNECOLOGIST", shiftNote: "OBGYN consultant" },
      { name: "Dr. Vinod Shetty", specialization: "EMERGENCY_MEDICINE", shiftNote: "ER Resident Lead" },
    ],
  },
  {
    name: "Victoria Hospital (BMCRI Trauma Center)",
    address: "Fort, Near City Market, Kalasipalya, Bengaluru",
    city: "Bangalore",
    latitude: 12.9629,
    longitude: 77.5746,
    phone: "080-26701150",
    facilities: JSON.stringify(["Govt Level-1 Trauma Care", "Burn Unit", "24x7 Emergency Surgery", "Blood Bank"]),
    traumaCapable: true,
    cardiacCapable: true,
    maternityCapable: true,
    readinessStatus: "READY",
    beds: { total: 25, available: 14 },
    doctors: [
      { name: "Dr. Suresh Babu", specialization: "ORTHOPEDIC", shiftNote: "Chief Trauma Specialist" },
      { name: "Dr. Shweta Kulkarni", specialization: "EMERGENCY_MEDICINE", shiftNote: "Emergency incharge" },
      { name: "Dr. Manjunath Swamy", specialization: "GENERAL_PHYSICIAN", shiftNote: "General surgery on-call" },
    ],
  },
  {
    name: "Narayana Health City Bommasandra",
    address: "258/A, Bommasandra Industrial Area, Anekal Taluk, Bengaluru",
    city: "Bangalore",
    latitude: 12.8125,
    longitude: 77.6896,
    phone: "080-71222222",
    facilities: JSON.stringify(["World-class Heart Institute", "Cath Labs", "Emergency OT", "Critical Care ICU"]),
    traumaCapable: true,
    cardiacCapable: true,
    maternityCapable: false,
    readinessStatus: "READY",
    beds: { total: 24, available: 16 },
    doctors: [
      { name: "Dr. Ashwin Kamath", specialization: "CARDIOLOGIST", shiftNote: "Senior Interventionalist on floor" },
      { name: "Dr. Mohan Das", specialization: "CARDIOLOGIST", shiftNote: "Pediatric & Adult Cardiac Lead" },
      { name: "Dr. Preeti Deshmukh", specialization: "EMERGENCY_MEDICINE", shiftNote: "Emergency Department Lead" },
    ],
  },
];

async function seedBangalore() {
  console.log("Seeding Bangalore hospitals...");
  for (const h of BANGALORE_HOSPITALS) {
    const existing = await prisma.hospital.findFirst({ where: { name: h.name } });
    if (existing) {
      console.log(`- Hospital already exists: ${h.name}`);
      continue;
    }

    const created = await prisma.hospital.create({
      data: {
        name: h.name,
        address: h.address,
        city: h.city,
        latitude: h.latitude,
        longitude: h.longitude,
        phone: h.phone,
        facilities: h.facilities,
        traumaCapable: h.traumaCapable,
        cardiacCapable: h.cardiacCapable,
        maternityCapable: h.maternityCapable,
        readinessStatus: h.readinessStatus,
        isDemoData: true,
        beds: {
          create: {
            total: h.beds.total,
            available: h.beds.available,
          },
        },
      },
    });

    for (const d of h.doctors) {
      await prisma.doctor.create({
        data: {
          hospitalId: created.id,
          name: d.name,
          specialization: d.specialization,
          availability: {
            create: {
              isAvailable: true,
              shiftNote: d.shiftNote,
            },
          },
        },
      });
    }

    console.log(`+ Seeded: ${h.name} (${h.city}) with ${h.doctors.length} doctors and ${h.beds.available} beds`);
  }

  const count = await prisma.hospital.count({ where: { city: "Bangalore" } });
  console.log(`>>> Total Bangalore hospitals now in database: ${count}`);

  console.log("Seeding Bangalore traffic corridor signals...");
  const BANGALORE_SIGNALS = [
    { code: "BLR-SIG-01", name: "Sony World Junction, Koramangala", latitude: 12.9352, longitude: 77.6245 },
    { code: "BLR-SIG-02", name: "Koramangala 80ft Road Junction", latitude: 12.9378, longitude: 77.6280 },
    { code: "BLR-SIG-03", name: "Sarjapur - St. John's Crossing", latitude: 12.9315, longitude: 77.6210 },
    { code: "BLR-SIG-04", name: "Dairy Circle Flyover Junction", latitude: 12.9388, longitude: 77.6015 },
    { code: "BLR-SIG-05", name: "Adugodi Police Station Signal", latitude: 12.9442, longitude: 77.6095 },
    { code: "BLR-SIG-06", name: "Anepalya Junction / Hosur Road", latitude: 12.9495, longitude: 77.6030 },
    { code: "BLR-SIG-07", name: "Richmond Circle Signal", latitude: 12.9642, longitude: 77.5992 },
    { code: "BLR-SIG-08", name: "Trinity Circle / MG Road", latitude: 12.9725, longitude: 77.6180 },
    { code: "BLR-SIG-09", name: "Domlur Intermediate Ring Road", latitude: 12.9610, longitude: 77.6390 },
    { code: "BLR-SIG-10", name: "HAL Old Airport Road / Manipal Gate", latitude: 12.9585, longitude: 77.6480 },
    { code: "BLR-SIG-11", name: "Madiwala Checkpost Junction", latitude: 12.9220, longitude: 77.6200 },
    { code: "BLR-SIG-12", name: "Silk Board Junction", latitude: 12.9175, longitude: 77.6235 },
    { code: "BLR-SIG-13", name: "Bannerghatta - Jayadeva Flyover", latitude: 12.9180, longitude: 77.5990 },
    { code: "BLR-SIG-14", name: "Apollo Bannerghatta Gate Signal", latitude: 12.8942, longitude: 77.5975 },
    { code: "BLR-SIG-15", name: "Hebbal Flyover Junction", latitude: 13.0360, longitude: 77.5965 },
  ];

  let sigOrder = 100;
  for (const s of BANGALORE_SIGNALS) {
    const existingSig = await prisma.trafficSignal.findUnique({ where: { code: s.code } });
    if (!existingSig) {
      await prisma.trafficSignal.create({
        data: {
          code: s.code,
          name: s.name,
          latitude: s.latitude,
          longitude: s.longitude,
          status: "RED",
          mode: "NORMAL",
          sequenceOrder: sigOrder++,
          isDemoData: true,
        },
      });
      console.log(`+ Seeded traffic signal: ${s.code} - ${s.name}`);
    }
  }

  await prisma.$disconnect();
}

seedBangalore().catch((err) => {
  console.error("Error seeding Bangalore hospitals:", err);
  process.exit(1);
});
