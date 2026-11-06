# LIFELINE 360

Smart emergency response, hospital coordination, and intelligent green-corridor **simulation** for a college hackathon. Demonstration city: **Mysore**.

This is a working full-stack prototype (React + Express + Prisma + Socket.IO + Leaflet). It is **not** connected to real hospitals, live bed feeds, or public traffic signals.

## Safety

Sequential traffic priority is simulated only. The app never commands real-world controllers. A future integration port lives in `backend/src/services/trafficIntegration.ts` and is intentionally unused against field hardware.

Seeded hospital beds, doctor availability, and signal states are labelled **DEMO DATA**.

Hospital matching is **rule-based suitability scoring** (specialist, beds, readiness, facilities, distance). It is not an AI model.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind, Leaflet, Socket.IO client
- Backend: Express, TypeScript, JWT, bcrypt, Socket.IO
- Database: Prisma. Local demo uses SQLite so the project runs without installing PostgreSQL. Schema is relational and can be pointed at PostgreSQL.

## Quick start

```bash
cd "C:\Users\ASHRITH\OneDrive\Desktop\New folder\hacakthon"
npm install
cd backend && copy .env.example .env
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
cd ..
npm run install:all
npm run dev
```

Open `http://localhost:5173`.

API health: `http://localhost:4000/api/health`.

### Demo logins

Password for all seeded users: `Demo@12345`

| Role | Email |
| --- | --- |
| Ambulance driver | `driver.mysore@lifeline360.demo` |
| JSS Hospital desk | `jss.hospital@lifeline360.demo` |
| Traffic control | `traffic.mysore@lifeline360.demo` |
| Admin | `admin@lifeline360.demo` |

## End-to-end demo (road accident)

Use two browsers (or a window plus a private window).

1. Browser A: log in as `driver.mysore@lifeline360.demo`.
2. Browser B: log in as `jss.hospital@lifeline360.demo`.
3. Optional browser C: `traffic.mysore@lifeline360.demo`.
4. On the ambulance dashboard keep **Road accident**, confirm the Mysore demo location, click **Start emergency**.
5. Review scored hospitals. JSS should rank highest for orthopedic coverage and beds.
6. Select **JSS Hospital Mysore**. The hospital desk receives a live notification.
7. Accept the request on the hospital dashboard.
8. On the ambulance dashboard click **Start simulation**. The marker moves along the route.
9. Traffic control shows sequential **EMERGENCY PRIORITY** — one signal at a time.
10. On arrival the hospital view shows **ARRIVED** and the operation is stored in history.

## PostgreSQL (optional)

If Docker is available:

```bash
docker compose up -d
```

Then in `backend/prisma/schema.prisma` set `provider = "postgresql"` and in `backend/.env`:

```
DATABASE_URL="postgresql://lifeline:lifeline@localhost:5432/lifeline360"
```

Run `npx prisma migrate dev --name init` and `npx tsx prisma/seed.ts`.

## Environment

See `.env.example` and `backend/.env.example`.

- `GREEN_CORRIDOR_APPROACH_METERS` (default 350)
- `GREEN_CORRIDOR_CLEAR_METERS` (default 40)

## Project layout

```
backend/     REST API, Socket.IO, Prisma, green-corridor simulation
frontend/    Landing page + two role dashboards
```
