# Doctor Twin Backend

Node.js + Express + TypeScript API with Prisma, Morgan, Winston, Joi validation, and layered architecture.

## Project structure

```
doctor-twin-backend/
├── prisma/
│   └── schema.prisma          # Database schema (doctor-twin table)
├── src/
│   ├── index.ts               # Entry point
│   ├── app.ts                 # Express app setup
│   ├── client.ts              # Prisma client singleton
│   ├── config/                # Environment config
│   ├── controllers/           # Request handlers
│   ├── docs/                  # API documentation
│   ├── middlewares/           # Express middleware
│   ├── public/                # Static assets
│   ├── routes/                # Route definitions
│   ├── services/              # Business logic & DB access
│   ├── tests/                 # Unit tests (src)
│   ├── utils/                 # Helpers (logger, errors)
│   └── validations/           # Joi schemas
└── tests/                     # Integration / e2e tests
```

## Quick start

```bash
npm install

# Start MySQL (Docker or your local instance)
npm run db:up          # optional — Docker
npm run db:push        # sync schema to DB

npm run dev
```

Server: `http://localhost:3000`

## Database

Prisma connects via `DATABASE_URL` in `.env`:

```
DATABASE_URL=postgresql://postgres:root@localhost:5432/dude
```

| Script                      | Description                         |
| --------------------------- | ----------------------------------- |
| `npm run db:migrate`        | Apply migrations (dev, interactive) |
| `npm run db:migrate:deploy` | Apply migrations (CI/production)    |
| `npm run db:push`           | Push schema without migration files |
| `npm run db:generate`       | Regenerate Prisma client            |
| `npm run db:up`             | Start MySQL via Docker              |

Migrations live in `prisma/migrations/` (initial: `20260520164500_init_dude_table`).

### `dude` table (users)

Managed by Prisma model `Dude` → table `dude`.

## APIs

### Create greeting

`POST /api/v1/examples/greeting`

```json
{ "name": "Dr. Smith", "message": "Welcome" }
```

### Users

| Method | Endpoint        |
| ------ | --------------- |
| `GET`  | `/api/v1/users` |
| `POST` | `/api/v1/users` |

```json
{ "name": "Jane Doe", "email": "jane@example.com", "password": "secret12" }
```

## Scripts

| Command               | Description               |
| --------------------- | ------------------------- |
| `npm run dev`         | Dev server (hot reload)   |
| `npm run build`       | Prisma generate + compile |
| `npm start`           | Run production build      |
| `npm run lint`        | TypeScript check          |
| `npm run lint:eslint` | ESLint                    |
| `npm run format`      | Prettier                  |

## Environment

| Variable       | Default       | Description                                  |
| -------------- | ------------- | -------------------------------------------- |
| `NODE_ENV`     | `development` | Environment                                  |
| `PORT`         | `3000`        | HTTP port                                    |
| `LOG_LEVEL`    | `info`        | Winston level                                |
| `DATABASE_URL` | —             | Set in `.env` (PostgreSQL connection string) |
