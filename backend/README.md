# Backend - API de Gestão de Projetos e Tarefas

API REST em **NestJS 12** + **TypeORM** + **PostgreSQL**. Visão geral do produto, como rodar com Docker, decisões e limitações: [README da raiz](../README.md). Decisões técnicas detalhadas: [`docs/partitura.md`](../docs/partitura.md). Contrato dos endpoints: [`docs/api/contrato-d011-d015.md`](../docs/api/contrato-d011-d015.md).

## Início rápido

Pré-requisitos: Node.js 24, npm 11 e um Postgres (o mais fácil é `docker compose up -d postgres` na raiz, que precisa do `.env` da raiz).

```bash
npm install
cp .env.example .env     # ajuste o JWT_SECRET (mínimo de 32 caracteres)
npm run build            # a CLI de migrations usa o dist/
npm run migration:run    # cria o schema
npm run seed             # opcional: dados de exemplo (senha Senha@123)
npm run start:dev        # API em http://localhost:3000/api, Swagger em /docs
```

## Scripts

Lista dos scripts de `package.json` mais usados (também existem `start`, `start:debug`, `test:debug` e `deploy`, do template do Nest).

| Script | Descrição |
| --- | --- |
| `npm run start:dev` | API em modo watch |
| `npm run start:debug` | API em modo watch com inspector |
| `npm run build` | Compila para `dist/` (`nest build`) |
| `npm run start:prod` | Roda o `dist/main` compilado |
| `npm run lint` | oxlint com checagem de tipos (`src/` e `test/`) |
| `npm run format` | Prettier em `src/` e `test/` |
| `npm run test` | Testes unitários (Vitest) |
| `npm run test:watch` | Testes unitários em modo watch |
| `npm run test:cov` | Testes unitários com cobertura |
| `npm run test:e2e` | Testes e2e (supertest + PostgreSQL real, banco `app_test`) |
| `npm run test:e2e:cov` | Testes e2e com cobertura (`coverage/e2e`) |
| `npm run migration:run` | Aplica as migrations pendentes |
| `npm run migration:show` | Lista as migrations e o estado de cada uma |
| `npm run migration:revert` | Desfaz a última migration |
| `npm run migration:generate -- src/database/migrations/Nome` | Gera uma migration a partir das entidades (compila antes) |
| `npm run seed` | Compila e roda o seed |
| `npm run seed:run` | Roda o seed sobre o `dist/` já compilado |

As migrations e o seed rodam sobre o código **compilado** (`dist/`), por isso é preciso `npm run build` antes em um clone novo (`migration:generate` e `seed` já compilam sozinhos). Motivo e detalhes em D-018.

## Estrutura de `src/`

```text
src/
├── main.ts                 # bootstrap: cria o app e escuta a porta
├── app.setup.ts            # config HTTP: helmet, CORS, ValidationPipe, filtro de exceções, Swagger
├── app.module.ts           # módulos e guards globais (rate limit, JWT)
├── common/                 # transversal: decorators, filtros, pipes, DTOs de paginação, mensagens PT-BR, utils
├── config/                 # env/ (validação do ambiente e aviso de JWT_SECRET fraco), database/ (TypeORM, SSL, CLI), throttle/ (rate limit)
├── database/
│   ├── migrations/         # uma migration por propósito (inclui a extensão unaccent das buscas)
│   └── seeds/seed.ts
├── modules/                # uma pasta por feature
│   ├── auth/  users/  projects/  tasks/  reports/  health/
│   │   # em cada módulo: controllers/ services/ repositories/ dto/ entities/
└── shared/types/           # tipos compartilhados
```

Fluxo de uma requisição: guards globais (rate limit e JWT) → `ValidationPipe` (sem conversão implícita de tipos, D-031) → controller (só delega) → service (regra de negócio e autorização por papel) → repository (queries) → banco. Qualquer exceção passa pelo `AllExceptionsFilter`, que devolve o formato de erro padrão com `requestId`.

## Variáveis de ambiente

Validadas no boot por `src/config/env/env.validation.ts`; a lista completa, com padrões, está na [seção 6 do README da raiz](../README.md#6-variáveis-de-ambiente) e em `.env.example`. Com um `JWT_SECRET` de exemplo ou previsível, a API sobe e registra um `WARN` no boot (`src/config/env/jwt-secret.check.ts`): gere um segredo com `openssl rand -hex 32`.

## Testes

- `npm run test`: unitários (`src/**/*.spec.ts` e `test/**/*.spec.ts`), sem banco, com repositórios mockados (Vitest + SWC, que emite os metadados de decorators de que a DI do Nest precisa).
- `npm run test:e2e`: `test/e2e/*.e2e-spec.ts`, a aplicação inteira com `supertest` contra um PostgreSQL real em banco separado. Crie o banco uma vez (`docker exec api-postgres psql -U app -d postgres -c "CREATE DATABASE app_test"`) ou defina `TEST_DATABASE_URL`; o nome do banco **precisa terminar em `_test`**. A cada execução o schema `public` desse banco é recriado e as migrations reais são aplicadas (inclusive a que habilita a extensão `unaccent`, que já vem na imagem `postgres:17-alpine`).
- `npm run test:cov` e `npm run test:e2e:cov`: cobertura (`coverage/` e `coverage/e2e/`).

Detalhes, o que é coberto e o CI: [seção 8 do README da raiz](../README.md#8-testes-e-ci) e decisão D-008 em [`docs/partitura.md`](../docs/partitura.md).
