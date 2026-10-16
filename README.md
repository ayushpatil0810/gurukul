# Production-Ready Hackathon Starter Foundation

A clean, secure, type-safe, and feature-agnostic starter codebase built for rapid hackathon feature development.

Designed with zero product assumptions: jump directly into implementing your business domain once decided, without restructuring foundational database, authentication, validation, or error-handling architecture.

---

## 🛠️ Technology Stack

| Layer | Technology | Details |
|---|---|---|
| **Framework** | Next.js 16 (App Router) + React 19 | Server Components, Server Actions, modern route handlers |
| **Language** | TypeScript | Strict mode, zero `any`, inferred Zod types |
| **Authentication** | Better Auth 1.7 | Email & password authentication, secure cookie sessions, Next.js cookie plugin |
| **Database** | Neon PostgreSQL | Serverless PostgreSQL via `@neondatabase/serverless` |
| **ORM** | Drizzle ORM + Drizzle Kit | Type-safe SQL schema definitions and automated migration generation |
| **Validation** | Zod v4 | Runtime environment validation, request schemas, formatted field errors |
| **Testing** | Vitest 5 | Fast unit and integration test runner with path alias support |
| **Styling** | Tailwind CSS v4 + Radix UI | Modern OKLCH color palettes, dark mode tokens, accessible primitives |

---

## 📁 Directory Structure & Conventions

```text
├── app/                      # Next.js App Router (pages, layouts, API routes)
│   ├── api/
│   │   ├── auth/[...all]/    # Better Auth route handler (GET, POST)
│   │   └── health/           # Healthcheck and database diagnostic endpoint
│   ├── login/                # Authentication page (Sign In / Sign Up tabs)
│   ├── protected/            # Protected route example demonstrating requireAuth()
│   ├── layout.tsx            # Root layout with Navbar and responsive shell
│   ├── page.tsx              # Starter landing page with system diagnostics
│   └── globals.css           # Tailwind v4 styles, OKLCH design tokens
├── components/               # Reusable UI components & feature-agnostic primitives
│   ├── ui/                   # Primitives: Button, Card, Input, Label, Badge
│   ├── auth/                 # Sign-in form, sign-up form, user button
│   └── navbar.tsx            # Sticky header with session state awareness
├── db/                       # Database client, schema registry, connection helpers
│   ├── index.ts              # Neon + Drizzle client and connection healthcheck
│   └── schema/
│       ├── auth.ts           # Better Auth schema (user, session, account, verification)
│       └── index.ts          # Central schema registry (export all domain tables here)
├── features/                 # Domain-specific modules for your hackathon idea
│   └── README.md             # Guidelines for organizing feature-specific code
├── lib/                      # Core configuration and feature-agnostic utilities
│   ├── auth.ts               # Server-side Better Auth instance and options
│   ├── auth-client.ts        # Client-side React auth hooks (signIn, signUp, useSession)
│   ├── auth-session.ts       # Server-side session helpers (getServerSession, requireAuth)
│   ├── env.ts                # Zod runtime environment variable validation
│   ├── errors.ts             # AppError, Result type, and sanitized API error formatter
│   ├── logger.ts             # Leveled structured logger with sensitive field redactor
│   ├── utils.ts              # Classname merging utility (cn)
│   └── validations/          # Reusable validation schemas and parsing helpers
├── tests/                    # Unit and integration test suite
│   ├── database.test.ts      # Database connection error handling
│   ├── env.test.ts           # Environment schema validation
│   ├── errors.test.ts        # AppError and Result monad behavior
│   ├── logger.test.ts        # Sensitive data redaction
│   └── validations.test.ts   # Zod request parsing and error formatting
├── drizzle/                  # Generated Drizzle SQL migrations
├── drizzle.config.ts         # Drizzle Kit configuration pointing to db/schema/
└── vitest.config.mts         # Vitest configuration with @/ alias mapping
```

---

## 🚀 Quickstart

### 1. Clone & Install Dependencies

This project supports **Bun** (recommended) or **npm**:

```bash
# Using Bun:
bun install

# Or using npm:
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set the required environment variables:
- `BETTER_AUTH_SECRET`: A 32+ character random string (generate with `openssl rand -base64 32`).
- `BETTER_AUTH_URL`: `http://localhost:3000` (for local development).
- `DATABASE_URL`: Your Neon PostgreSQL connection string.

---

## 🗄️ Database Setup (Neon PostgreSQL + Drizzle)

### Creating a Neon Database

1. Sign up or log into [Neon Console](https://console.neon.tech).
2. Create a new PostgreSQL project (e.g., `hackathon-app`).
3. Under **Connection Details**, select **Node.js** or **Drizzle** and copy the connection string.
4. Paste the connection string into your `.env` file as `DATABASE_URL`:
   ```env
   DATABASE_URL="postgresql://[user]:[password]@[neon-host]/[database]?sslmode=require"
   ```

### Managing Migrations with Drizzle Kit

- **Generate new migration files** from TypeScript schemas:
  ```bash
  bun run db:generate
  # or: npm run db:generate
  ```
- **Apply migrations to your Neon database**:
  ```bash
  bun run db:migrate
  # or: npm run db:migrate
  ```
- **Push schema directly in development** (skips SQL migration files, great for prototyping):
  ```bash
  bun run db:push
  # or: npm run db:push
  ```
- **Open Drizzle Studio** (visual database browser):
  ```bash
  bun run db:studio
  # or: npm run db:studio
  ```

---

## 🔐 Authentication (Better Auth)

### Server-Side Usage

To protect a Server Component or Server Action, use `requireAuth()` or `getServerSession()`:

```tsx
import { requireAuth, getServerSession } from "@/lib/auth-session";

// In a Server Component:
export default async function DashboardPage() {
  // Automatically redirects to /login if unauthenticated:
  const { session, user } = await requireAuth("/login");

  return <div>Welcome, {user.name}!</div>;
}

// Or check session optionally without redirect:
const session = await getServerSession();
if (session) {
  // User is logged in
}
```

### Client-Side Usage

To interact with authentication in Client Components:

```tsx
"use client";

import { useSession, signIn, signUp, signOut } from "@/lib/auth-client";

export function ProfileWidget() {
  const { data: session, isPending } = useSession();

  if (isPending) return <div>Loading...</div>;
  if (!session) return <div>Please sign in</div>;

  return (
    <div>
      <p>Signed in as {session.user.email}</p>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}
```

---

## 🛡️ Runtime Validation & Error Handling

### Validating Request Input

```ts
import { validateInput } from "@/lib/validations/validate";
import { z } from "zod";

const createItemSchema = z.object({
  title: z.string().min(1, "Title is required"),
  amount: z.number().positive(),
});

const result = validateInput(createItemSchema, incomingData);

if (!result.success) {
  // result.error is Record<string, string[]> (field -> error messages)
  console.log(result.error);
} else {
  // result.data is strictly typed
  console.log(result.data.title);
}
```

### Standardized Application Errors

```ts
import { AppError, ok, err, type Result } from "@/lib/errors";

// Create semantic errors:
throw AppError.notFound("Item not found");
throw AppError.badRequest("Invalid request parameters");
throw AppError.unauthorized("Authentication required");

// Or use functional Result types:
function performAction(): Result<Item, AppError> {
  if (failed) {
    return err(AppError.badRequest("Something failed"));
  }
  return ok(newItem);
}
```

---

## 🧩 Adding Hackathon Features

When your team decides on what to build:

1. **Add Database Tables:**
   - Create a schema file in `db/schema/<feature-name>.ts`.
   - Export it in `db/schema/index.ts`.
   - Run `bun run db:generate` to generate the migration SQL.

2. **Create Feature Code:**
   - Create a folder under `features/<feature-name>/`.
   - Colocate feature components, Server Actions, and Zod schemas inside that folder.

3. **Add Navigation & Routes:**
   - Add routes under `app/<feature-name>/page.tsx`.
   - Add links to `components/navbar.tsx` if needed.

---

## 📋 Available Scripts

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev` | Start Next.js development server on `localhost:3000` |
| `build` | `next build` | Build optimized production bundle |
| `start` | `next start` | Start production server |
| `lint` | `eslint` | Run ESLint across all files |
| `typecheck` | `tsc --noEmit` | Strict TypeScript type checking |
| `test` | `vitest run` | Run test suite once |
| `test:watch` | `vitest` | Run test suite in interactive watch mode |
| `db:generate` | `drizzle-kit generate` | Generate SQL migration files from Drizzle schema |
| `db:migrate` | `drizzle-kit migrate` | Apply pending SQL migrations to PostgreSQL |
| `db:push` | `drizzle-kit push` | Push schema directly to database (dev prototyping) |
| `db:studio` | `drizzle-kit studio` | Launch local visual database management UI |

---

## 🔒 Security Best Practices

- **Zero Secret Leakage:** Database credentials and `BETTER_AUTH_SECRET` are validated on the server and prevented from leaking into client JavaScript bundles.
- **Sanitized Logging:** `logger` automatically redacts sensitive keywords (`password`, `token`, `secret`, `authorization`, `creditCard`).
- **Error Obfuscation:** In production, `formatError()` hides raw database error messages and stack traces from end users.
- **Secure Cookies:** `useSecureCookies` is automatically enabled in production.
