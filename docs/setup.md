# Guia de desenvolvimento local

Guia detalhado para quem vai **mexer no código**. Para conhecer o projeto, rodar tudo com Docker, ver as variáveis de ambiente e as decisões técnicas, comece pelo [README da raiz](../README.md): ele é a fonte de verdade para esses assuntos e este guia não os repete.

Monorepo com duas aplicações:

- `backend/`: API REST em **NestJS 12** (Node.js + TypeScript), arquitetura em camadas.
- `frontend/`: SPA em **React 19 + TypeScript**, criada com **Vite**.

---

## 1. Pré-requisitos

| Ferramenta | Versão usada |
| --- | --- |
| Node.js | 24.x |
| npm | 11.x |
| Docker (com Compose v2) | 29.x (obrigatório para a entrega; no desenvolvimento serve para o Postgres) |
| Git | 2.5x |

## 2. Subir o ambiente local

Todos os comandos a partir da raiz do repositório, salvo indicação.

### 2.1 Banco de dados

O compose lê o `.env` da raiz. Crie-o a partir do exemplo e suba só o Postgres:

```bash
cp .env.example .env
docker compose up -d postgres
```

Cria o container `api-postgres` na porta `5432` com o banco `app_db` (usuário e senha `app`/`app`).

### 2.2 Backend

```bash
cd backend
npm install
cp .env.example .env     # ajuste o JWT_SECRET (mínimo de 32 caracteres)
npm run build            # compila para dist/ (a CLI de migrations usa o dist)
npm run migration:run    # cria o schema (ver 3)
npm run seed             # opcional: dados de exemplo (ver 4)
npm run start:dev        # modo watch
```

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/docs`
- Health check: `http://localhost:3000/api/health`

### 2.3 Frontend

```bash
cd frontend
npm install
npm run dev
```

App em `http://localhost:5173`. O dev server do Vite faz proxy de `/api` para `http://localhost:3000` (`frontend/vite.config.ts`), então não há CORS no desenvolvimento.

## 3. Migrations (D-002, D-018)

O schema é gerenciado **exclusivamente por migrations**, e a API **não** roda migrations no boot. No desenvolvimento elas são um passo manual (no Docker, o serviço `migrate` faz isso, D-026). O `synchronize` fica desligado em todos os ambientes (`DATABASE_SYNCHRONIZE=false`).

Os comandos rodam na pasta `backend`:

| Comando | O que faz |
| --- | --- |
| `npm run migration:run` | Aplica as migrations pendentes, em ordem de timestamp. |
| `npm run migration:show` | Lista as migrations e marca as já aplicadas. |
| `npm run migration:revert` | Desfaz a última migration aplicada (repita para desfazer mais). |
| `npm run migration:generate -- src/database/migrations/NomeDaMudanca` | Compara as entidades com o banco e gera uma nova migration. Compila antes (`build`). |

`migration:run`, `migration:revert` e `migration:show` usam o código compilado em `dist/` (`dist/config/database/data-source.js`), sem `tsx` nem `ts-node`. Por isso **precisam de `npm run build` antes** em um clone novo.

**Fluxo ao mudar uma entidade:**

1. Altere a entidade em `src/**/entities/*.entity.ts`.
2. Rode `npm run migration:generate -- src/database/migrations/NomeDaMudanca`.
3. Revise o SQL gerado no arquivo criado.
4. Rode `npm run migration:run`.

Se o `migration:generate` disser `No changes in database schema were found`, as entidades e o banco já estão iguais. Convenções: uma migration por propósito, `down` que desfaz exatamente o `up`, constraints com nome (`PK_*`, `UQ_*`, `FK_*`, `IDX_*`) e enums nativos (D-016, D-017).

## 4. Seed

O seed **não cria tabelas**: rode-o depois das migrations.

```bash
cd backend
npm run seed          # compila e roda (equivale a build + seed:run)
npm run seed:run      # só roda o dist já compilado
```

Cria 4 usuários (`ana.souza@empresa.com`, `bruno.lima@empresa.com`, `carla.dias@empresa.com`, `diego.rocha@empresa.com`, todos com a senha `Senha@123`), 2 projetos com membros e papéis e 7 tarefas. É **idempotente**: rodar de novo apenas completa o que falta. A tabela de quem é o quê em cada projeto está no [README](../README.md#credenciais-do-seed).

O seed recusa rodar com `NODE_ENV=production` a menos que `SEED_ALLOW_PROD=true` (as contas têm senha conhecida). No desenvolvimento local (`NODE_ENV=development`, o padrão do `backend/.env.example`) não é preciso nada; no container do compose use `docker compose exec -e SEED_ALLOW_PROD=true backend npm run seed:run`.

## 5. Testes

Todos os comandos em `backend/`:

```bash
npm run test           # unitários: sem banco, com mocks
npm run test:cov       # unitários com cobertura
npm run test:e2e       # e2e: supertest contra PostgreSQL real (banco app_test)
npm run test:e2e:cov   # e2e com cobertura
```

Para o e2e, suba o Postgres do compose e crie o banco de testes uma vez:

```bash
docker compose up -d postgres
docker exec api-postgres psql -U app -d postgres -c "CREATE DATABASE app_test"
```

- A URL padrão é `postgres://app:app@localhost:5432/app_test`; `TEST_DATABASE_URL` aponta outro banco. O nome **precisa terminar em `_test`**: o setup recusa qualquer outro, para nunca tocar o `app_db`.
- A cada execução o setup **apaga e recria o schema `public` do banco de testes** e aplica as migrations reais; não guarde nada nesse banco.
- Duas execuções e2e simultâneas no mesmo banco se serializam sozinhas (advisory lock).
- Os e2e usam o próprio ambiente (definido em `test/setup/e2e-setup.ts`), não o `backend/.env`.
- As buscas usam a extensão `unaccent` do Postgres (migration `1792681800006-EnableUnaccentExtension`). Ela faz parte do contrib e já vem nas imagens oficiais; num Postgres instalado à mão sem o contrib, a migration falha com `extension "unaccent" is not available`.
- Erro `Teste abortado: o banco "..." nao termina em "_test"`: confira `TEST_DATABASE_URL`.

O CI (`.github/workflows/ci.yml`) roda lint, tipos, build, unitários e e2e do backend (com um Postgres como service container), lint, typecheck, testes e build do frontend e o build das imagens Docker.

No frontend (`frontend/`):

```bash
npm run lint        # oxlint (aviso também falha)
npm run typecheck   # tsc nos dois tsconfigs
npm run test        # Vitest (lógica pura, ambiente node; specs em src/**/*.spec.ts)
npm run build       # typecheck + bundle de produção (sem source maps)
``` Mais detalhes na [seção 8 do README](../README.md#8-testes-e-ci).

## 6. Scripts

**Backend** (`backend/package.json`):

| Comando | Descrição |
| --- | --- |
| `npm run start:dev` | Sobe a API em modo watch |
| `npm run build` | Compila a API para `backend/dist` |
| `npm run lint` | oxlint (com checagem de tipos) |
| `npm run test` | Testes unitários (Vitest) |
| `npm run test:e2e` | Testes e2e (Vitest + supertest, PostgreSQL real) |
| `npm run test:cov` / `test:e2e:cov` | Cobertura (ver 5) |
| `npm run migration:run` / `migration:revert` / `migration:show` / `migration:generate` | Migrations (ver 3) |
| `npm run seed` / `seed:run` | Seed (ver 4) |

**Frontend** (`frontend/package.json`):

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Vite dev server (porta 5173) |
| `npm run build` | `typecheck` + bundle de produção |
| `npm run typecheck` | `tsc --noEmit` nos dois tsconfigs |
| `npm run lint` | oxlint com `--deny-warnings` (`.oxlintrc.json`) |
| `npm run test` / `test:watch` | Testes unitários (Vitest, ambiente node) |
| `npm run preview` | Serve o build de produção localmente |

## 7. Problemas comuns no desenvolvimento

| Sintoma | Causa provável | Como resolver |
| --- | --- | --- |
| `Cannot find module .../dist/config/database/data-source.js` ao rodar `migration:run` ou `seed:run` | Falta compilar | `npm run build` antes. |
| API responde 500 com `relation "users" does not exist` | Migrations não aplicadas | `npm run migration:run`. |
| `Configuração de ambiente inválida` ao subir a API | Variável ausente ou inválida (por exemplo, `JWT_SECRET` com menos de 32 caracteres) | Ajuste o `backend/.env`; veja a [tabela de variáveis](../README.md#6-variáveis-de-ambiente). |
| A interface não alcança a API | Backend fora do ar ou em outra porta | Suba o backend na 3000 ou ajuste o `target` do proxy em `frontend/vite.config.ts`. |
| `port is already allocated` ao subir o Postgres | Outro Postgres usa a 5432 | Mude `POSTGRES_PORT` no `.env` da raiz e a porta em `DATABASE_URL` do `backend/.env`. |
