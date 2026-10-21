# Guia de Setup e Execucao

> Este projeto **ja esta** scaffolded (backend NestJS + frontend React/Vite).
> O documento serve como referencia de execucao local e via Docker.

Monorepo com duas aplicacoes:

- `backend/` - API REST em **NestJS 12** (Node.js + TypeScript), arquitetura em camadas.
- `frontend/` - SPA em **React 19 + TypeScript**, criada com **Vite**.

---

## 1. Pre-requisitos

| Ferramenta | Versao usada |
| --- | --- |
| Node.js | 24.x |
| npm | 11.x |
| Docker | 29.x (obrigatorio para a entrega do desafio) |
| Git | 2.5x |

---

## 2. Execucao local

### 2.1 Banco de dados

O Postgres sobe via Docker Compose:

```bash
docker compose up -d postgres
```

Cria o container `api-postgres` na porta `5432` com o banco `app_db`
(usuario/senha: `app`/`app`).

### 2.2 Backend

```bash
cd backend
npm install
cp .env.example .env   # ajuste os segredos JWT
npm run start:dev
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

- App: `http://localhost:5173`

O dev server do Vite faz proxy de `/api` para `http://localhost:3000`
(veja `frontend/vite.config.ts`), de modo que nao ha CORS no desenvolvimento.

### 2.4 Scripts

| Comando | Descricao |
| --- | --- |
| `npm run start:dev` | Sobe a API em modo watch |
| `npm run build` | Compila a API para `backend/dist` |
| `npm run lint` | oxlint (backend) |
| `npm run test` | vitest (backend) |
| `npm run test:e2e` | vitest e2e (backend) |
| `npm run dev` | Vite dev server (frontend) |
| `npm run build` | typecheck + bundle de producao (frontend) |
| `npm run typecheck` | `tsc --noEmit` (frontend) |

---

## 3. Execucao via Docker

```bash
# na raiz do repositorio
cp .env.example .env   # defina JWT_SECRET e JWT_REFRESH_SECRET
docker compose up --build
```

Servicos resultantes:

| Servico | URL |
| --- | --- |
| Frontend (nginx) | http://localhost:8080 |
| API | http://localhost:3000/api |
| Swagger | http://localhost:3000/docs |
| Postgres | localhost:5432 |

O container do frontend serve o bundle estatico pelo nginx e faz proxy de
`/api` para a API - a mesma regra de rotas do browser vale nos dois ambientes.

---

## 4. FASE 1 - sem migrations (D-002)

Enquanto as migrations nao existirem, o schema do Postgres e criado a partir
das entidades pelo TypeORM (`DATABASE_SYNCHRONIZE=true`).

**FASE 2:** quando o modelo estabilizar, o schema passa a ser gerenciado por
migrations geradas pela CLI do TypeORM e `DATABASE_SYNCHRONIZE` deve ser
desligado em todos os ambientes.
