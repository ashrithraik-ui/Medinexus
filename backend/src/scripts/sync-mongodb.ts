import { PrismaClient } from "@prisma/client";
import { MongoClient } from "mongodb";

const prisma = new PrismaClient();

async function main() {
  const drivers = await prisma.user.findMany({
    where: { role: "AMBULANCE_DRIVER" },
    include: { ambulance: true },
  });
  console.log(`Found ${drivers.length} drivers in database.`);

  const client = new MongoClient("mongodb://127.0.0.1:27017");
  await client.connect();
  const db = client.db("lifeline360");
  const col = db.collection("ambulance_drivers");
  const usersCol = db.collection("users");

  for (const d of drivers) {
    const doc = {
      userId: d.id,
      name: d.name,
      email: d.email,
      phone: d.phone,
      role: d.role,
      vehicleCode: d.ambulance?.vehicleCode || "KA-09-G-3601",
      registeredAt: d.createdAt,
      syncedAt: new Date(),
    };
    await col.updateOne({ email: d.email }, { $set: doc }, { upsert: true });
    await usersCol.updateOne({ email: d.email }, { $set: doc }, { upsert: true });
    console.log(`Synced driver to MongoDB: ${d.name} (${d.email})`);
  }

  const stored = await col.find().toArray();
  console.log(`>>> Total records in MongoDB ambulance_drivers: ${stored.length}`);
  stored.forEach((s) => console.log(` - Doc: ${s.name} | ${s.email} | ${s.phone} | ${s.vehicleCode}`));
  await client.close();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Sync error:", err);
  process.exit(1);
});

