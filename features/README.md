# Features Directory

This directory is designated for domain-specific modules once you decide on your hackathon product idea.

## Recommended Feature Module Structure

When implementing a new feature (e.g., `projects`, `tasks`, `analytics`), colocate its concerns in a dedicated subfolder:

```text
features/
└── <feature-name>/
    ├── components/       # Feature-specific UI components
    │   ├── list-view.tsx
    │   └── item-card.tsx
    ├── actions/          # Next.js Server Actions for this domain
    │   └── mutations.ts
    ├── schemas/          # Domain-specific Zod schemas
    │   └── item-schema.ts
    ├── hooks/            # Domain-specific React hooks (if needed)
    └── index.ts          # Public exports for other parts of the application
```

## Conventions
1. **Colocation:** Keep components, actions, and validation schemas close to the feature they belong to.
2. **Reusability:** If a component or utility is used across 2+ distinct domains, move it up to `components/` or `lib/`.
3. **Database Schema:** Keep Drizzle table definitions in `db/schema/<feature>.ts` and re-export them in `db/schema/index.ts`.
