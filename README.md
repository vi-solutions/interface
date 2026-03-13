# Interface Environmental — Project & Operations Hub

Monorepo for Interface Environmental's internal project management platform.

## Structure

```
├── packages/
│   └── shared/          # Shared TypeScript contracts & interfaces
├── apps/
│   ├── web/             # Next.js 15 frontend (Tailwind CSS 4)
│   └── api/             # NestJS backend (raw pg, no ORM)
```

## Prerequisites

- **Node.js** ≥ 20
- **PostgreSQL** ≥ 15 running locally

## Getting Started

1. **Install dependencies**

   ```sh
   npm install
   ```

2. **Configure environment** — copy `.env.example` to `.env` and adjust as needed:

   ```sh
   cp .env.example .env
   ```

3. **Create the database**

   ```sh
   createdb interface_env
   ```

4. **Run migrations**

   ```sh
   npm run db:migrate
   ```

5. **Seed demo data** (optional)

   ```sh
   npm run db:seed
   ```

6. **Start development servers**

   ```sh
   npm run dev
   ```

   - Web: http://localhost:3000
   - API: http://localhost:3001

## Scripts

| Command              | Description                          |
| -------------------- | ------------------------------------ |
| `npm run dev`        | Start both web and API in watch mode |
| `npm run dev:web`    | Start only the Next.js dev server    |
| `npm run dev:api`    | Start only the NestJS dev server     |
| `npm run build`      | Build shared → API → web             |
| `npm run db:migrate` | Run database migrations              |
| `npm run db:seed`    | Seed demo data                       |

## Tech Stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS 4
- **Backend:** NestJS 11, raw PostgreSQL via `pg`
- **Shared:** TypeScript interfaces for API contracts
- **Database:** PostgreSQL (no ORM — plain SQL queries with parameterized inputs)

## Core Features (in progress)

- Project dashboards
- Time tracking
- Document management
- Client management
- QuickBooks integration
- Deliverable tracking
