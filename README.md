# API de Gestão de Projetos e Tarefas

Solução do **Desafio Técnico Sênior Fullstack da InnovaConnect** ([enunciado](https://github.com/InnovaConnect/desafio-desenvolvimento/blob/main/senior.md)): uma API REST em NestJS com uma SPA em React para organizar o trabalho de várias pessoas em projetos e tarefas, com papéis por projeto, importação e exportação em CSV e relatórios.

## Sumário

1. [O que a aplicação faz](#1-o-que-a-aplicação-faz)
2. [Funcionalidades](#2-funcionalidades)
3. [Tecnologias](#3-tecnologias)
4. [Como rodar com Docker](#4-como-rodar-com-docker)
5. [Como rodar localmente (desenvolvimento)](#5-como-rodar-localmente-desenvolvimento)
6. [Variáveis de ambiente](#6-variáveis-de-ambiente)
7. [Migrations e seed](#7-migrations-e-seed)
8. [Testes e CI](#8-testes-e-ci)
9. [Documentação da API](#9-documentação-da-api)
10. [Arquitetura e decisões técnicas](#10-arquitetura-e-decisões-técnicas)
11. [Modelo de dados](#11-modelo-de-dados)
12. [Autorização por papel de projeto](#12-autorização-por-papel-de-projeto)
13. [Segurança e observabilidade](#13-segurança-e-observabilidade)
14. [Como o projeto pode evoluir](#14-como-o-projeto-pode-evoluir)
15. [Pontos de melhoria e limitações conhecidas](#15-pontos-de-melhoria-e-limitações-conhecidas)
16. [Estrutura de pastas](#16-estrutura-de-pastas)
17. [Convenções e como contribuir](#17-convenções-e-como-contribuir)

---

## 1. O que a aplicação faz

Equipes que dividem o trabalho em projetos precisam saber **quem faz o quê, em que estado está e quem pode mexer**. Esta aplicação resolve isso com:

- uma **API REST** (`backend/`) que cadastra usuários, autentica com JWT, organiza projetos e tarefas, controla o acesso por papel dentro de cada projeto e gera relatórios;
- uma **interface web** (`frontend/`) que consome essa API: listas paginadas, quadro Kanban com arrastar e soltar, importação e exportação de CSV e relatórios.

Tudo sobe com Docker (banco, API e interface) e o schema do banco é versionado por migrations.

## 2. Funcionalidades

Organizadas pelos requisitos do desafio.

| Requisito | O que existe |
| --- | --- |
| **Usuários e autenticação** | Cadastro (`POST /api/auth/register`) e login (`POST /api/auth/login`). Senha com bcrypt, token JWT de curta duração (1 h por padrão), sem sessão no servidor. |
| **Níveis de acesso** | Papéis **por projeto**: `owner`, `admin`, `member` e `viewer` (não existe perfil global). Quem cria o projeto vira `owner`. Veja a [matriz](#12-autorização-por-papel-de-projeto). |
| **Usuário em vários projetos** | Relação N:N (`project_members`) com um papel por vínculo. A mesma pessoa pode ser `owner` de um projeto e `viewer` de outro. |
| **Projetos** | CRUD completo, listagem paginada só com os projetos em que a pessoa é membro, busca por nome/descrição (sem diferenciar maiúsculas nem acentos) e ordenação. |
| **Tarefas** | CRUD dentro de um projeto, com status (`pendente`, `em_andamento`, `concluida`), responsável (que precisa ser membro do projeto) e data limite. Filtros por status, responsável, texto (sem diferenciar maiúsculas nem acentos: `descricao` acha `Descrição`) e intervalo de datas; ordenação por título, status, data limite, criação ou atualização. |
| **Exportação e importação** | `GET /api/projects/:projectId/tasks/export` devolve todas as tarefas em CSV (UTF-8 com BOM, para o Excel; em ordem cronológica). `POST /api/projects/:projectId/tasks/import` cria tarefas em massa a partir de um CSV: linhas válidas são importadas e as inválidas voltam em `errors[]` com o número da linha; arquivo que não é CSV ou sem a coluna `titulo` é recusado com o motivo. Exportar e importar de volta preserva a ordem das tarefas. |
| **Relatórios** | `GET /api/reports?groupBy=status\|user&projectId=` agrega tarefas por status ou por responsável, de um projeto ou de todos os projetos da pessoa. |
| **Paginação e filtros** | Todas as listagens usam o envelope `{ data, meta }` (página padrão 1, 15 itens por página, máximo 100; na busca de usuários, 10) com ordenação determinística. |
| **Interface** | SPA com login/cadastro, projetos, detalhe do projeto, membros e papéis, lista de tarefas e **quadro Kanban** (arrastar uma tarefa muda o status) com o mesmo detalhe/edição da tarefa, relatórios, diálogo de confirmação nas exclusões, toasts e estados de carregamento, vazio e erro. |

## 3. Tecnologias

Versões reais instaladas (lidas dos `package.json`, dos `node_modules` e dos Dockerfiles).

| Camada | Tecnologia |
| --- | --- |
| Runtime | Node.js 24 (imagens `node:24-alpine`) |
| Backend | NestJS 12 · TypeScript 6 · TypeORM 1.1 · PostgreSQL 17 · Passport JWT · bcrypt · class-validator / class-transformer · Swagger (`@nestjs/swagger`) · helmet · `@nestjs/throttler` · csv-parse / csv-stringify |
| Frontend | React 19 · TypeScript 7 · Vite 8 · Tailwind CSS 4 · React Router 7 · Zustand 5 · axios |
| Testes | Vitest 4 (backend com SWC, frontend em ambiente node) · supertest · `@nestjs/testing` |
| Qualidade | oxlint nos dois projetos (avisos falham no frontend) · `tsc` estrito nos dois projetos |
| Entrega | Docker (multi-stage, usuário não-root) · Docker Compose · nginx 1.29 (serve o SPA e faz proxy da API) |

## 4. Como rodar com Docker

### Pré-requisitos

- Docker com o plugin Compose v2 (`docker compose`).
- As portas **8080** (interface), **3000** (API) e **5432** (Postgres) livres. Dá para trocá-las no `.env` (`FRONTEND_PORT`, `BACKEND_PORT`, `POSTGRES_PORT`).

### Passo a passo

```bash
# 1. Clone o repositório e entre na raiz
git clone <url-do-repositorio>
cd teste-inspire

# 2. Crie o .env a partir do exemplo (o JWT_SECRET de exemplo já tem 32+ caracteres,
#    mas é público: a API sobe e registra um aviso no log; fora de uma avaliação
#    local, gere um segredo próprio com `openssl rand -hex 32`)
cp .env.example .env

# 3. Suba tudo: build das imagens, banco, migrations, API e interface
docker compose up -d --build

# 4. (Opcional) Popule com dados de exemplo
docker compose exec -e SEED_ALLOW_PROD=true backend npm run seed:run
```

O serviço `migrate` do compose é um passo de uso único: ele roda `npm run migration:run` na mesma imagem da API, espera o Postgres ficar saudável e termina; a API só sobe depois que ele conclui com sucesso, e a interface só sobe depois que a API está saudável (D-018, D-026). Não é preciso rodar migration à mão. Depois da subida, `docker compose ps -a` mostra o container `api-migrate` como `Exited (0)`: isso é o esperado.

O `-e SEED_ALLOW_PROD=true` do passo 4 é necessário porque o container da API roda com `NODE_ENV=production` e o seed (que cria contas com senha conhecida) recusa rodar em produção sem essa liberação explícita.

| O quê | Endereço |
| --- | --- |
| Interface (nginx) | http://localhost:8080 |
| API | http://localhost:3000/api |
| Swagger (documentação interativa) | http://localhost:3000/docs |
| Health check | http://localhost:3000/api/health |
| PostgreSQL | `localhost:5432` (usuário/senha/banco padrão: `app`/`app`/`app_db`) |

### Credenciais do seed

Depois do passo 4, entre em http://localhost:8080 com qualquer usuário abaixo (senha `Senha@123` para todos). O seed cria 4 usuários, 2 projetos (com membros e papéis) e 7 tarefas, e é idempotente: pode rodar de novo sem duplicar nada.

| Usuário | E-mail | Papéis nos projetos do seed |
| --- | --- | --- |
| Ana Souza | `ana.souza@empresa.com` | `owner` de *Portal do Cliente*, `viewer` de *Integração com ERP* |
| Bruno Lima | `bruno.lima@empresa.com` | `admin` de *Portal do Cliente*, `owner` de *Integração com ERP* |
| Carla Dias | `carla.dias@empresa.com` | `member` nos dois projetos |
| Diego Rocha | `diego.rocha@empresa.com` | `viewer` de *Portal do Cliente* |

Dica: entre com a Ana e com a Diego para ver a diferença entre `owner` e `viewer` na mesma tela.

### Comandos úteis

```bash
docker compose ps                    # estado e saúde dos serviços
docker compose logs -f backend       # logs da API (cada linha de erro traz o requestId)
docker compose logs migrate          # saída das migrations
docker compose down                  # para os containers (mantém os dados)
docker compose down -v               # para e APAGA o volume do banco (reset total)
docker compose up -d --build         # reconstrói depois de mudar o código
```

Para zerar o banco e recomeçar: `docker compose down -v && docker compose up -d --build` (e o seed, se quiser os dados de exemplo).

### Problemas comuns

| Sintoma | Causa provável | Como resolver |
| --- | --- | --- |
| `defina JWT_SECRET no arquivo .env da raiz (veja .env.example)` ao subir | O `.env` não existe na raiz (ou está sem `JWT_SECRET`) | `cp .env.example .env`. |
| A API reinicia em loop e o log mostra `Configuração de ambiente inválida: ... JWT_SECRET ... no mínimo 32 caracteres` | `JWT_SECRET` curto | Use um segredo com 32 caracteres ou mais (por exemplo, `openssl rand -hex 32`) e rode `docker compose up -d`. |
| O log da API mostra `WARN [Seguranca] JWT_SECRET parece ser o valor de exemplo do .env.example ou um segredo fraco` | O `.env` usa o segredo público do exemplo (ou um previsível) | Para avaliação local, pode seguir. Em qualquer outro ambiente, gere um segredo (`openssl rand -hex 32`), troque no `.env` e rode `docker compose up -d`. |
| A interface abre uma versão antiga depois de um rebuild | HTML antigo em cache (antes do `Cache-Control: no-cache`) | Recarregue a página sem cache (Ctrl+F5) uma vez. |
| `port is already allocated` / `address already in use` | Outra aplicação usa 8080, 3000 ou 5432 | Mude `FRONTEND_PORT`, `BACKEND_PORT` ou `POSTGRES_PORT` no `.env` e suba de novo. Se mudar `BACKEND_PORT`, o Swagger passa a ficar nessa porta. |
| `docker compose up` termina com `service "migrate" didn't complete successfully` e a API/interface não sobem | A migration falhou (por exemplo, banco inacessível ou erro de SQL) | `docker compose logs migrate` mostra o erro. Corrija e rode `docker compose up -d` de novo (o `migrate` roda outra vez; se precisar, `docker compose run --rm migrate`). |
| Muitos erros **429** (`Muitas requisições...`) | Rate limit por IP (login 10/min, cadastro 5/min, geral 100/min) | Aguarde o tempo do header `Retry-After`; para testes de carga, defina `THROTTLE_DISABLED=true` no `.env` e rode `docker compose up -d`. |
| Login com o usuário do seed devolve `Credenciais inválidas.` | O seed não rodou, ou o banco foi recriado | Rode o seed (passo 4). |
| Mudei o código e nada mudou | A imagem antiga continua em uso | `docker compose up -d --build`. |

## 5. Como rodar localmente (desenvolvimento)

Pré-requisitos: Node.js 24 e npm 11 (versões com que o projeto foi desenvolvido) e Docker apenas para o Postgres.

```bash
# 1. Postgres do compose (precisa do .env da raiz, veja o passo 2 da seção 4)
cp .env.example .env
docker compose up -d postgres

# 2. Backend (porta 3000)
cd backend
npm install
cp .env.example .env            # ajuste o JWT_SECRET (mínimo de 32 caracteres)
npm run build                   # a CLI de migrations usa o dist/
npm run migration:run           # no desenvolvimento, as migrations são um passo manual
npm run seed                    # opcional: dados de exemplo
npm run start:dev               # modo watch

# 3. Frontend, em outro terminal (porta 5173)
cd frontend
npm install
npm run dev
```

- Interface: http://localhost:5173. O Vite faz proxy de `/api` para `http://localhost:3000` (`frontend/vite.config.ts`), então não há CORS no desenvolvimento.
- API: http://localhost:3000/api · Swagger: http://localhost:3000/docs.
- O `backend/.env.example` já aponta `DATABASE_URL` para `localhost:5432` e `CORS_ORIGINS` para `http://localhost:5173`.

## 6. Variáveis de ambiente

A API valida todas as variáveis no boot (`backend/src/config/env/env.validation.ts`) e **não sobe** com configuração inválida. O compose lê o `.env` da raiz; rodando fora do Docker, a API lê `backend/.env`.

Há dois arquivos de exemplo: [`.env.example`](.env.example) (raiz, lido pelo `docker-compose.yml`) e [`backend/.env.example`](backend/.env.example) (execução local do backend). Variáveis do backend:

| Variável | Obrigatória | Padrão | Descrição |
| --- | --- | --- | --- |
| `NODE_ENV` | não | `development` | `development`, `test` ou `production`. No compose, a API roda com `production`. |
| `PORT` | não | `3000` | Porta da API. |
| `API_PREFIX` | não | `api` | Prefixo global das rotas. |
| `DATABASE_URL` | **sim** | – | URL de conexão do Postgres (`postgres://usuario:senha@host:5432/banco`). |
| `DATABASE_SSL` | não | `false` | SSL da conexão com o banco, independente do `NODE_ENV`: `false`, `require` (cifra sem validar o certificado) ou `verify-full` (cifra e valida). O Postgres do compose não oferece SSL. |
| `DATABASE_SYNCHRONIZE` | não | `false` | Mantenha `false`: o schema vem das migrations. |
| `DATABASE_LOGGING` | não | `false` | Loga as queries SQL. |
| `JWT_SECRET` | **sim** | – | Segredo de assinatura do JWT, mínimo de 32 caracteres. Se for o valor do `.env.example` ou parecer fraco, a API sobe, mas registra um `WARN` no boot (D-031). |
| `JWT_EXPIRES_IN` | não | `1h` | Validade do token: número de segundos ou duração com unidade (`15m`, `1h`, `7d`). Valor fora desse formato impede a API de subir. |
| `CORS_ORIGINS` | não | `http://localhost:5173` | Origens permitidas, separadas por vírgula. No compose o padrão é `http://localhost:8080`. |
| `SWAGGER_ENABLED` | não | `true` | Publica o Swagger em `/docs`. |
| `TRUST_PROXY` | não | `false` | Proxies confiáveis à frente da API: `false`, `true` ou número de saltos. No compose o padrão é `1` (nginx na frente), para o rate limit enxergar o IP real. |
| `THROTTLE_TTL_SECONDS` | não | `60` | Janela do rate limit, em segundos. |
| `THROTTLE_LIMIT` | não | `100` | Requisições por IP por janela, em todas as rotas (exceto `GET /health`). |
| `THROTTLE_AUTH_LOGIN_LIMIT` | não | `10` | Tentativas de `POST /auth/login` por IP por janela. |
| `THROTTLE_AUTH_REGISTER_LIMIT` | não | `5` | Cadastros (`POST /auth/register`) por IP por janela. |
| `THROTTLE_DISABLED` | não | `false` | `true` desliga o rate limit (usado nos testes automatizados). |
| `SEED_ALLOW_PROD` | não | `false` | Lida só pelo seed (não faz parte da validação do boot): com `NODE_ENV=production`, o seed só roda com `true`. |

Variáveis que só o `docker-compose.yml` usa (arquivo `.env` da raiz): `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `BACKEND_PORT` e `FRONTEND_PORT`. O compose obriga a definir `JWT_SECRET` e fixa `PORT=3000`, `API_PREFIX=api` e `DATABASE_SYNCHRONIZE=false` para a API. O `SEED_ALLOW_PROD` não é repassado pelo compose: use `docker compose exec -e SEED_ALLOW_PROD=true ...`.

## 7. Migrations e seed

O schema do banco é gerenciado **exclusivamente por migrations do TypeORM** (`backend/src/database/migrations`, 7 arquivos, uma por propósito; a mais recente, `1792681800006-EnableUnaccentExtension`, habilita a extensão `unaccent` usada nas buscas, D-029). O `synchronize` fica desligado em todos os ambientes.

Os comandos rodam em `backend/` e usam o código compilado em `dist/` (assim funcionam também dentro do container de produção, que só tem `dist` e `node_modules`):

| Comando | O que faz |
| --- | --- |
| `npm run migration:run` | Aplica as migrations pendentes, em ordem de timestamp. |
| `npm run migration:show` | Lista as migrations e marca as já aplicadas. |
| `npm run migration:revert` | Desfaz a última migration aplicada. |
| `npm run migration:generate -- src/database/migrations/NomeDaMudanca` | Compara as entidades com o banco e gera uma migration (compila antes). |
| `npm run seed` | Compila e popula o banco com dados de exemplo. |
| `npm run seed:run` | Popula usando o `dist/` já compilado (é o comando usado no container). |

**Por que a migration é manual no desenvolvimento e automática no Docker?** A API **nunca** altera o schema ao subir (`migrationsRun` não é usado): com várias réplicas, todas tentariam migrar ao mesmo tempo, e o momento em que o banco muda ficaria escondido. No desenvolvimento, quem muda a entidade gera, revisa e aplica a migration de propósito. No Docker, o serviço `migrate` (uma execução única, antes da API) transforma isso em um comando só, sem tirar a migration do boot da API (D-018, D-026).

Fluxo ao mudar uma entidade: altere `src/**/entities/*.entity.ts` → `npm run migration:generate -- src/database/migrations/NomeDaMudanca` → revise o SQL → `npm run migration:run`. Se o `generate` responder `No changes in database schema were found`, entidades e banco estão iguais.

O seed (`backend/src/database/seeds/seed.ts`) não cria tabelas: rode-o depois das migrations. Como cria contas com senha conhecida (`Senha@123`), ele **recusa rodar com `NODE_ENV=production`** a menos que `SEED_ALLOW_PROD=true`; por isso o comando do Docker leva `-e SEED_ALLOW_PROD=true`. Em desenvolvimento local (`NODE_ENV=development`) não precisa de nada.

## 8. Testes e CI

O backend tem **786 testes** (439 unitários e 347 e2e) e o frontend **95 testes unitários**, na data desta revisão.

| Comando (em `backend/`) | O que roda |
| --- | --- |
| `npm run test` | Unitários (`src/**/*.spec.ts` e `test/**/*.spec.ts`): Vitest + SWC, **sem banco**, repositórios mockados. |
| `npm run test:cov` | Unitários com cobertura (relatório em `backend/coverage`; cerca de 78% das instruções). |
| `npm run test:e2e` | E2E (`test/e2e/*.e2e-spec.ts`): a aplicação inteira com `supertest` contra um **PostgreSQL real**, em banco separado. |
| `npm run test:e2e:cov` | E2E com cobertura (`backend/coverage/e2e`; cerca de 95% das instruções). Migrations e seed ficam fora da conta. |

**Como preparar o e2e.** O banco de testes é separado do de desenvolvimento e o nome **precisa terminar em `_test`** (o setup recusa qualquer outro, para nunca tocar o `app_db`). Com o Postgres do compose no ar:

```bash
docker compose up -d postgres
docker exec api-postgres psql -U app -d postgres -c "CREATE DATABASE app_test"   # uma vez
cd backend && npm run test:e2e
```

Por padrão a URL é `postgres://app:app@localhost:5432/app_test`; use `TEST_DATABASE_URL` para apontar outro banco (também terminado em `_test`). A cada execução o setup **recria o schema `public` do banco de testes** e aplica as migrations reais a partir de `src` (por isso o banco é descartável). Duas execuções simultâneas no mesmo banco se serializam por um *advisory lock* do Postgres. Os e2e definem o próprio ambiente (segredo JWT, Swagger e rate limit desligados), sem ler o `backend/.env`; o rate limit é ligado só no teste dedicado do 429.

O que os e2e cobrem: cadastro e login (com os limites de tamanho), 401 sem token, IDOR entre projetos (404 igual para projeto alheio e inexistente), matriz de papéis, regras de membros, busca de usuários restrita, busca sem acento, tipos sem conversão implícita, paginação e ordenação estável, CSV (exportar com BOM e em ordem cronológica, importar, cabeçalho e arquivo inválidos, status flexível, erros por linha, fórmulas, 5000 linhas, ciclo exportar -> importar preservando a ordem), relatórios, erros padronizados, rate limit e o Swagger. Os unitários cobrem services, DTOs, filtro de exceções, validação de ambiente, aviso do `JWT_SECRET`, paginação, escape de `LIKE` e o seed.

**Frontend** (em `frontend/`): `npm run lint` (oxlint, aviso também falha), `npm run typecheck`, `npm run test` (Vitest, lógica pura: matriz de papéis, mensagens de erro, JWT, formatação, destino depois do login, título da aba, diálogo de confirmação, sessão e o quadro) e `npm run build`. Não há testes de componente nem E2E de navegador (seção 15).

**CI** (`.github/workflows/ci.yml`, em push e pull request para `main`):

- **backend:** Postgres 17 como *service container* (banco `app_test`), `npm ci`, `npm run lint`, `tsc --noEmit`, `npm run build`, `npm run test:cov` (com o relatório publicado como artefato) e `npm run test:e2e`;
- **frontend:** `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test` e `npm run build`;
- **docker:** valida o compose (`docker compose --env-file .env.example config`) e constrói as duas imagens, sem publicar.

A estratégia está nas decisões [D-008](docs/partitura.md#d-008---estratégia-de-testes) e [D-034](docs/partitura.md#d-034---lint-e-testes-do-frontend).

## 9. Documentação da API

- **Swagger/OpenAPI:** http://localhost:3000/docs (JSON em `/docs-json`). Clique em *Authorize* e cole o `access_token` do login.
- **Contrato completo** (paginação, ordenação, erros, CSV, papéis): [`docs/api/contrato-d011-d015.md`](docs/api/contrato-d011-d015.md).

### Login

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana.souza@empresa.com","password":"Senha@123"}'
```

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "…", "name": "Ana Souza", "email": "ana.souza@empresa.com", "active": true, "createdAt": "…", "updatedAt": "…" }
}
```

### Listagem paginada (envelope `{ data, meta }`)

```bash
TOKEN="<access_token do login>"
curl -s "http://localhost:3000/api/projects?page=1&limit=15&search=portal" \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "data": [
    { "id": "…", "name": "Portal do Cliente", "description": "…", "createdAt": "…", "updatedAt": "…", "role": "owner" }
  ],
  "meta": { "page": 1, "limit": 15, "total": 1, "totalPages": 1 }
}
```

`page` (≥ 1, padrão 1) e `limit` (1 a 100, padrão 15) valem para todas as listagens; valores fora da faixa respondem 400. `totalPages` é 0 quando não há registros.

### Formato de erro

Todo erro tem o mesmo formato. `error` é um código estável em maiúsculas (nunca traduzido), `message` está sempre em português e `requestId` permite achar a requisição nos logs (também vem no header `x-request-id`):

```json
{
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": ["O campo \"Limite\" deve ser menor ou igual a 100."],
  "path": "/api/projects?limit=101",
  "timestamp": "2026-10-22T12:00:00.000Z",
  "requestId": "3f2b8c1e-…"
}
```

Em erros de validação `message` é uma lista; nos demais é um texto (por exemplo, `"Credenciais inválidas."` com status 401). Stack trace e detalhes internos nunca vão ao cliente.

### Principais rotas

| Recurso | Rotas |
| --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login` |
| Saúde | `GET /health` |
| Usuários | `GET /users` (busca paginada, até 10 por página, para quem é `owner` ou `admin` de algum projeto: usada para adicionar membros) |
| Projetos | `POST /projects`, `GET /projects`, `GET/PATCH/DELETE /projects/:projectId` |
| Membros | `GET/POST /projects/:projectId/members`, `PATCH/DELETE /projects/:projectId/members/:userId` |
| Tarefas | `GET/POST /projects/:projectId/tasks`, `GET/PATCH/DELETE /projects/:projectId/tasks/:taskId` |
| CSV | `GET /projects/:projectId/tasks/export`, `POST /projects/:projectId/tasks/import` |
| Relatórios | `GET /reports?groupBy=status\|user&projectId=` |

Todas as rotas, exceto `auth/*` e `health`, exigem `Authorization: Bearer <access_token>`.

## 10. Arquitetura e decisões técnicas

### Por que um monolito modular em camadas, feature-first

O escopo (um domínio de projetos e tarefas, uma equipe pequena, entrega única) não justifica a complexidade operacional de microsserviços. Um **monolito modular** entrega velocidade e clareza de responsabilidades. Organizar por **feature** (e não por tipo de arquivo) mantém tudo de um assunto no mesmo lugar, e as camadas internas (controller → service → repository) deixam cada regra no seu lugar. Se um módulo precisar virar serviço próprio, a fronteira já existe. Arquitetura hexagonal/Clean foi avaliada e descartada por ser rigor demais para o tamanho do domínio (D-001).

### Visão geral

```mermaid
flowchart LR
    U["Navegador"] -->|"HTTP :8080"| N["nginx: SPA React"]
    N -->|"proxy /api e /docs"| A["API NestJS :3000"]
    A -->|"TypeORM"| D[("PostgreSQL 17")]
    M["migrate: roda uma vez"] -.->|"aplica migrations"| D
```

### Módulos do backend

```mermaid
flowchart TD
    App["AppModule"] --> Health["HealthModule"]
    App --> Auth["AuthModule"]
    App --> Users["UsersModule"]
    App --> Projects["ProjectsModule: projetos, membros, acesso"]
    App --> Tasks["TasksModule: tarefas, CSV"]
    App --> Reports["ReportsModule"]
    Auth --> Users
    Projects --> Users
    Tasks --> Projects
    Tasks --> Users
    Reports --> Projects
    Reports --> Tasks
```

### Camadas e fluxo de uma requisição

```mermaid
sequenceDiagram
    participant C as Cliente
    participant G as Guards globais
    participant P as ValidationPipe
    participant K as Controller
    participant S as Service
    participant R as Repository
    participant B as PostgreSQL
    C->>G: HTTP com Bearer token, rate limit e JWT
    G->>P: usuário autenticado
    P->>K: DTO validado e limpo
    K->>S: delega, sem regra de negócio
    S->>S: checa o papel no projeto
    S->>R: consulta ou grava
    R->>B: SQL parametrizado
    B-->>R: linhas
    R-->>S: entidades
    S-->>K: DTO de resposta
    K-->>C: JSON
    Note over C,K: qualquer exceção cai no AllExceptionsFilter e vira o formato de erro padrão
```

1. O `RequestIdMiddleware` atribui um `requestId` a toda requisição.
2. Dois guards globais, nesta ordem: o rate limit (`AppThrottlerGuard`, 429 com `Retry-After`) e o `JwtAuthGuard`, que valida o token (rotas sem `@Public()`).
3. O `ValidationPipe` global aplica `whitelist` + `forbidNonWhitelisted`: campo desconhecido é 400, e os textos são limpos (trim).
4. O **controller** só delega: recebe o DTO e chama o service.
5. O **service** concentra a regra de negócio, inclusive a autorização por papel (`ProjectAccessService.requireRole`).
6. O **repository** concentra as queries (QueryBuilder parametrizado, ordenação só por campos de uma lista permitida).
7. O `AllExceptionsFilter` padroniza qualquer erro (mensagem em português, `requestId`, sem stack trace).

### Decisões técnicas

Resumo das decisões. O texto completo de cada uma (contexto, decisão, justificativa e alternativas descartadas) está em [`docs/partitura.md`](docs/partitura.md).

| Decisão | Resumo e justificativa |
| --- | --- |
| [D-001](docs/partitura.md#d-001---arquitetura-monolito-modular-em-camadas) Arquitetura | Monolito modular feature-first: velocidade e clareza sem custo de microsserviços. |
| [D-002](docs/partitura.md#d-002---banco-de-dados-postgresql-com-migrations) Banco | PostgreSQL com migrations: integridade referencial real e schema versionado. |
| [D-003](docs/partitura.md#d-003---frontend-react--typescript-com-vite) Frontend | React + TypeScript + Vite: SPA simples, build estático servido por nginx. |
| [D-004](docs/partitura.md#d-004---entrega-com-docker) Docker | Um Dockerfile por app e um compose na raiz: requisito do desafio e subida em um comando. |
| [D-005](docs/partitura.md#d-005---autenticação) Autenticação | JWT stateless de 1 h, bcrypt, sem refresh token; acesso por papel de projeto. |
| [D-006](docs/partitura.md#d-006---orm-typeorm) ORM | TypeORM: integração oficial com o Nest e CLI de migrations. |
| [D-007](docs/partitura.md#d-007---gerenciador-de-estado-no-frontend) Estado | Zustand só para a sessão; dados de servidor em hooks próprios, sem biblioteca de cache. |
| [D-008](docs/partitura.md#d-008---estratégia-de-testes) Testes | Unitários com mocks e e2e contra PostgreSQL real em banco separado. |
| [D-009](docs/partitura.md#d-009---estilização-do-frontend) Estilo | Tailwind v4 com tokens em CSS. |
| [D-010](docs/partitura.md#d-010---servidor-de-desenvolvimento-do-frontend) Dev server | Vite na 5173 com proxy de `/api`: sem CORS no desenvolvimento. |
| [D-011](docs/partitura.md#d-011---tarefas-por-projeto) Tarefas por projeto | Toda tarefa pertence a um projeto e só é acessada no contexto dele (evita IDOR). |
| [D-012](docs/partitura.md#d-012---status-das-tarefas) Status | `pendente`, `em_andamento`, `concluida`: fluxo mínimo que cabe num Kanban. |
| [D-013](docs/partitura.md#d-013---membros-de-projeto) Membros | Papéis por projeto; o criador vira `owner`. |
| [D-014](docs/partitura.md#d-014---exportaçãoimportação) CSV | CSV: formato universal, simples de gerar e de revisar. |
| [D-015](docs/partitura.md#d-015---relatórios) Relatórios | Endpoint agregado com `groupBy=status\|user` e filtro por projeto. |
| [D-016](docs/partitura.md#d-016---enums-nativos-do-postgres) Enums nativos | O banco rejeita valores fora da lista, independente de quem escreve. |
| [D-017](docs/partitura.md#d-017---índices-escolhidos) Índices | Três índices, só onde há consulta real; um composto elimina o Sort. |
| [D-018](docs/partitura.md#d-018---migrations-por-passo-manual-e-cli-sobre-o-dist) Migrations | Nunca no boot da API; CLI sobre o `dist/` para rodar no container. |
| [D-019](docs/partitura.md#d-019---busca-de-tarefas-no-servidor-só-ao-apertar-enter) Busca | Busca de tarefas no servidor, só ao apertar Enter: evita uma requisição por tecla. |
| [D-020](docs/partitura.md#d-020---ordenação-padrão-e-desempate) Ordenação | `createdAt desc` com desempate por `id`; importação grava `created_at` crescente. |
| [D-021](docs/partitura.md#d-021---paginação-em-envelope-data-meta) Paginação | Envelope `{data, meta}`, página 1, limite 15, máximo 100. |
| [D-022](docs/partitura.md#d-022---erros-padronizados-em-pt-br) Erros | Mensagens em PT-BR, códigos estáveis em maiúsculas e `requestId`. |
| [D-023](docs/partitura.md#d-023---design-system-do-frontend) Design system | Tokens em `global.css`, regras em `frontend/DESIGN.md`. |
| [D-024](docs/partitura.md#d-024---papéis-e-matriz-de-autorização) Papéis | Matriz de autorização única, aplicada nos services. |
| [D-025](docs/partitura.md#d-025---rate-limit-e-endurecimento-de-segurança) Segurança | Rate limit, SSL desacoplado, Swagger configurável, guarda no seed. |
| [D-026](docs/partitura.md#d-026---serviço-migrate-one-shot-no-compose) Migrate | Serviço one-shot no compose: subida em um comando sem migrar no boot da API. |
| [D-027](docs/partitura.md#d-027---quem-não-é-membro-recebe-404) Não-membro = 404 | Projeto alheio responde igual a um inexistente: ids válidos não vazam. |
| [D-028](docs/partitura.md#d-028---busca-de-usuários-restrita-a-quem-gerencia-membros) Busca de usuários | Só para quem gerencia membros, até 10 por página: menos enumeração de e-mails. |
| [D-029](docs/partitura.md#d-029---busca-sem-diferenciar-acentos-unaccent) Busca sem acento | `unaccent` do Postgres em todas as buscas, com o escape de curingas mantido. |
| [D-030](docs/partitura.md#d-030---csv-com-bom-validação-do-arquivo-e-status-flexível) CSV | BOM para o Excel, exportação cronológica, arquivo e cabeçalho validados, status flexível. |
| [D-031](docs/partitura.md#d-031---entrada-sem-conversão-implícita-limites-da-conta-e-aviso-de-jwt_secret) Entrada | Sem conversão implícita de tipos, limites da conta, aviso de `JWT_SECRET` fraco. |
| [D-032](docs/partitura.md#d-032---cabeçalhos-de-segurança-e-cache-no-nginx-sem-source-maps) nginx | CSP e cabeçalhos de segurança no SPA, HTML sem cache, sem source maps. |
| [D-033](docs/partitura.md#d-033---robustez-da-interface-estado-do-projeto-confirmação-e-quadro-com-teto) Interface | Estado do projeto, detalhe único da tarefa, diálogo de confirmação, quadro com teto, sessão. |
| [D-034](docs/partitura.md#d-034---lint-e-testes-do-frontend) Frontend | oxlint e Vitest no frontend e no CI. |

## 11. Modelo de dados

```mermaid
erDiagram
    USERS ||--o{ PROJECT_MEMBERS : "participa"
    PROJECTS ||--o{ PROJECT_MEMBERS : "tem"
    PROJECTS ||--o{ TASKS : "contém"
    USERS |o--o{ TASKS : "é responsável"

    USERS {
        uuid id PK
        varchar email UK
        varchar password
        varchar name
        boolean active
    }
    PROJECTS {
        uuid id PK
        varchar name
        text description
    }
    PROJECT_MEMBERS {
        uuid id PK
        uuid project_id FK
        uuid user_id FK
        project_role role
    }
    TASKS {
        uuid id PK
        uuid project_id FK
        varchar title
        text description
        task_status status
        uuid assignee_id FK
        date due_date
    }
```

- **Enums nativos do Postgres:** `task_status` (`pendente`, `em_andamento`, `concluida`) e `project_role` (`owner`, `admin`, `member`, `viewer`). O banco rejeita valores fora da lista mesmo se alguém escrever direto nele (D-016).
- **Constraints nomeadas:** `PK_*`, `UQ_*`, `FK_*` e `IDX_*`, para migrations legíveis e previsíveis.
- **Integridade:** `UQ_users_email`; `UQ_project_members_project_user` (uma pessoa tem um único papel por projeto); apagar um projeto remove membros e tarefas (`ON DELETE CASCADE`); apagar um usuário apaga seus vínculos e deixa as tarefas sem responsável (`SET NULL`).
- **Índices (D-017):**
  - `IDX_tasks_project_id_created_at_id` em `tasks (project_id, created_at, id)`: atende o filtro por projeto e a ordenação padrão da listagem sem Sort em memória (medido com 5.000 tarefas).
  - `IDX_tasks_assignee_id`: relatório por usuário e filtro por responsável.
  - `IDX_project_members_user_id`: listar os projetos de uma pessoa.
  - Não há índice só em `project_members (project_id)`: a unique `(project_id, user_id)` já cobre essa busca.
- **Extensões:** `uuid-ossp` (ids) e `unaccent` (buscas sem diferenciar acentos, D-029).

## 12. Autorização por papel de projeto

Não existe perfil global de administrador: o acesso é decidido **dentro de cada projeto**, pelo papel do vínculo (`owner` > `admin` > `member` > `viewer`). Toda operação de tarefa ou membro passa por `ProjectAccessService.requireRole`, e as buscas sempre filtram por `projectId` + `id`, o que impede acessar uma tarefa de um projeto alheio (IDOR). Quem **não é membro** recebe **404 `Projeto não encontrado.`**, a mesma resposta de um projeto inexistente, em todas as rotas do projeto (inclusive CSV e `GET /reports?projectId=`): um id válido de projeto alheio não se distingue de um inventado (D-027). Quem é membro sem o papel necessário recebe **403** (`Seu papel no projeto não permite esta ação.`).

| Ação | owner | admin | member | viewer | não-membro |
| --- | :---: | :---: | :---: | :---: | :---: |
| Ver projeto, tarefas, membros e relatório; exportar CSV | sim | sim | sim | sim | 404 |
| Criar, editar e excluir tarefas; importar CSV | sim | sim | sim | 403 | 404 |
| Editar o projeto (nome e descrição) | sim | sim | 403 | 403 | 404 |
| Adicionar membro com papel `member` ou `viewer` | sim | sim | 403 | 403 | 404 |
| Adicionar membro com papel `admin` | sim | 403 | 403 | 403 | 404 |
| Alterar o papel de um `member` ou `viewer` | sim | sim | 403 | 403 | 404 |
| Alterar o papel de um `admin` ou atribuir `admin` | sim | 403 | 403 | 403 | 404 |
| Remover um `member` ou `viewer` | sim | sim | 403 | 403 | 404 |
| Remover um `admin` | sim | 403 | 403 | 403 | 404 |
| Excluir o projeto | sim | 403 | 403 | 403 | 404 |
| Buscar usuários (`GET /users`) | sim | sim | 403\* | 403\* | 403\* |

\* A busca de usuários não é por projeto: vale "é `owner` ou `admin` de **pelo menos um** projeto" (D-028).

Regras adicionais (`project-members.service.ts`):

- O papel `owner` **só nasce na criação do projeto**: atribuí-lo (POST ou PATCH) responde 400. Não existe transferência de propriedade.
- O `owner` não pode ter o papel alterado nem ser removido (403), e ninguém altera o próprio papel nem se remove do projeto (400).
- Um `admin` que tenta agir sobre outro `admin` ou sobre o `owner`, ou atribuir `admin`, recebe 403.
- Remover um membro **desatribui as tarefas dele** no projeto, na mesma transação.
- `GET /users` (usado para achar quem adicionar) só responde a quem é `owner` ou `admin` de pelo menos um projeto (403 `Você não tem permissão para buscar usuários.` para os demais), exige `email` ou `name` com **3 ou mais caracteres** e devolve no máximo **10 por página**, só `id`, `name` e `email`: o diretório de usuários não pode ser varrido (D-028).

## 13. Segurança e observabilidade

**O que existe:**

- Senhas com **bcrypt** (custo 10); a resposta da API nunca devolve o hash. O login compara a senha mesmo quando o e-mail não existe (hash falso), para não revelar por tempo de resposta quais e-mails estão cadastrados.
- **JWT** com segredo de pelo menos 32 caracteres (validado no boot) e validade curta; a estratégia confere a cada requisição se o usuário ainda existe e está ativo.
- **Guard JWT global** (`APP_GUARD`): toda rota exige token, exceto as marcadas com `@Public()` (`auth/register`, `auth/login` e `health`). Um controller novo já nasce protegido.
- **Rate limit por IP** (`@nestjs/throttler`): 100 requisições por minuto em todas as rotas (exceto `GET /health`), 10 por minuto em `POST /auth/login` e 5 por minuto em `POST /auth/register`. Acima disso, a API responde **429** com o header `Retry-After`. Valores configuráveis por variável de ambiente (`THROTTLE_*`).
- **Validação de entrada rigorosa:** `whitelist` + `forbidNonWhitelisted` em todos os DTOs, **sem conversão implícita de tipos** (`{"title": 123}` é 400, não vira "123"), limites de tamanho (nome 120, e-mail 254, senha 6 a 72 também no login, antes do bcrypt), UUID validado nos parâmetros de rota, datas `AAAA-MM-DD` válidas, `sortBy` restrito a uma lista de campos antes de chegar ao SQL.
- **SQL parametrizado** (QueryBuilder/TypeORM) e curingas do `LIKE` escapados: `%`, `_` e `\` digitados na busca são tratados como texto.
- **Autorização por projeto** em todas as operações de tarefa e membro, sem IDOR, com regras estritas de papéis; projeto alheio responde 404 como um inexistente (seção 12).
- **Diretório de usuários protegido:** `GET /users` só para quem gerencia membros em algum projeto, com 3 ou mais caracteres no e-mail ou no nome e no máximo 10 por página.
- **CSV seguro:** a exportação neutraliza fórmulas (valores iniciados por `=`, `+`, `-`, `@`, tab ou CR ganham um apóstrofo na frente) e a importação desfaz o apóstrofo, então exportar e importar de volta preserva o texto. A importação aceita no máximo 5000 linhas e 5 MB e grava em lotes de 500 dentro de uma transação.
- **helmet** (cabeçalhos de segurança da API e do Swagger) e **CORS** restrito às origens configuradas, sem `credentials` (a autenticação é por header `Authorization`, não por cookie).
- **nginx do frontend** (D-032): o HTML e os assets do SPA saem com `Content-Security-Policy` sem `unsafe-inline` (`default-src 'self'`, `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` e `Cross-Origin-Opener-Policy`; `/api/` e `/docs` ficam só com os cabeçalhos do helmet (sem duplicar). O `index.html` vai com `Cache-Control: no-cache`, o build não publica source maps (`/assets/*.map` dá 404) e o nginx não anuncia a versão.
- **`JWT_SECRET` fraco é avisado:** com o valor do `.env.example` (ou um segredo previsível) a API registra um `WARN` no boot pedindo um segredo próprio (`openssl rand -hex 32`).
- **Banco:** `DATABASE_SSL` (`false`, `require`, `verify-full`) separado do `NODE_ENV`; violações de unicidade e de chave estrangeira em corrida viram 409 em vez de 500; criação de projeto (projeto + `owner`) e remoção de membro (+ desatribuição de tarefas) acontecem em transação.
- **Swagger** pode ser desligado com `SWAGGER_ENABLED=false`; o **seed** recusa rodar em produção sem `SEED_ALLOW_PROD=true`.
- **Containers sem root** (usuário `app` na imagem da API) e `.env` fora do git.
- **Mensagens de erro sem vazamento:** stack e detalhes internos só vão para o log.

**O que NÃO está coberto** (veja também a [seção 15](#15-pontos-de-melhoria-e-limitações-conhecidas)): refresh token e revogação de token (um token válido continua válido até expirar), HTTPS (o compose serve HTTP; em produção use um proxy reverso com TLS), 2FA, bloqueio de conta por tentativas, auditoria de ações e varredura de vírus em uploads. O rate limit é **em memória**, por instância: com várias réplicas da API cada uma conta separado (para escalar, use um armazenamento compartilhado como Redis). No compose, `TRUST_PROXY=1` faz a API confiar no `X-Forwarded-For`; isso vale também para quem acessa a porta 3000 direto, que poderia forjar o IP: **em produção, não publique a porta 3000**, deixe só o nginx exposto.

**Observabilidade:** cada requisição recebe um `requestId`: o `x-request-id` do cliente, se tiver até 64 caracteres entre letras, dígitos, `_` e `-` (por exemplo, um UUID), ou um UUID novo. Ele é devolvido no header de resposta e no corpo dos erros. Os erros são logados pelo `AllExceptionsFilter` (aviso para 4xx, erro com stack para 5xx), então um `requestId` informado por quem viu o problema leva direto à linha do log. Não há métricas nem tracing distribuído.

## 14. Como o projeto pode evoluir

- **Extrair módulos:** `tasks` e `reports` são os candidatos naturais a serviço próprio. Os módulos já se falam por serviços (`ProjectAccessService`, `TasksService`), o que facilita o corte.
- **Refresh token** com rotação e revogação, caso a sessão precise durar mais que 1 hora sem novo login.
- **Rate limit compartilhado** (Redis) para escalar a API em várias réplicas, e **cache** para relatórios pesados.
- **Kanban paginado por coluna** (ou endpoint `GET /tasks/board` com N itens por coluna e a contagem real de cada status), em vez de carregar até 5.000 tarefas.
- **Tipos gerados do OpenAPI** (`openapi-typescript` a partir de `/docs-json`) para eliminar a cópia manual dos DTOs no frontend.
- **Fila de jobs** (BullMQ ou similar) para importações grandes: a API devolve um `jobId` e a interface acompanha o progresso.
- **Transferência de propriedade** do projeto, em transação, e regra para nunca deixar um projeto sem `owner`.
- **Notificações** (e-mail ou em tempo real) para atribuição e mudança de status.
- **Observabilidade:** logs estruturados em JSON, métricas (Prometheus) e tracing (OpenTelemetry) reaproveitando o `requestId`.
- **Testes de componente** (Testing Library com jsdom) e **E2E de navegador** (Playwright) no CI, somando-se aos testes de lógica pura do frontend.

## 15. Pontos de melhoria e limitações conhecidas

Lista honesta do que ficou fora ou pode melhorar.

**Backend**

- **Sem transferência de propriedade:** o `owner` nasce com o projeto e não pode ser trocado nem removido.
- **Sem refresh token:** quando o token expira (1 h), a pessoa precisa entrar de novo; também não há revogação de token.
- **Rate limit em memória:** não é compartilhado entre instâncias (para escalar, usar Redis). Com `TRUST_PROXY=1` (padrão do compose), a porta 3000 não deve ser publicada em produção.
- **Importação de CSV síncrona:** limitada a 5 MB e 5000 linhas; arquivos maiores pedem uma fila.
- **Busca com `unaccent` sem índice:** `unaccent(coluna) ILIKE '%termo%'` não usa índice btree (assim como o `ILIKE` anterior); com muito volume, um índice trigram resolveria (D-029).
- **Limite da senha em caracteres, não em bytes:** o bcrypt considera 72 **bytes**; uma senha de até 72 caracteres com muitas letras acentuadas pode passar disso e ter o final ignorado (D-031).
- **Importação só em UTF-8:** um CSV salvo em Latin-1/Windows-1252 é lido com os acentos errados.
- **Migrations e seed fora da cobertura** de testes medida; são exercitados indiretamente (o e2e aplica as migrations reais).
- **Sem métricas nem tracing**, só logs com `requestId`.

**Frontend**

- **O Kanban carrega até 5.000 tarefas em série** (50 páginas de 100): acima disso mostra as mais recentes e pede filtros; a contagem de cada coluna é a das tarefas carregadas. Um endpoint de quadro por coluna resolveria.
- **Testes do frontend só de lógica pura** (Vitest em node): sem testes de componente nem E2E de navegador; as telas foram verificadas manualmente no navegador.
- **Tipos copiados à mão dos DTOs** da API (o ideal é gerá-los do OpenAPI).
- **Bundle único** (sem code-splitting por rota).
- **O filtro de prazo** (`dueFrom`/`dueTo`) existe na API, mas não na tela.
- **A lista de projetos reserva a altura de 15 linhas** mesmo com poucos projetos: é proposital ("listagem com tamanho padrão", pedido do usuário), para a paginação não pular.
- **Acessibilidade e performance** foram revisadas por leitura de código e build, sem teste com leitor de tela nem medição (Lighthouse).

**Operação**

- O compose é para desenvolvimento e avaliação: HTTP puro, banco no mesmo host e senha padrão `app`. Para produção, são necessários TLS, segredos fora do `.env`, backup do banco e `DATABASE_SSL`.

## 16. Estrutura de pastas

```text
.
├── backend/                       # API NestJS
│   ├── src/
│   │   ├── main.ts                # bootstrap: cria o app e escuta a porta
│   │   ├── app.setup.ts           # configuração HTTP: helmet, CORS, pipes, filtro, Swagger (compartilhada com os e2e)
│   │   ├── app.module.ts          # módulos e guards globais (rate limit e JWT)
│   │   ├── common/                # transversal: constants, decorators, dto, enums, filters, messages (PT-BR),
│   │   │                          #   middleware (requestId), pipes, utils, validation
│   │   ├── config/
│   │   │   ├── env/               # validação das variáveis de ambiente
│   │   │   ├── database/          # TypeORM, SSL e data-source da CLI de migrations
│   │   │   └── throttle/          # rate limit
│   │   ├── database/
│   │   │   ├── migrations/        # 7 migrations (schema, enums, índices, extensão unaccent)
│   │   │   └── seeds/seed.ts      # dados de exemplo (idempotente)
│   │   ├── modules/               # uma pasta por feature (feature-first)
│   │   │   ├── auth/              # register, login, JWT
│   │   │   ├── users/             # inclui mappers/
│   │   │   ├── projects/          # projetos, membros, papéis, ProjectAccessService
│   │   │   ├── tasks/             # tarefas, CSV
│   │   │   ├── reports/
│   │   │   └── health/
│   │   │       # em cada módulo: controllers/ services/ repositories/ dto/ entities/ (conforme a feature)
│   │   └── shared/types/          # tipos compartilhados (usuário autenticado)
│   ├── test/
│   │   ├── e2e/                   # *.e2e-spec.ts (supertest + PostgreSQL real)
│   │   ├── setup/                 # banco app_test, schema e variáveis de ambiente dos e2e
│   │   └── utils/ · fixtures/ · unit/
│   │   # os testes unitários ficam ao lado do código: src/**/*.spec.ts
│   └── README.md                  # guia curto do backend
├── frontend/                      # SPA React + Vite
│   ├── src/
│   │   ├── app/                   # App, layouts, RequireAuth
│   │   ├── routes/                # roteamento (React Router)
│   │   ├── pages/                 # Home e 404
│   │   ├── features/              # auth, projects, tasks (lista e Kanban), reports, users
│   │   ├── components/ui/         # design system (Button, Modal, DataTable, Toast…)
│   │   ├── services/api/          # cliente axios, interceptors, barra de atividade
│   │   ├── stores/                # Zustand: sessão, toasts e diálogo de confirmação
│   │   └── hooks/ · utils/ · types/ · styles/
│   │   # testes unitários ao lado do código: src/**/*.spec.ts (Vitest)
│   └── DESIGN.md                  # regras e tokens do design system
├── docker/                        # Dockerfiles (backend e frontend), nginx.conf e cabeçalhos de segurança do SPA
├── docker-compose.yml             # postgres + migrate + backend + frontend
├── .env.example                   # variáveis do compose
├── docs/
│   ├── partitura.md               # registro das decisões técnicas (D-001 a D-034)
│   ├── setup.md                   # guia de desenvolvimento local
│   └── api/contrato-d011-d015.md  # contrato dos endpoints
└── .github/workflows/ci.yml       # CI (GitHub Actions)
```

## 17. Convenções e como contribuir

- **Commits** em português, no padrão `tipo(escopo): descrição`. Tipos usados: `feat`, `fix`, `docs`, `chore`, `test`, `ci`. Exemplos do histórico: `feat(frontend): quadro Kanban de tarefas com arrastar e soltar (D-012)` e `fix(backend): busca de usuarios aceita email parcial`.
- **Decisões técnicas** novas entram em [`docs/partitura.md`](docs/partitura.md), no formato *Contexto / Decisão / Justificativa / Alternativas descartadas*, com o próximo número `D-0xx`.
- **Mudou uma entidade?** Gere e revise a migration (`migration:generate`); nunca use `synchronize`.
- **Mudou um endpoint?** Atualize os DTOs (o Swagger sai deles) e o [contrato](docs/api/contrato-d011-d015.md).
- **Frontend:** use os componentes de `components/ui` e os tokens de `global.css`; regras em [`frontend/DESIGN.md`](frontend/DESIGN.md).
- **Antes de abrir um PR**, rode `npm run lint`, `npm run build`, `npm run test` e `npm run test:e2e` no backend e `npm run lint`, `npm run test` e `npm run build` (que inclui o `typecheck`) no frontend: é o que o CI executa.
- **Fim de linha:** LF, forçado pelo `.gitattributes` da raiz (`* text=auto eol=lf`).
