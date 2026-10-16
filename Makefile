.PHONY: up down migrate seed test

up:
	docker compose up -d --wait

down:
	docker compose down

migrate:
	bun run db:migrate

seed: up migrate
	bun run db:seed

test: up migrate
	bun run test
	bun run typecheck
	bun run lint
