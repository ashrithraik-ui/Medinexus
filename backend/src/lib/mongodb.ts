/**
 * ==============================================================================
 * MongoDB Database Manager (src/lib/mongodb.ts)
 * ==============================================================================
 * This file handles our secondary database: MongoDB.
 *
 * Why do we have MongoDB in addition to SQLite/Prisma?
 * 1. Document Storage: MongoDB is designed to store documents with flexible shapes
 *    (e.g. lists of doctors with specialties, hospital facilities, driver profiles).
 * 2. Visual Management: Users can open MongoDB Compass (port 27017) and visually
 *    browse, inspect, and export hospital staff, bed capacities, and ambulance logs.
 * 3. Embedded Local Engine: If you don't have MongoDB installed as a system service,
 *    this file automatically boots up a lightweight embedded MongoDB engine (using WiredTiger)
 *    so the application works out-of-the-box with zero setup!
 * ==============================================================================
 */

import { MongoClient, Db } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Cache variables to keep the database connection alive across function calls
let client: MongoClient | null = null;
let db: Db | null = null;
let isConnecting = false;
let memoryServer: any = null;

/**
 * ------------------------------------------------------------------------------
 * ensureMongoDBServer()
 * ------------------------------------------------------------------------------
 * Checks if a MongoDB server is already running on port 27017.
 * If yes: Great, it reuses it.
 * If no: It boots an embedded MongoDB instance using `mongodb-memory-server`
 * and stores data persistently in the `backend/data/mongodb` directory.
 */
export async function ensureMongoDBServer(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: true });
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lifeline360";

  // Step 1: Probe if an existing MongoDB service is already awake and listening
  try {
    const testClient = new MongoClient(uri, { serverSelectionTimeoutMS: 1500, connectTimeoutMS: 1500 });
    await testClient.connect();
    await testClient.close();
    return; // Port 27017 is already up! No need to start another instance.
  } catch {
    // Step 2: If no server responded, start the local embedded MongoDB engine
    if ((uri.includes("127.0.0.1") || uri.includes("localhost")) && !memoryServer) {
      try {
        const { MongoMemoryServer } = await import("mongodb-memory-server");
        const dataDir = path.resolve(process.cwd(), "data", "mongodb");
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        memoryServer = await MongoMemoryServer.create({
          instance: {
            port: 27017,
            dbName: "lifeline360",
            dbPath: dataDir,
            storageEngine: "wiredTiger",
          },
        });
        console.log(`[MongoDB] Local MongoDB server running on port 27017. Compass can connect to: mongodb://localhost:27017`);
      } catch (err) {
        console.warn("[MongoDB] Could not start embedded MongoDB instance:", err instanceof Error ? err.message : String(err));
      }
    }
  }
}

/**
 * ------------------------------------------------------------------------------
 * connectMongoDB()
 * ------------------------------------------------------------------------------
 * Establishes and returns an active MongoDB database connection.
 * If already connected, it returns the cached connection immediately.
 */
export async function connectMongoDB(): Promise<Db | null> {
  if (db) return db;
  if (isConnecting) return null;
  isConnecting = true;

  // Reload .env so changes in MONGODB_URI take effect immediately
  dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: true });
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lifeline360";

  try {
    await ensureMongoDBServer();
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
    });
    await client.connect();
    db = client.db("lifeline360");
    console.log(`[MongoDB] Connected successfully to ${uri}`);
    return db;
  } catch (err) {
    console.warn(`[MongoDB] Notice: Could not connect to MongoDB at ${uri} (${err instanceof Error ? err.message : String(err)}). Registration will continue safely.`);
    return null;
  } finally {
    isConnecting = false;
  }
}

/**
 * ------------------------------------------------------------------------------
 * saveDriverToMongoDB()
 * ------------------------------------------------------------------------------
 * Called whenever an Ambulance Driver registers or updates their account.
 * Saves their details (name, email, vehicle number plate, phone) into the
 * `ambulance_drivers` collection in MongoDB.
 */
export async function saveDriverToMongoDB(data: {
  userId: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  vehicleCode: string;
  registeredAt: Date;
}): Promise<boolean> {
  try {
    const database = await connectMongoDB();
    if (!database) {
      console.warn("[MongoDB] MongoDB not connected, skipping secondary storage sync.");
      return false;
    }

    const collection = database.collection("ambulance_drivers");
    // "upsert: true" means: If the driver exists, update their record; if not, create a new one!
    await collection.updateOne(
      { email: data.email.toLowerCase() },
      {
        $set: {
          userId: data.userId,
          name: data.name,
          email: data.email.toLowerCase(),
          phone: data.phone || null,
          role: data.role,
          vehicleCode: data.vehicleCode,
          registeredAt: data.registeredAt,
          syncedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // Also mirror into the general `users` collection for quick lookups
    const usersCol = database.collection("users");
    await usersCol.updateOne(
      { email: data.email.toLowerCase() },
      {
        $set: {
          userId: data.userId,
          name: data.name,
          email: data.email.toLowerCase(),
          phone: data.phone || null,
          role: data.role,
          vehicleCode: data.vehicleCode,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    console.log(`[MongoDB] Driver registration data stored in MongoDB successfully for: ${data.email}`);
    return true;
  } catch (err) {
    console.error("[MongoDB] Failed to write driver data to MongoDB:", err);
    return false;
  }
}

/**
 * ------------------------------------------------------------------------------
 * saveHospitalStaffToMongoDB()
 * ------------------------------------------------------------------------------
 * Called whenever Hospital Staff registers.
 * Collects and stores:
 * - Staff Member Name & Email
 * - Hospital Facility Name & Contact Phone
 * - Emergency / ICU Bed Capacity
 * - Roster of Specialist Doctors
 * into the `hospital_staff` collection in MongoDB.
 */
export async function saveHospitalStaffToMongoDB(data: {
  userId: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  hospitalId: string;
  hospitalName?: string;
  hospitalPhone?: string | null;
  numberOfBeds?: number | string | null;
  doctors?: string | string[] | null;
  registeredAt: Date;
}): Promise<boolean> {
  try {
    const database = await connectMongoDB();
    if (!database) {
      console.warn("[MongoDB] MongoDB not connected, skipping secondary storage sync.");
      return false;
    }

    const bedsCount = Number(data.numberOfBeds) || 15;
    const docInfo = Array.isArray(data.doctors)
      ? data.doctors.join(", ")
      : data.doctors || "Dr. Rajesh (Cardiology), Dr. Priya (Trauma & Emergency)";

    const collection = database.collection("hospital_staff");
    await collection.updateOne(
      { email: data.email.toLowerCase() },
      {
        $set: {
          userId: data.userId,
          name: data.name,
          email: data.email.toLowerCase(),
          phone: data.phone || data.hospitalPhone || null,
          role: data.role,
          hospitalId: data.hospitalId,
          hospitalName: data.hospitalName || "Hospital Facility",
          hospitalPhone: data.hospitalPhone || data.phone || "080-25000000",
          numberOfBeds: bedsCount,
          doctors: docInfo,
          registeredAt: data.registeredAt,
          syncedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // Also mirror into the general `users` collection
    const usersCol = database.collection("users");
    await usersCol.updateOne(
      { email: data.email.toLowerCase() },
      {
        $set: {
          userId: data.userId,
          name: data.name,
          email: data.email.toLowerCase(),
          phone: data.phone || data.hospitalPhone || null,
          role: data.role,
          hospitalId: data.hospitalId,
          hospitalName: data.hospitalName || "Hospital Facility",
          hospitalPhone: data.hospitalPhone || data.phone || "080-25000000",
          numberOfBeds: bedsCount,
          doctors: docInfo,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    console.log(`[MongoDB] Hospital staff registration stored in MongoDB -> Staff: ${data.name} | Hospital: ${data.hospitalName} | Phone: ${data.hospitalPhone || data.phone} | Beds: ${bedsCount} | Doctors: ${docInfo}`);
    return true;
  } catch (err) {
    console.error("[MongoDB] Failed to write hospital staff data to MongoDB:", err);
    return false;
  }
}

/**
 * ------------------------------------------------------------------------------
 * getHospitalStaffFromMongoDB()
 * ------------------------------------------------------------------------------
 * Reads all hospital staff records directly from the MongoDB `hospital_staff` collection.
 * Used by the frontend or API to display staff rosters.
 */
export async function getHospitalStaffFromMongoDB(): Promise<any[]> {
  try {
    const database = await connectMongoDB();
    if (!database) return [];
    const collection = database.collection("hospital_staff");
    return await collection.find({}).sort({ registeredAt: -1 }).toArray();
  } catch (err) {
    console.error("[MongoDB] Error reading hospital staff from MongoDB:", err);
    return [];
  }
}

/**
 * ------------------------------------------------------------------------------
 * getMongoDBStatus()
 * ------------------------------------------------------------------------------
 * Returns live statistics about our MongoDB connection:
 * - Is the database connected? (true/false)
 * - Number of records in `hospital_staff`, `hospitals`, `ambulance_drivers`, and `users`.
 * - A sample list of registered hospital staff.
 * Powered by: GET /api/mongodb/status
 */
export async function getMongoDBStatus(): Promise<{
  connected: boolean;
  uri: string;
  database: string;
  collections: {
    hospital_staff: number;
    hospitals: number;
    ambulance_drivers: number;
    users: number;
  };
  sampleStaff?: any[];
}> {
  try {
    const database = await connectMongoDB();
    if (!database) {
      return {
        connected: false,
        uri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lifeline360",
        database: "lifeline360",
        collections: { hospital_staff: 0, hospitals: 0, ambulance_drivers: 0, users: 0 },
      };
    }

    const [staffCount, hospCount, driverCount, userCount, staffList] = await Promise.all([
      database.collection("hospital_staff").countDocuments(),
      database.collection("hospitals").countDocuments(),
      database.collection("ambulance_drivers").countDocuments(),
      database.collection("users").countDocuments(),
      database.collection("hospital_staff").find({}).sort({ registeredAt: -1 }).limit(10).toArray(),
    ]);

    return {
      connected: true,
      uri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lifeline360",
      database: "lifeline360",
      collections: {
        hospital_staff: staffCount,
        hospitals: hospCount,
        ambulance_drivers: driverCount,
        users: userCount,
      },
      sampleStaff: staffList,
    };
  } catch {
    return {
      connected: false,
      uri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lifeline360",
      database: "lifeline360",
      collections: { hospital_staff: 0, hospitals: 0, ambulance_drivers: 0, users: 0 },
    };
  }
}

/**
 * ------------------------------------------------------------------------------
 * saveHospitalToMongoDB()
 * ------------------------------------------------------------------------------
 * Writes or updates a hospital facility profile (name, address, GPS coordinates,
 * facilities, trauma capabilities) into the `hospitals` collection in MongoDB.
 */
export async function saveHospitalToMongoDB(data: {
  hospitalId: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  phone: string;
  facilities?: string[] | string;
  traumaCapable?: boolean;
  cardiacCapable?: boolean;
  maternityCapable?: boolean;
  readinessStatus?: string;
  beds?: { total: number; available: number } | null;
  numberOfBeds?: number | string | null;
  doctors?: string | string[] | null;
  registeredAt?: Date;
}): Promise<boolean> {
  try {
    const database = await connectMongoDB();
    if (!database) {
      console.warn("[MongoDB] MongoDB not connected, skipping hospital facility storage sync.");
      return false;
    }

    let facilitiesList: string[] = [];
    if (Array.isArray(data.facilities)) {
      facilitiesList = data.facilities;
    } else if (typeof data.facilities === "string") {
      try {
        facilitiesList = JSON.parse(data.facilities);
      } catch {
        facilitiesList = [data.facilities];
      }
    } else {
      facilitiesList = ["Trauma Bay", "Emergency OT", "ICU", "Blood Bank"];
    }

    const collection = database.collection("hospitals");
    await collection.updateOne(
      { hospitalId: data.hospitalId },
      {
        $set: {
          hospitalId: data.hospitalId,
          name: data.name,
          address: data.address,
          city: data.city,
          latitude: data.latitude,
          longitude: data.longitude,
          phone: data.phone,
          facilities: facilitiesList,
          traumaCapable: data.traumaCapable ?? true,
          cardiacCapable: data.cardiacCapable ?? true,
          maternityCapable: data.maternityCapable ?? true,
          readinessStatus: data.readinessStatus || "READY",
          beds: data.beds || { total: 10, available: 6 },
          registeredAt: data.registeredAt || new Date(),
          syncedAt: new Date(),
        },
      },
      { upsert: true }
    );

    console.log(`[MongoDB] Hospital facility data stored in MongoDB successfully for: ${data.name} (${data.city})`);
    return true;
  } catch (err) {
    console.error("[MongoDB] Failed to write hospital facility data to MongoDB:", err);
    return false;
  }
}

/**
 * ------------------------------------------------------------------------------
 * syncAllHospitalsToMongoDB()
 * ------------------------------------------------------------------------------
 * Automatically called at backend startup.
 * Reads all hospital facilities from Prisma (SQLite) and writes them into MongoDB
 * so MongoDB Compass immediately has a complete, fresh directory of hospitals.
 */
export async function syncAllHospitalsToMongoDB(): Promise<void> {
  try {
    const database = await connectMongoDB();
    if (!database) return;

    const { prisma } = await import("./prisma.js");
    const hospitals = await prisma.hospital.findMany({
      include: { beds: true, doctors: true },
    });

    const hospitalsCol = database.collection("hospitals");
    for (const h of hospitals) {
      let facilitiesArr: string[] = [];
      try {
        facilitiesArr = typeof h.facilities === "string" ? JSON.parse(h.facilities) : h.facilities;
      } catch {
        facilitiesArr = [];
      }

      await hospitalsCol.updateOne(
        { hospitalId: h.id },
        {
          $set: {
            hospitalId: h.id,
            name: h.name,
            address: h.address,
            city: h.city,
            latitude: h.latitude,
            longitude: h.longitude,
            phone: h.phone,
            facilities: facilitiesArr,
            traumaCapable: h.traumaCapable,
            cardiacCapable: h.cardiacCapable,
            maternityCapable: h.maternityCapable,
            readinessStatus: h.readinessStatus,
            beds: h.beds ? { total: h.beds.total, available: h.beds.available } : { total: 8, available: 4 },
            registeredAt: h.createdAt,
            syncedAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    const count = await hospitalsCol.countDocuments();
    console.log(`[MongoDB] Synced to MongoDB -> hospitals: ${count} records`);
  } catch (err) {
    console.error("[MongoDB] Sync all hospitals error:", err);
  }
}

/**
 * ------------------------------------------------------------------------------
 * syncAllUsersToMongoDB()
 * ------------------------------------------------------------------------------
 * Automatically called at backend startup.
 * Reads all registered drivers and hospital staff from Prisma (SQLite)
 * and mirrors them into the corresponding MongoDB collections.
 */
export async function syncAllUsersToMongoDB(): Promise<void> {
  try {
    const database = await connectMongoDB();
    if (!database) return;

    const { prisma } = await import("./prisma.js");
    const users = await prisma.user.findMany({
      include: {
        ambulance: true,
        hospital: {
          include: { beds: true, doctors: true },
        },
      },
    });

    const driversCol = database.collection("ambulance_drivers");
    const staffCol = database.collection("hospital_staff");
    const usersCol = database.collection("users");

    for (const u of users) {
      const docList = u.hospital?.doctors?.map((d) => `${d.name} (${d.specialization})`).join(", ") ||
        "Dr. Rajesh (Cardiology), Dr. Priya (Trauma & Emergency)";
      const bedsTotal = u.hospital?.beds?.total || 12;
      const hospPhone = u.hospital?.phone || u.phone || "080-25000000";

      const baseDoc = {
        userId: u.id,
        name: u.name,
        email: u.email.toLowerCase(),
        phone: u.phone || null,
        role: u.role,
        hospitalId: u.hospitalId || null,
        hospitalName: u.hospital?.name || null,
        hospitalPhone: hospPhone,
        numberOfBeds: bedsTotal,
        doctors: docList,
        vehicleCode: u.ambulance?.vehicleCode || null,
        registeredAt: u.createdAt,
        syncedAt: new Date(),
      };

      await usersCol.updateOne({ email: u.email.toLowerCase() }, { $set: baseDoc }, { upsert: true });

      if (u.role === "HOSPITAL_STAFF" && u.hospitalId) {
        await staffCol.updateOne(
          { email: u.email.toLowerCase() },
          {
            $set: {
              userId: u.id,
              name: u.name,
              email: u.email.toLowerCase(),
              phone: u.phone || hospPhone,
              role: u.role,
              hospitalId: u.hospitalId,
              hospitalName: u.hospital?.name || "Hospital Facility",
              hospitalPhone: hospPhone,
              numberOfBeds: bedsTotal,
              doctors: docList,
              registeredAt: u.createdAt,
              syncedAt: new Date(),
            },
          },
          { upsert: true }
        );
      }

      if (u.role === "AMBULANCE_DRIVER") {
        await driversCol.updateOne(
          { email: u.email.toLowerCase() },
          {
            $set: {
              userId: u.id,
              name: u.name,
              email: u.email.toLowerCase(),
              phone: u.phone || null,
              role: u.role,
              vehicleCode: u.ambulance?.vehicleCode || "KA-09-G-3601",
              registeredAt: u.createdAt,
              syncedAt: new Date(),
            },
          },
          { upsert: true }
        );
      }
    }

    const staffCount = await staffCol.countDocuments();
    const driverCount = await driversCol.countDocuments();
    console.log(`[MongoDB] Synced to MongoDB -> hospital_staff: ${staffCount} records | ambulance_drivers: ${driverCount} records`);
  } catch (err) {
    console.error("[MongoDB] Sync all users error:", err);
  }
}
