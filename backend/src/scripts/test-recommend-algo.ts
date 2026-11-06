import { PrismaClient } from "@prisma/client";
import { recommendHospitals } from "../utils/recommendation.js";

const prisma = new PrismaClient();

async function testAlgo() {
  const hospitals = await prisma.hospital.findMany({
    include: { beds: true, doctors: { include: { availability: true } } },
  });

  console.log(`\n======================================================`);
  console.log(`TEST 1: Request from BANGALORE (Koramangala: 12.9352, 77.6245)`);
  console.log(`======================================================`);
  const blrResults = recommendHospitals("ROAD_ACCIDENT", 12.9352, 77.6245, hospitals);
  blrResults.forEach((h, i) => {
    console.log(
      `${i + 1}. [${h.city || "N/A"}] ${h.name.padEnd(46)} | Dist: ${h.distanceKm.toFixed(1).padStart(5)} km | ETA: ${String(h.etaMinutes).padStart(3)} min | Score: ${String(h.score).padStart(4)} | Suitable: ${h.suitable}`
    );
  });

  console.log(`\n======================================================`);
  console.log(`TEST 2: Request from MYSORE (Mysore Palace: 12.3054, 76.6551)`);
  console.log(`======================================================`);
  const myqResults = recommendHospitals("ROAD_ACCIDENT", 12.3054, 76.6551, hospitals);
  myqResults.forEach((h, i) => {
    console.log(
      `${i + 1}. [${h.city || "N/A"}] ${h.name.padEnd(46)} | Dist: ${h.distanceKm.toFixed(1).padStart(5)} km | ETA: ${String(h.etaMinutes).padStart(3)} min | Score: ${String(h.score).padStart(4)} | Suitable: ${h.suitable}`
    );
  });

  await prisma.$disconnect();
}

testAlgo().catch((err) => {
  console.error("Algo test error:", err);
  process.exit(1);
});

