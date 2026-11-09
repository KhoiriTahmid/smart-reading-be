# AGENTS.md

NestJS 11 + Sequelize/PostgreSQL REST API for a smart reading device. TypeScript, yarn 1.x (`yarn.lock` — use yarn, not npm). Auth is not implemented yet.

## Commands

- Install: `yarn install`
- Dev (watch): `yarn start:dev` · Build: `yarn build` · Prod: `yarn start:prod` (`node dist/main`)
- Lint (auto-fixes): `yarn lint` · Format: `yarn format`
- Unit tests: `yarn test`; single file `yarn test users.service`; single case `yarn test -t "name"`
- E2E: `yarn test:e2e`
- Prettier is enforced through ESLint (`singleQuote`, `trailingComma: all`).

## Environment

- The Nest runtime does **not** load dotenv. Only `resources/sql/models/config.js` calls `dotenv.config({ path: process.env.ENV_PATH })`. `src/main.ts` and `src/app.module.ts` read `process.env` directly, so export the vars in the shell (or add a dotenv preload) — setting `ENV_PATH` alone does nothing for the app.
- `.env.local` is gitignored and local-only. Keys: `PORT, DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME, BCRYPT_SALT_ROUNDS, SWAGGER_DOCS_PATH`.
- Known variable mismatch: `app.module.ts` maps `username: DB_PASS` and `password: DB_PASSWORD`, but the env files define `DB_USER`/`DB_PASS` (no `DB_PASSWORD`).
- `yarn start:local` / `start:local-linux` are broken (stray `base` project name and an `apps/base` path that does not exist). Use `yarn start:dev`.
- Swagger is served at `/<SWAGGER_DOCS_PATH or "docs">`; title/version come from `app.json`.

## Database (Sequelize)

- `sequelize-cli` is configured by `.sequelizerc` → `resources/sql/{models/config.js, models, migrations, seeders}`.
- `synchronize: false` — schema changes go through migrations, never model sync.
- Migrations/seeders use snake_case columns; entities map them with `@Table({ underscored: true })`.
- Existing migration scripts are Windows-only. On Linux run:
  - `ENV_PATH=.env.local npx sequelize-cli db:migrate --env development`
  - `ENV_PATH=.env.local npx sequelize-cli db:seed:all --env development`
- Seeds: roles `Super Admin`/`User` (fixed UUIDs) and users `admin@gmail.com` / `user@gmail.com`, password `password`.
- `reading_histories`, `device_activity_logs`, `change_logs` tables exist in migrations but have no Nest module/entity yet.

## Architecture

- `src/modules/<name>/` per feature (`users`, `devices`, `roles`): `*.contract.ts` (class-validator + Swagger DTOs), `*.entity.ts` (sequelize-typescript model), `*.service.ts`, `*.controller.ts`, `*.module.ts`.
- `src/modules/common/`: `BaseModel` (timestamps + paranoid `deletedAt`) / `BaseModelWithMetaUser`, plus shared DTOs `BaseFindAllRequest` / `BaseUserInfoRequest`.
- `src/helpers/parse.ts` holds `generatePaginationResponse`; services import it as `src/helpers/parse` (tsconfig `baseUrl: "./"`, no `paths` mapping).
- Register new entities in **both** `SequelizeModule.forRoot({ models: [...] })` (`app.module.ts`) and the owning module's `SequelizeModule.forFeature([...])`.
- List endpoints return `{ limit, offset, count, results }`; `active`/`archive` filtering relies on the paranoid `deletedAt` column.

## Known-broken (don't get stuck)

- `yarn test` currently fails: `src/app.controller.spec.ts` imports a non-existent `./app.service`, and the generated `*.service.spec.ts` instantiate services without Sequelize model providers.
- No global `ValidationPipe` in `main.ts`, so `class-validator` DTO decorators are not enforced at runtime yet.
- No auth guard/strategy exists, so `req.user` is undefined and POST/PATCH handlers (`req.user.userId`) throw at runtime.
- `app.controller` returns `'success'` but `test/app.e2e-spec.ts` expects `'Hello World!'`.
