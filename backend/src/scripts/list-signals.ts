import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const signals = await prisma.trafficSignal.findMany({ orderBy: { sequenceOrder: "asc" } });
  console.log(`Total signals in DB: ${signals.length}`);
  signals.forEach((s) => {
    console.log(`${s.code.padEnd(12)} | ${s.name.padEnd(40)} | (${s.latitude}, ${s.longitude}) | Mode: ${s.mode} | Status: ${s.status}`);
  });
  await prisma.$disconnect();
}

main().catch(console.error);

