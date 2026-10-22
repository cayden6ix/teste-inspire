# Partitura de decisoes - API de Projetos e Tarefas

**Desafio:** Tecnico Senior Fullstack - InnovaConnect
**Repo local:** `C:\Users\Paulo H. M. Ghizi\Desktop\teste-inspire`

Este documento registra as decisoes tecnicas do projeto, uma a uma.
Formato de cada item: **Contexto / Decisao / Justificativa / Alternativas descartadas**.

Status: **RASCUNHO** - as decisoes sao ditadas pelo usuario e registradas aqui conforme o comando.

---

## D-001 - Arquitetura: monolitico em camadas

**Contexto:** O desafio exige separacao clara de responsabilidades e organizacao coerente de pastas, com decisoes arquiteturais justificadas.

**Decisao:** Monolito modular em camadas, no padrao feature-first.
Backend NestJS: `modules/<feature>/{controllers,services,repositories,dto,entities}` + `common/` transversal + `shared/` (base entities/repositories) + `infra/` (adaptadores externos).
Frontend React: `features/<feature>/` + `components/ui` + `services/api` + `stores`.

**Justificativa:** Monolito em camadas entrega velocidade de entrega e clareza de responsabilidades sem a complexidade operacional de microservicos, que nao se justifica para o escopo. A separacao por feature com camadas internas permite extrair um modulo para servico proprio no futuro sem reescrever o codigo.

**Alternativas descartadas:**
- *Modulos horizontais (controllers/ no topo, services/ no topo)*: escala mal e mistura features.
- *Microservicos*: custo operacional desproporcional ao escopo.
- *Clean Architecture / Hexagonal com ports e adapters*: rigor excessivo para o tamanho do dominio; reservado para reavaliacao.

---

## D-002 - Banco de dados: PostgreSQL, sem migrations por enquanto

**Contexto:** O desafio exige persistencia de dados e migrations de banco.

**Decisao:** PostgreSQL. FASE 1: sem migrations - schema criado por `synchronize` do ORM, evolucao via alteracoes incrementais do schema. Migrations entram na FASE 2, quando o modelo estabilizar.

**Justificativa:** Evita o custo de escrever migrations para um modelo que ainda muda a cada sprint, sem perder o caminho de migracao (o ORM ja expoe o mecanismo). Postgres entrega relacoes (projeto - tarefa - usuario - membro) com integridade referencial real, alem de ser o banco com melhor suporte oficial de driver no ecosystem Node.

**Alternativas descartadas:**
- *SQLite*: sem integridade referencial real nem concorrencia de escrita adequada.
- *MySQL*: sem vantagem funcional para este dominio.

---

## D-003 - Frontend: React + TypeScript com Vite

**Contexto:** Definido pelo usuario. A escolha inicial era nao usar Vite; revisada para Vite durante a implementacao.

**Decisao:** React + TypeScript com Vite como bundler e dev server. SPA de consumo da API, sem SSR.

**Justificativa:** Vite entrega dev server com HMR e build otimizado sem configuracao, e o bundle de producao e estatico - servivel por nginx no container multi-stage. Mantem o pipeline de build curto e auditavel.

**Alternativas descartadas:**
- *Create React App*: descontinuado pela propria React.
- *Next.js*: traz SSR/router proprio, nao necessario para uma SPA de consumo da API.
- *esbuild / webpack manuais*: mais controle, porem a manutencao do tooling nao agrega valor a uma SPA de consumo de API.

---

## D-004 - Entrega com Docker

**Decisao:** Dockerfile por aplicacao (backend e frontend) + `docker-compose.yml` na raiz orquestrando API, banco Postgres e frontend.

**Justificativa:** Requisito explicito do desafio. Compose tambem viabiliza Postgres local sem instalacao na maquina.

---

## D-005 - Autenticacao

**Decisao:** JWT, com guards e strategies do Passport. Perfis de acesso: administrador e usuario.

**Justificativa:** Requisito explicito do desafio (JWT ou similar). Stateless, o que mantem a API escalavel horizontalmente.

---

## D-006 - ORM: TypeORM

**Contexto:** FASE 1 sem migrations, com criacao automatica de schema.

**Decisao:** TypeORM via `@nestjs/typeorm`. FASE 1 com `synchronize: true` (schema derivado das entidades). FASE 2 com migrations geradas pela CLI do TypeORM.

**Justificativa:** E o ORM oficialmente integrado ao Nest, com injecao de dependencias nativa (providers de repositorio), decorators que mapeiam direto para as entidades e CLI de migrations pronta para a fase 2. `synchronize` atende a fase 1 sem custo operacional.

**Alternativas descartadas:**
- *Prisma*: client muito tipado, porem exige adapter de DI para o Nest e nao usa o sistema de providers nativo.
- *Drizzle*: mais simples, porem sem CLI de migrations e sem decorators.

---

## D-007 - Gerenciador de estado no frontend

**Decisao:** Zustand para o estado global de sessao/autenticacao. Dados de servidor via axios + hooks proprios (cache em memoria nos hooks de feature).

**Justificativa:** Zustand e minimo (1 dependencia, ~1kB), sem boilerplate de providers e com tipagem forte - compativel com a disciplina de TS estrito. Evita a dependencia de uma lib de cache de queries que o escopo nao exige.

**Alternativas descartadas:**
- *Context API*: suficiente, mas sofre re-render em cascata quando a arvore de providers cresce.
- *Redux Toolkit*: robustez e devtools Excellent, porem boilerplate desproporcional ao escopo.
- *TanStack Query*: excelente para cache de servidor, porem traz uma camada de abstracao a mais que o momento nao pede.

---

## D-008 - ORM/banco: onde os testes rodam

**Decisao:** Usar TypeORM padrao

---

## D-009 - Estilizacao do frontend

**Decisao:** Tailwind CSS v4 integrado como plugin do Vite (`@tailwindcss/vite`), com design system em `components/ui`.

**Justificativa:** Um unico plugin, sem `tailwind.config.js` (o v4 usa configuracao em CSS via `@theme`), utilitarios coesivos sem CSS proprio por componente e build integrado ao Vite.

**Alternativas descartadas:**
- *CSS Modules*: nativo, porem exige convencao de nomes e repeticao de boilerplate.
- *CSS global unico*: escala mal com o crescimento das telas.

---

## D-010 - Servidor de desenvolvimento do frontend

**Decisao:** `vite dev` na porta 5173 com proxy de `/api` para `http://localhost:3000`.

**Justificativa:** O dev server fica no browser (origem 5173) e a API em outra origem (3000) - o proxy evita CORS no desenvolvimento. Em producao, o nginx do container serve o bundle estatico e faz proxy de `/api` para o container da API, mantendo a mesma regra de rotas no browser nos dois ambientes.

---

## D-011 - Tarefas por projeto

**Decisao:** Por projeto. Toda tarefa pertence a um projeto e so pode ser acessada no contexto dele.

---

## D-012 - Status das tarefas

**Decisao:** pendente / em_andamento / concluida

---

## D-013 - Membros de projeto

**Decisao:** Sim, com papeis (owner/admin/member/viewer). Criador vira owner.

---

## D-014 - Exportacao/Importacao

**Decisao:** CSV (exportar tarefas por projeto; importar CSV para criacao em massa).

---

## D-015 - Relatorios

**Decisao:** Endpoints agregados (/reports com groupBy=status|user e totais). Tambem considerar filtro por projeto.
