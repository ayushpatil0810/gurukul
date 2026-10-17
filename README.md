#  Gurukul — Adaptive Learning & Assessment Portal

An adaptive coding education platform that personalises the learning path for each student using Bayesian Knowledge Tracing, evaluates process integrity through replayable session timelines, and runs untrusted code in isolated Docker sandboxes.

## Core Ideas

- **Concept-map routing** — the syllabus is a prerequisite graph; the system always targets the weakest ready concept.
- **Process over product** — every coding session is an append-only event log that feeds replay, integrity signals, and mastery updates.
- **Evidence, not verdicts** — integrity signals are presented for human review; the platform never auto-flags a student.

## Modules

| Module | Role | Purpose |
|---|---|---|
| **Learn** | Student | Concept docs, interactive slides, and mastery quizzes per enrolled course |
| **Practice Lab** | Student | LeetCode-style ungraded coding challenges grouped by module |
| **Online Assessment** | Student | Proctored, graded coding exams with keystroke telemetry |
| **Dashboard** | Student | Course progress, concept map, and mastery overview |
| **Lesson Studio** | Trainer | Author and publish interactive lessons with AI-assisted generation |
| **Question Bank** | Trainer | Create coding questions with visible/hidden test cases |
| **Session Replay** | Trainer | Replay any student's coding session keystroke-by-keystroke |
| **Integrity Review** | Trainer | Review flagged sessions with paste/autocomplete/timing signals |

## Tech Stack

- **Framework** — Next.js 16 (Turbopack)
- **Language** — TypeScript, React 19
- **Database** — PostgreSQL 16 via Drizzle ORM
- **Auth** — Better Auth (email/password, sessions)
- **Code Editor** — Monaco Editor (VS Code engine)
- **Sandbox** — Docker containers with seccomp, resource limits, and per-language images
- **Queue** — Redis + BullMQ for sandboxed code execution
- **Telemetry** — WebSocket server for real-time classroom events
- **Styling** — Tailwind CSS 4, shadcn/ui components

## Prerequisites

- Node.js ≥ 20 (or Bun)
- Docker & Docker Compose
- PostgreSQL client (optional, for manual inspection)

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/imayushsawant/gurukul.git
cd gurukul
npm install

# 2. Start Postgres + Redis
docker compose up -d --wait

# 3. Configure environment
cp .env.example .env        # defaults work for local dev

# 4. Run migrations and seed demo data
npx drizzle-kit migrate
npm run db:seed              # creates demo institute, users, concepts, and questions

# 5. Start the dev server
npm run dev                  # http://localhost:3000
```

### Demo Accounts

| Email | Role | Password |
|---|---|---|
| `ada@techsummit.example` | Student | `PortalDemo!2026` |
| `trainer@techsummit.example` | Trainer | `PortalDemo!2026` |
| `admin@techsummit.example` | Admin | `PortalDemo!2026` |

## Project Structure

```
app/            Next.js routes and API handlers
components/     React components (practice, learn, portal, assessment, ui)
lib/            Services, engine logic (BKT, selector, integrity), auth, validations
db/             Drizzle schema and database connection
sandbox/        Docker sandbox runner, seccomp profile, grading
seed/           Demo data catalog and seeding script
tests/          Unit and integration tests (Vitest)
worker/         Background job processing (BullMQ)
server/         WebSocket telemetry server
```

## Scripts

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run test         # Run test suite
npm run typecheck    # TypeScript type check
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed demo data
npm run db:studio    # Open Drizzle Studio
```

## License

Private — built for TechSummitTrainers hackathon.
