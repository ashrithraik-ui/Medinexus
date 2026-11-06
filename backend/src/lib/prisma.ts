/**
 * ==============================================================================
 * Relational Database Client (src/lib/prisma.ts)
 * ==============================================================================
 * This file creates and exports a single, shared connection to our primary
 * database (SQLite / PostgreSQL) through Prisma ORM.
 *
 * What is an ORM (Object-Relational Mapping)?
 * Instead of writing raw SQL database queries by hand (like "SELECT * FROM users"),
 * Prisma lets us write clean TypeScript code like `prisma.user.findMany()`.
 *
 * Why a single export?
 * Having one shared instance prevents opening too many database connections,
 * keeping the system fast, memory-efficient, and responsive.
 * ==============================================================================
 */

import { PrismaClient } from "@prisma/client";

// Global database client instance used across all routes and services
export const prisma = new PrismaClient();
