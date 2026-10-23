# Partitura de decisões - API de Projetos e Tarefas

**Desafio:** Técnico Sênior Fullstack - InnovaConnect
**Visão geral do projeto:** [README.md](../README.md)

Este documento registra as decisões técnicas do projeto, uma a uma.
Formato de cada item: **Contexto / Decisão / Justificativa / Alternativas descartadas**.

Status: **Vigente** - as decisões D-001 a D-034 refletem o estado atual do código. Última revisão: 2026-10-23. Decisões novas entram no fim, com o próximo número `D-0xx`. Quando uma decisão muda, o texto é reescrito e o que mudou fica registrado na própria decisão (campo **Histórico**).

Índice: [D-001](#d-001---arquitetura-monolito-modular-em-camadas) · [D-002](#d-002---banco-de-dados-postgresql-com-migrations) · [D-003](#d-003---frontend-react--typescript-com-vite) · [D-004](#d-004---entrega-com-docker) · [D-005](#d-005---autenticação) · [D-006](#d-006---orm-typeorm) · [D-007](#d-007---gerenciador-de-estado-no-frontend) · [D-008](#d-008---estratégia-de-testes) · [D-009](#d-009---estilização-do-frontend) · [D-010](#d-010---servidor-de-desenvolvimento-do-frontend) · [D-011](#d-011---tarefas-por-projeto) · [D-012](#d-012---status-das-tarefas) · [D-013](#d-013---membros-de-projeto) · [D-014](#d-014---exportaçãoimportação) · [D-015](#d-015---relatórios) · [D-016](#d-016---enums-nativos-do-postgres) · [D-017](#d-017---índices-escolhidos) · [D-018](#d-018---migrations-por-passo-manual-e-cli-sobre-o-dist) · [D-019](#d-019---busca-de-tarefas-no-servidor-só-ao-apertar-enter) · [D-020](#d-020---ordenação-padrão-e-desempate) · [D-021](#d-021---paginação-em-envelope-data-meta) · [D-022](#d-022---erros-padronizados-em-pt-br) · [D-023](#d-023---design-system-do-frontend) · [D-024](#d-024---papéis-e-matriz-de-autorização) · [D-025](#d-025---rate-limit-e-endurecimento-de-segurança) · [D-026](#d-026---serviço-migrate-one-shot-no-compose) · [D-027](#d-027---quem-não-é-membro-recebe-404) · [D-028](#d-028---busca-de-usuários-restrita-a-quem-gerencia-membros) · [D-029](#d-029---busca-sem-diferenciar-acentos-unaccent) · [D-030](#d-030---csv-com-bom-validação-do-arquivo-e-status-flexível) · [D-031](#d-031---entrada-sem-conversão-implícita-limites-da-conta-e-aviso-de-jwt_secret) · [D-032](#d-032---cabeçalhos-de-segurança-e-cache-no-nginx-sem-source-maps) · [D-033](#d-033---robustez-da-interface-estado-do-projeto-confirmação-e-quadro-com-teto) · [D-034](#d-034---lint-e-testes-do-frontend)

---

## D-001 - Arquitetura: monolito modular em camadas

**Contexto:** O desafio exige separação clara de responsabilidades e organização coerente de pastas, com decisões arquiteturais justificadas.

**Decisão:** Monolito modular em camadas, no padrão feature-first.
Backend NestJS: `modules/<feature>/{controllers,services,repositories,dto,entities}` + `common/` (filtros, pipes, DTOs de paginação, mensagens, utilitários) + `config/` (ambiente e TypeORM) + `database/` (migrations e seed) + `shared/types` (tipos compartilhados).
Frontend React: `features/<feature>/` + `components/ui` + `services/api` + `stores`.

**Justificativa:** Monolito em camadas entrega velocidade de entrega e clareza de responsabilidades sem a complexidade operacional de microsserviços, que não se justifica para o escopo. A separação por feature com camadas internas permite extrair um módulo para serviço próprio no futuro sem reescrever o código. Para isso valer na prática, os módulos se falam por serviços e não por repositórios alheios: `ProjectsModule` exporta só o `ProjectAccessService` e `TasksModule` exporta só o `TasksService`, que o `ReportsModule` consome.

**Histórico:** O scaffolding inicial previa também `shared/base-entities`, `shared/base-repositories` e `infra/` (adaptadores externos como e-mail e armazenamento). Nunca houve código nessas pastas e elas foram removidas; se surgirem entidades base ou adaptadores externos, voltam com conteúdo.

**Alternativas descartadas:**
- *Módulos horizontais (controllers/ no topo, services/ no topo)*: escala mal e mistura features.
- *Microsserviços*: custo operacional desproporcional ao escopo.
- *Clean Architecture / Hexagonal com ports e adapters*: rigor excessivo para o tamanho do domínio; reservado para reavaliação.

---

## D-002 - Banco de dados: PostgreSQL com migrations

**Contexto:** O desafio exige persistência de dados e migrations de banco. Inicialmente o schema era criado por `synchronize` (FASE 1), o que foi substituído por migrations quando o modelo estabilizou.

**Decisão:** PostgreSQL com schema gerenciado por migrations do TypeORM (`backend/src/database/migrations`). `synchronize` fica desligado em todos os ambientes (`DATABASE_SYNCHRONIZE=false`). Detalhes de execução em D-018 e D-026.

**Justificativa:** Migrations versionam o schema, permitem `up` e `down` e deixam a evolução auditável, algo que o `synchronize` não oferece (ele pode dropar colunas sem aviso). Postgres entrega relações (projeto - tarefa - usuário - membro) com integridade referencial real, além de ser o banco com melhor suporte oficial de driver no ecossistema Node.

**Alternativas descartadas:**
- *SQLite*: sem integridade referencial real nem concorrência de escrita adequada.
- *MySQL*: sem vantagem funcional para este domínio.

---

## D-003 - Frontend: React + TypeScript com Vite

**Contexto:** Definido pelo usuário. A escolha inicial era não usar Vite; revisada para Vite durante a implementação.

**Decisão:** React + TypeScript com Vite como bundler e dev server. SPA de consumo da API, sem SSR.

**Justificativa:** Vite entrega dev server com HMR e build otimizado sem configuração, e o bundle de produção é estático, servível por nginx no container multi-stage. Mantém o pipeline de build curto e auditável.

**Alternativas descartadas:**
- *Create React App*: descontinuado pela própria React.
- *Next.js*: traz SSR/router próprio, não necessário para uma SPA de consumo da API.
- *esbuild / webpack manuais*: mais controle, porém a manutenção do tooling não agrega valor a uma SPA de consumo de API.

---

## D-004 - Entrega com Docker

**Contexto:** O desafio exige que o projeto rode via Docker.

**Decisão:** Dockerfile por aplicação (backend e frontend), multi-stage e com usuário não-root na API, mais um `docker-compose.yml` na raiz orquestrando Postgres, a execução das migrations (D-026), a API e o frontend (nginx servindo o bundle e fazendo proxy de `/api` e `/docs` para a API).

**Justificativa:** Requisito explícito do desafio. O compose também viabiliza o Postgres local sem instalação na máquina e dá o mesmo caminho de rotas do navegador em desenvolvimento e em contêiner (D-010).

**Alternativas descartadas:**
- *Um único Dockerfile para as duas aplicações*: acopla ciclos de build e imagens que têm runtimes diferentes (Node e nginx).
- *Só instruções de instalação local (sem Docker)*: não atende ao requisito e torna a avaliação dependente do ambiente de quem avalia.

---

## D-005 - Autenticação

**Contexto:** O desafio pede autenticação com JWT (ou similar) e níveis de acesso. Uma versão anterior deste texto previa perfis globais "administrador" e "usuário" e um par access/refresh token. Nenhum dos dois existe no código.

**Decisão:** JWT **stateless** de curta duração (`JWT_EXPIRES_IN`, padrão `1h`), assinado com `JWT_SECRET` (mínimo de 32 caracteres, validado no boot), via Passport (`passport-jwt`) e um **guard global** (`APP_GUARD`) que exige token em toda rota, exceto as marcadas com `@Public()` (`auth` e `health`; ver D-025). **Não há refresh token**: ao expirar, a pessoa faz login de novo (o frontend trata o 401 limpando a sessão e levando para `/login`). Senhas são armazenadas com **bcrypt**. **Não existe perfil global** de administrador: os níveis de acesso são os papéis **por projeto** (`owner`, `admin`, `member`, `viewer`), conforme D-013 e D-024. A cada requisição a estratégia confere se o usuário do token ainda existe e está ativo.

**Justificativa:** Requisito explícito do desafio. Token stateless mantém a API escalável horizontalmente, sem armazenamento de sessão. Refresh token traz rotação, revogação e armazenamento seguro no cliente; para o escopo, um token curto com novo login é mais simples e tem menos superfície de ataque. Perfil global não faz sentido neste domínio: a mesma pessoa pode ser `owner` de um projeto e apenas `viewer` de outro, então a permissão pertence ao vínculo com o projeto.

**Histórico:** As variáveis `JWT_REFRESH_SECRET` e `JWT_REFRESH_EXPIRES_IN` eram obrigatórias sem que houvesse fluxo de refresh; foram removidas junto com o campo `role` global do tipo `User` do frontend.

**Alternativas descartadas:**
- *Refresh token*: avaliado; adiado como evolução (README, seção 14).
- *Sessão em servidor com cookie*: exige armazenamento de sessão compartilhado para escalar e cuida de CSRF.
- *Provedor externo (OAuth/OIDC)*: dependência externa desproporcional ao escopo.
- *Perfis globais admin/usuário*: não representam o domínio (ver Justificativa).

---

## D-006 - ORM: TypeORM

**Contexto:** A FASE 1 usou `synchronize` para criar o schema a partir das entidades. Na FASE 2 o schema passou a ser versionado com migrations.

**Decisão:** TypeORM via `@nestjs/typeorm`. Migrations geradas pela CLI do TypeORM (`migration:generate`) e aplicadas por passo explícito (`migration:run`), conforme D-018 e D-026. Entidades com nomes explícitos de constraints e enums nativos (D-016, D-017).

**Justificativa:** É o ORM oficialmente integrado ao Nest, com injeção de dependências nativa (providers de repositório), decorators que mapeiam direto para as entidades e CLI de migrations que compara entidades com o banco. Isso permite checar a sincronia entre código e schema com `migration:generate`, que não gera nada quando estão iguais.

**Alternativas descartadas:**
- *Prisma*: client muito tipado, porém exige adapter de DI para o Nest e não usa o sistema de providers nativo.
- *Drizzle*: mais simples, porém sem CLI de migrations e sem decorators.

---

## D-007 - Gerenciador de estado no frontend

**Contexto:** A interface precisa de estado de sessão global e de dados de servidor (listas paginadas, detalhes).

**Decisão:** Zustand para o estado global de sessão (token, persistido em `localStorage`) e para os toasts. Dados de servidor via axios + hooks próprios por feature (`useProjects`, `useTasks`, `useMembers`...). **Não há cache de dados de servidor**: cada montagem de tela refaz a requisição. Os hooks paginados descartam respostas antigas (guardam um `requestId`) para evitar que uma resposta tardia sobrescreva a mais recente. O efeito que dispara a busca liga o estado de carregamento de forma síncrona; a regra `react/set-state-in-effect` do oxlint é desligada **só nessas linhas**, com o motivo no comentário (D-034).

**Justificativa:** Zustand é mínimo (1 dependência, ~1kB), sem boilerplate de providers e com tipagem forte, compatível com a disciplina de TS estrito. Evita a dependência de uma lib de cache de queries que o escopo não exige. O custo conhecido é refazer requisições ao navegar; para o volume do desafio isso é aceitável, e a migração para TanStack Query continua possível (README, seção 14).

**Alternativas descartadas:**
- *Context API*: suficiente, mas sofre re-render em cascata quando a árvore de providers cresce.
- *Redux Toolkit*: robustez e devtools excelentes, porém boilerplate desproporcional ao escopo.
- *TanStack Query*: excelente para cache de servidor, porém traz uma camada de abstração a mais que o momento não pede.

---

## D-008 - Estratégia de testes

**Contexto:** Testes automatizados são requisito obrigatório do desafio. A versão anterior desta decisão apenas dizia "usar TypeORM padrão", sem responder onde e como os testes rodam.

**Decisão:** Duas camadas de teste no backend, ambas com **Vitest** e **SWC** (`unplugin-swc`, para emitir os metadados de decorators de que a injeção de dependência do Nest precisa; o transformador padrão do Vite não os emite):
- **Unitários** (`npm run test`; `src/**/*.spec.ts` ao lado do código e `test/**/*.spec.ts`): services, DTOs e utilitários isolados, **sem banco**, com repositórios substituídos por mocks (`@nestjs/testing`). Cobrem regras de papel, importação de CSV, filtro de exceções, validação de ambiente, paginação, escape de `LIKE` e o seed. Cobertura medida com `npm run test:cov`.
- **End-to-end** (`npm run test:e2e`; `test/e2e/*.e2e-spec.ts`): aplicação Nest completa (montada pela mesma `configureApp` do servidor real) com `supertest` contra um **PostgreSQL real em banco separado, `app_test`**. A cada execução o setup recria o schema `public` desse banco e aplica as **migrations reais**. Uma guarda recusa qualquer banco cujo nome não termine em `_test`, e um *advisory lock* serializa execuções simultâneas. Cobrem cadastro e login, 401 sem token, IDOR entre projetos, matriz de papéis, paginação, CSV de ponta a ponta, relatórios, rate limit e o Swagger. Cobertura com `npm run test:e2e:cov`.
- **Frontend** (`npm run test` em `frontend/`; `src/**/*.spec.ts`): **Vitest** em ambiente node, só lógica pura: matriz de papéis (`assignableRoles`, `canManageMember`), mensagens de erro (`errorList`, `isRetryableError`, 401/403/409/429/rede), JWT, formatação (datas, números, `<1%`), destino depois do login, título da aba, store do diálogo de confirmação, sessão, montagem das colunas do quadro e o teto de carga do quadro (D-033, D-034).
- **CI** (`.github/workflows/ci.yml`): o Postgres é um *service container* do GitHub Actions (banco `app_test`); o job do backend roda lint, `tsc`, build, `test:cov` e `test:e2e`; o do frontend roda lint, typecheck, `test` e build.

No momento desta revisão são 786 testes no backend (439 unitários e 347 e2e) e 95 no frontend; a cobertura de instruções do backend é de cerca de 78% nos unitários e 95% nos e2e (migrations e seed ficam fora da conta).

**Justificativa:** Mocks dão testes rápidos das regras de negócio sem banco. O e2e com Postgres real cobre o que mock não cobre: constraints, enums nativos, SQL de paginação/ordenação e a integração guard + pipe + filtro. Um banco separado garante que os testes nunca toquem os dados de desenvolvimento. Usar um Postgres real (e não SQLite em memória) evita divergência de comportamento com a produção.

**Alternativas descartadas:**
- *SQLite em memória nos e2e*: comportamento diferente do Postgres (enums, tipos, `ILIKE`), o que esconderia bugs.
- *Só testes e2e*: lentos para cobrir todas as combinações de regra.
- *Só testes unitários com mocks*: não pegam erros de SQL, de migration ou de configuração do Nest.
- *Jest*: o template do Nest 12 já usa Vitest; manter uma só ferramenta.
- *Testes de componente com jsdom/Testing Library e E2E de navegador (Playwright)*: ficaram como evolução (README, seção 14); a primeira camada de testes do frontend cobre a lógica pura, sem DOM.

---

## D-009 - Estilização do frontend

**Contexto:** A interface precisa de estilos consistentes sem CSS próprio por componente.

**Decisão:** Tailwind CSS v4 integrado como plugin do Vite (`@tailwindcss/vite`), com design system em `components/ui` (ver D-023).

**Justificativa:** Um único plugin, sem `tailwind.config.js` (o v4 usa configuração em CSS via `@theme`), utilitários coesivos sem CSS próprio por componente e build integrado ao Vite.

**Alternativas descartadas:**
- *CSS Modules*: nativo, porém exige convenção de nomes e repetição de boilerplate.
- *CSS global único*: escala mal com o crescimento das telas.

---

## D-010 - Servidor de desenvolvimento do frontend

**Contexto:** Em desenvolvimento o navegador abre o frontend em uma origem e a API responde em outra.

**Decisão:** `vite dev` na porta 5173 com proxy de `/api` para `http://localhost:3000`.

**Justificativa:** O dev server fica no navegador (origem 5173) e a API em outra origem (3000); o proxy evita CORS no desenvolvimento. Em produção, o nginx do container serve o bundle estático e faz proxy de `/api` para o container da API, mantendo a mesma regra de rotas no navegador nos dois ambientes.

**Alternativas descartadas:**
- *Habilitar CORS e apontar o frontend direto para `http://localhost:3000`*: funciona, mas deixa o código do frontend conhecer a origem da API e diverge do ambiente de contêiner.

---

## D-011 - Tarefas por projeto

**Contexto:** O desafio descreve um sistema para organizar o trabalho de diferentes usuários. Era preciso decidir se uma tarefa existe sozinha ou dentro de um agrupador, e como isso afeta o controle de acesso.

**Decisão:** Toda tarefa pertence a exatamente um projeto e só é acessada no contexto dele. As rotas são aninhadas (`/api/projects/:projectId/tasks/...`) e toda busca de tarefa filtra por `projectId` e `id` juntos. Apagar o projeto apaga suas tarefas (`ON DELETE CASCADE`).

**Justificativa:** O projeto é a fronteira natural de permissão (D-013): ao filtrar sempre pelo projeto, uma pessoa que não é membro nunca alcança a tarefa de outro projeto, mesmo conhecendo o id (proteção contra IDOR). Também mantém as listagens, o CSV (D-014) e os relatórios (D-015) com escopo claro.

**Alternativas descartadas:**
- *Tarefas avulsas por usuário, sem projeto*: não permite que várias pessoas trabalhem no mesmo conjunto de tarefas (avaliada na época).
- *Tarefas globais com etiqueta de projeto e rotas planas (`/api/tasks`)*: o controle de acesso passaria a depender de verificar o projeto em cada consulta (avaliada na época).

---

## D-012 - Status das tarefas

**Contexto:** O desafio pede que a tarefa tenha status. Era preciso escolher o conjunto de estados e sua representação.

**Decisão:** Três status fixos: `pendente`, `em_andamento` e `concluida` (default `pendente`), armazenados como enum nativo do Postgres (D-016) e espelhados no enum `TaskStatus` do backend. O quadro Kanban do frontend tem uma coluna por status, e arrastar o cartão atualiza o status.

**Justificativa:** É o fluxo mínimo que representa trabalho a fazer, em andamento e feito, e mapeia direto em um Kanban. Valores em minúsculas e sem acento são estáveis para API e banco; os rótulos em português são responsabilidade da interface.

**Alternativas descartadas:**
- *Status configuráveis por projeto*: flexível, porém exige tabela própria e migração de dados quando a lista muda (avaliada na época).
- *Mais estados (por exemplo, em revisão, cancelada)*: sem requisito que justifique, e cada estado extra complica relatórios e Kanban (avaliada na época).

---

## D-013 - Membros de projeto

**Contexto:** O desafio pede níveis de acesso e que um usuário participe de vários projetos.

**Decisão:** Relação N:N entre usuários e projetos (`project_members`), com um papel por vínculo: `owner`, `admin`, `member` ou `viewer`, com restrição de unicidade `(project_id, user_id)`. Quem cria o projeto vira `owner`. A matriz do que cada papel pode fazer está em D-024.

**Justificativa:** O papel por vínculo permite que a mesma pessoa tenha permissões diferentes em projetos diferentes, o que um perfil global não permite. Quatro papéis cobrem os casos reais (dono, gestor, colaborador e somente leitura) sem virar um sistema de permissões granulares.

**Alternativas descartadas:**
- *Só o dono acessa o projeto (sem membros)*: não atende "diferentes usuários" trabalhando juntos.
- *Perfil global admin/usuário*: não distingue papéis entre projetos.
- *Permissões granulares por ação (ACL)*: desproporcional ao escopo (avaliada na época).

---

## D-014 - Exportação/Importação

**Contexto:** O desafio pede exportar todas as tarefas e importar tarefas em massa.

**Decisão:** CSV, por projeto, com as colunas `titulo,descricao,status,responsavel_email,data_limite` (data em `YYYY-MM-DD`).
- **Exportação** (`GET /api/projects/:projectId/tasks/export`): não paginada, em ordem **cronológica** (`createdAt asc`, `id asc`, D-020), em UTF-8 **com BOM** (D-030), disponível para qualquer membro.
- **Importação** (`POST /api/projects/:projectId/tasks/import`): `multipart/form-data` no campo `file` (um arquivo, até 5 MB) ou CSV puro no corpo (`text/csv`); exige papel que escreve tarefas. Linhas válidas são importadas e linhas inválidas **não interrompem** a importação: voltam em `errors[]` com o número da linha (1 = cabeçalho) e a mensagem. A resposta é `{created, errors}`. O responsável é identificado pelo e-mail e precisa ser membro do projeto.

- **Limites e gravação:** até 5 MB e **5000 linhas de dados** (acima disso, 400 e nada é importado); título com até 200 caracteres, descrição com até 4000 e data `AAAA-MM-DD` válida. Os responsáveis são resolvidos com os membros do projeto carregados de uma vez, e as linhas válidas são inseridas **em lotes de 500, em uma única transação**: ou todas as válidas entram, ou nenhuma.
- **Proteção contra fórmulas (CSV/Formula Injection):** na exportação, valor de texto que começa com `=`, `+`, `-`, `@`, tab ou CR (mesmo precedido de apóstrofos) sai com um apóstrofo na frente, e a planilha mostra o texto em vez de executá-lo. Na importação, o apóstrofo inicial é removido, então exportar e importar de volta preserva o texto.
- **Validação do arquivo (D-030):** cabeçalho sem a coluna `titulo`, arquivo que não é CSV (byte nulo, JSON, aspas quebradas) ou sem nenhuma linha de dados respondem 400, antes de importar qualquer linha. Os nomes das colunas e o status aceitam variações de escrita (`Título`, `Em Andamento`, `Concluída`).
- **Ordem preservada:** a importação grava `created_at` crescente por linha (D-020) e a exportação sai em ordem cronológica, então exportar e importar de volta preserva a ordem relativa das tarefas (a última linha é a mais nova).

**Histórico:** até 2026-10-22 a exportação saía na ordem da lista (mais nova primeiro) e, combinada com o `created_at` crescente da importação, exportar e importar de volta invertia a ordem relativa. A exportação passou a ser cronológica (D-030).

**Justificativa:** CSV é o formato universal de planilha, simples de gerar, de revisar e de testar. Importar o que for válido e devolver as linhas com erro é mais útil para quem importa do que rejeitar o arquivo inteiro por uma linha ruim. Identificar o responsável pelo e-mail permite que o arquivo exportado seja reimportado em outro projeto.

**Alternativas descartadas:**
- *XLSX*: exige dependência pesada e traz formatos e macros; sem ganho para este uso (avaliada na época).
- *JSON*: ótimo para integração, ruim para quem edita em planilha (avaliada na época).
- *Importação tudo-ou-nada*: um erro em uma linha de milhares bloquearia o arquivo inteiro (avaliada na época).

---

## D-015 - Relatórios

**Contexto:** O desafio pede relatórios por status e por usuário.

**Decisão:** Um endpoint agregado, `GET /api/reports?groupBy=status|user&projectId=<uuid>`, que devolve `{groupBy, total, byStatus, groups:[{key, label, count}]}`. Sem `projectId`, agrega todos os projetos em que a pessoa é membro; com `projectId`, exige ser membro dele. A lista por usuário é ordenada por contagem decrescente, depois por nome e por id do responsável, e as tarefas sem responsável aparecem como `sem_responsavel`.

**Justificativa:** Um único endpoint com `groupBy` cobre os dois relatórios pedidos e deixa espaço para novas agregações sem novas rotas. O escopo "todos os meus projetos" é o que a tela de relatórios precisa. A contagem é feita **no banco** (`GROUP BY` por status e por responsável, no repository de tarefas), então a memória da API não cresce com o número de tarefas; o service só monta os rótulos e a ordenação. Antes, as tarefas eram carregadas e contadas em JavaScript.

**Alternativas descartadas:**
- *Um endpoint por relatório (`/reports/by-status`, `/reports/by-user`)*: mais rotas para a mesma ideia (avaliada na época).
- *Calcular os totais no frontend a partir da lista de tarefas*: exigiria baixar todas as tarefas e duplicaria a regra de acesso (avaliada na época).

---

## D-016 - Enums nativos do Postgres

**Contexto:** `tasks.status` e `project_members.role` eram colunas `varchar`. Os valores válidos existiam apenas no TypeScript (`TaskStatus`, `ProjectRole`), então o banco aceitava qualquer texto.

**Decisão:** Tipos nativos `task_status` (`pendente`, `em_andamento`, `concluida`, default `pendente`) e `project_role` (`owner`, `admin`, `member`, `viewer`). As entidades usam `type: 'enum'` reaproveitando os enums de `src/common/enums`, com `enumName` explícito. Os valores da API não mudam.

**Justificativa:** Um tipo enum do Postgres rejeita valor fora da lista no próprio banco (CHECK implícito do tipo), independente de qual aplicação ou script escreve. Foi provado em banco temporário: `superuser` e `invalido` geram `invalid input value for enum`.

**Alternativas descartadas:**
- *`varchar` com CHECK constraint*: mesmo efeito, porém a lista fica espalhada e não aparece como tipo em `\dT`.
- *Validação só na aplicação*: não protege contra escrita direta no banco.

---

## D-017 - Índices escolhidos

**Decisão:** Três índices, todos com nome explícito:

- `IDX_tasks_project_id_created_at_id` em `tasks (project_id, created_at, id)`: a listagem de tarefas filtra por projeto e ordena por `created_at DESC, id DESC` (desempate determinístico por id). O índice atende o filtro por `project_id` (prefixo) e a ordenação completa; a leitura reversa do btree cobre o `DESC`, sem declarar ordem no índice.
- `IDX_tasks_assignee_id` em `tasks (assignee_id)`: relatório por usuário e filtro por responsável.
- `IDX_project_members_user_id` em `project_members (user_id)`: listar os projetos de um usuário.

**Histórico:** o índice inicial era `IDX_tasks_project_id_created_at (project_id, created_at)`. Com a ordenação por `id` como desempate, o Postgres passou a precisar de Incremental Sort. A migration `1792681800005-ReplaceTaskProjectCreatedAtIndexWithId` troca o índice pelo de três colunas. Medido em banco temporário com 5000 tarefas em 2 projetos: antes, o OFFSET 0 usava Incremental Sort e o OFFSET alto (com `enable_seqscan=off`) usava Bitmap Heap Scan + Sort completo; depois, ambos usam `Index Scan Backward` sem Sort.

**Não criado:** índice só em `project_members (project_id)`. A `UQ_project_members_project_user (project_id, user_id)` já cobre a busca por projeto, pois `project_id` é o primeiro campo da unique.

**Justificativa:** Índices só onde há consulta real. Cada índice custa escrita e espaço, por isso o limite de três. O índice composto com `id` tem o mesmo custo de um de duas colunas e elimina a ordenação em memória.

---

## D-018 - Migrations por passo manual e CLI sobre o dist

**Decisão:**
- Migrations ficam em `backend/src/database/migrations/<timestamp>-<Nome>.ts`, uma por propósito (criação de cada tabela, índices).
- Não há `migrationsRun` automático: **a API não altera o schema no boot**. Quem aplica é um passo explícito: `npm run migration:run` no desenvolvimento e o serviço `migrate` do compose no Docker (D-026).
- A CLI usa `backend/src/config/database/data-source.ts` apontando para `dist/**/*.js`. Os scripts `migration:run`, `migration:revert` e `migration:show` não compilam, para funcionar no container de produção (que só tem `dist` e `node_modules` de produção). `migration:generate` compila antes.
- O seed roda depois das migrations e não depende de `synchronize`. `seed:run` usa o `dist` já compilado; `seed` compila e roda.

**Justificativa:** Migração automática no boot faz várias réplicas da API tentarem alterar o schema ao mesmo tempo e esconde o momento em que o banco muda. Com passo explícito, a mudança de schema é um ato revisável. Rodar pelo `dist` evita `tsx`/`ts-node` (que exigiriam novas dependências com ESM) e mantém a mesma imagem para aplicar migrations em produção.

**Alternativas descartadas:**
- *`migrationsRun: true`*: aplica automaticamente, com as ressalvas acima.
- *CLI sobre `src` com `ts-node`/`tsx`*: exige dependência extra e não roda no container de produção.

---

## D-019 - Busca de tarefas no servidor, só ao apertar Enter

**Contexto:** A tela de tarefas tem um campo de busca. Filtrar no cliente exigiria carregar todas as tarefas do projeto; buscar no servidor a cada tecla geraria uma requisição por caractere digitado, e o servidor faria `ILIKE` em título e descrição a cada uma.

**Decisão:** A busca é executada **no servidor** (`search` em `GET /api/projects/:projectId/tasks`, `unaccent(coluna) ILIKE unaccent(termo)` em título e descrição: sem diferenciar maiúsculas nem acentos, D-029) e só dispara quando a pessoa **aperta Enter** (a interface mostra um selo "Enter" dentro do campo, com a dica "Pressione Enter para buscar" no `title` e para leitores de tela); o botão Limpar zera o filtro. A regra é **uniforme**: a lista (`TasksPage`) e o quadro Kanban (`TaskBoardPage`) buscam da mesma forma, por título e descrição. Decisão do usuário, para evitar gargalo no servidor.

**Justificativa:** Mantém a paginação correta (o total e as páginas refletem o filtro), evita baixar o projeto inteiro no cliente e elimina o tráfego de uma requisição por tecla. O custo é a busca não ser "ao vivo".

**Alternativas descartadas:**
- *Busca no cliente ao digitar*: só enxerga o que já foi carregado e quebra com paginação.
- *Busca no servidor com debounce*: reduz, mas não elimina as requisições intermediárias (avaliada na época).

---

## D-020 - Ordenação padrão e desempate

**Contexto:** Com paginação por `OFFSET`, registros com o mesmo valor na chave de ordenação (por exemplo, o mesmo `created_at` em uma importação) podem repetir ou sumir entre páginas se a ordem não for total.

**Decisão:** Toda listagem paginada tem **desempate final por `id`**, na mesma direção da ordenação (ex.: `ORDER BY created_at DESC, id DESC`). Padrões: tarefas `createdAt desc` (mais novas primeiro), projetos `name asc`, usuários `name asc`, membros pelo nome do usuário `asc`. O `sortBy` só aceita campos de uma lista permitida por endpoint. Na importação de CSV, cada tarefa recebe `created_at` explícito e crescente por linha, de modo que a última linha do arquivo é a mais nova. A **exportação** CSV sai em ordem **cronológica** (`createdAt asc, id asc`): reimportar o arquivo preserva a ordem relativa. A **lista** continua do mais novo para o mais antigo.

**Justificativa:** Ordem total garante que a paginação seja estável e a exportação seja idêntica entre execuções. Gravar `created_at` crescente na importação preserva a ordem do arquivo mesmo quando as linhas são salvas no mesmo instante; exportar em ordem cronológica fecha o ciclo exportar -> importar sem inverter nada. O índice de D-017 cobre as duas direções (leitura reversa do btree).

**Histórico:** a exportação seguia a ordem da lista (`createdAt desc`) e o ciclo exportar -> importar invertia a ordem relativa; passou a ser cronológica em 2026-10-23 (D-030).

**Alternativas descartadas:**
- *Ordenar só por `created_at`*: paginação instável quando há empates.
- *Paginação por cursor (keyset)*: mais estável em volumes grandes, porém muda o contrato e complica a UI de páginas numeradas (avaliada na época).

---

## D-021 - Paginação em envelope {data, meta}

**Contexto:** O desafio pede paginação e filtros. Era preciso padronizar o formato e os limites para todas as listagens.

**Decisão:** As listagens (`/projects`, `/projects/:projectId/tasks`, `/projects/:projectId/members`, `/users`) aceitam `page` (inteiro ≥ 1, padrão 1) e `limit` (1 a 100, padrão 15) e respondem `{data: T[], meta: {page, limit, total, totalPages}}`. `totalPages` é 0 quando `total` é 0 e `ceil(total / limit)` nos demais casos. Página além da última devolve 200 com `data` vazio. Valores inválidos (`page=0`, `limit=101`, `page=abc`) respondem 400. A exportação CSV e o relatório não são paginados.

**Justificativa:** Um envelope único permite um componente de paginação único no frontend e um tipo genérico no backend. O teto de 100 protege o servidor de consultas enormes. Paginação por `OFFSET` é simples e permite pular para qualquer página.

**Alternativas descartadas:**
- *Cabeçalhos HTTP (`Link`, `X-Total-Count`)*: menos descobríveis e mais difíceis de tipar.
- *Paginação por cursor*: ver D-020.
- *Sem limite máximo*: um `limit` enorme viraria um vetor de negação de serviço.

---

## D-022 - Erros padronizados em PT-BR

**Contexto:** Os erros padrão do Nest e do Express vêm em inglês e em formatos diferentes, e os desenvolvedores do frontend precisam de um contrato estável.

**Decisão:** Um filtro global (`AllExceptionsFilter`) normaliza toda saída de erro para `{statusCode, error, message, path, timestamp, requestId}`. `error` é um **código estável em maiúsculas** (`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `PAYLOAD_TOO_LARGE`...), nunca traduzido. `message` é **sempre em português do Brasil**: texto para erros de domínio e de status, lista de textos na validação (`O campo "<rótulo>" <regra>.`). Os textos padrão em inglês são trocados por mensagens por status, e o `requestId` (header `x-request-id` ou UUID gerado) correlaciona resposta e log. Stack trace e detalhes internos nunca vão ao cliente.

**Justificativa:** O código estável permite ao frontend decidir o comportamento sem depender do texto; a mensagem em português pode ser exibida direto ao usuário final; o `requestId` encurta o diagnóstico. Centralizar no filtro evita que cada controller formate erros à sua maneira.

**Alternativas descartadas:**
- *Mensagens em inglês traduzidas no frontend*: duplica o dicionário e desincroniza com o backend.
- *Códigos de erro numéricos próprios*: pouco legíveis em logs e no Swagger.
- *Formato RFC 7807 (`application/problem+json`)*: avaliado; o formato atual já cobre a necessidade e é o que o frontend consome (avaliada na época).

---

## D-023 - Design system do frontend

**Contexto:** Várias telas e componentes foram escritos em momentos diferentes e começaram a divergir em alturas, espaçamentos e raios.

**Decisão:** Os tokens de design (cores, alturas de controle, espaçamento, raios, tipografia) ficam em **um único lugar**, o bloco `@theme` de `frontend/src/styles/global.css`. Os componentes de `components/ui` consomem os tokens, e as páginas só **compõem** componentes: nada de altura, padding ou raio de controle definido na página. As regras estão documentadas em [`frontend/DESIGN.md`](../frontend/DESIGN.md). Modal, toasts e tabela têm estados de carregamento, vazio e erro e atendem a requisitos básicos de acessibilidade (foco, `aria-live`, `prefers-reduced-motion`).

**Justificativa:** Um ponto único de verdade para o visual torna as mudanças baratas e as telas consistentes. Documentar a "regra de ouro" evita que a divergência volte.

**Alternativas descartadas:**
- *Biblioteca de componentes pronta (MUI, Chakra, shadcn)*: acelera, mas traz peso e um visual próprio que contraria a escolha de Tailwind com tokens (D-009) (avaliada na época).
- *Estilos livres por página*: foi o que gerou a divergência original.

---

## D-024 - Papéis e matriz de autorização

**Contexto:** D-013 define os papéis. Faltava a regra completa e o lugar onde ela é aplicada.

**Decisão:** A autorização é decidida **no service**, por `ProjectAccessService.requireRole(projectId, userId, papéisPermitidos)`: projeto inexistente **e** projeto do qual a pessoa não é membro respondem o mesmo 404 (`Projeto não encontrado.`, D-027) e quem é membro sem o papel recebe 403 (`Seu papel no projeto não permite esta ação.`). Ordem: `owner` > `admin` > `member` > `viewer`.

| Ação | owner | admin | member | viewer |
| --- | :---: | :---: | :---: | :---: |
| Ler projeto, tarefas, membros, relatório e exportar CSV | sim | sim | sim | sim |
| Criar, editar e excluir tarefas; importar CSV | sim | sim | sim | não |
| Editar o projeto | sim | sim | não | não |
| Adicionar, alterar o papel e remover membros `member`/`viewer` | sim | sim | não | não |
| Atribuir `admin`, alterar ou remover um `admin` | sim | não | não | não |
| Excluir o projeto | sim | não | não | não |

Regras de membros (`project-members.service.ts`):
- O papel `owner` **só nasce na criação do projeto**: atribuí-lo (POST ou PATCH) é 400. Não existe transferência de propriedade.
- Ninguém altera o próprio papel nem se remove do projeto (400). O `owner` não pode ter o papel alterado nem ser removido (403).
- `admin` só age sobre `member` e `viewer` e só atribui esses dois papéis; agir sobre `admin` ou `owner`, ou atribuir `admin`, é 403.
- Remover um membro **desatribui as tarefas dele** no projeto, na mesma transação.
- As mensagens da API usam os termos da interface (proprietário, administrador, membro, visualizador); os valores do enum continuam `owner|admin|member|viewer`.
- O frontend espelha essas regras (papel do `owner` não editável, `admin` só oferece `member`/`viewer`), mas a regra de verdade é a do backend.

**Histórico:** quem não era membro recebia 403 (`Você não faz parte deste projeto.`), o que distinguia um projeto existente de um inexistente; passou a 404 em 2026-10-23 (D-027). A primeira versão deixava um `admin` rebaixar ou remover outro `admin` e o `owner` rebaixar a si mesmo (o projeto podia ficar sem dono), e o contrato e o código se contradiziam. As regras acima fecharam essas brechas e estão cobertas por testes unitários e e2e.

**Justificativa:** Concentrar a regra em um serviço e filtrar toda busca por `projectId` + `id` evita IDOR e impede que um controller esqueça a checagem. Manter a hierarquia simples (quatro papéis) deixa a matriz verificável por testes.

**Alternativas descartadas:**
- *Guard/decorator de papel por rota*: o papel depende do projeto da rota e do alvo da operação (por exemplo, quem está sendo rebaixado), o que é difícil de expressar fora do service (avaliada na época).
- *Biblioteca de políticas (CASL)*: poderosa, mas desproporcional para quatro papéis (avaliada na época).

---

## D-025 - Rate limit e endurecimento de segurança

**Contexto:** A revisão sênior apontou ausência de rate limit, SSL do banco acoplado a `NODE_ENV`, Swagger sempre exposto, seed sem guarda, CSV sem proteção contra fórmula e diretório de usuários aberto.

**Decisão:**
- **Rate limit por IP** com `@nestjs/throttler`, como guard global executado antes da autenticação: `THROTTLE_LIMIT` (padrão 100) requisições por janela de `THROTTLE_TTL_SECONDS` (padrão 60 s) em todas as rotas exceto `GET /health`, `THROTTLE_AUTH_LOGIN_LIMIT` (10) em `POST /auth/login` e `THROTTLE_AUTH_REGISTER_LIMIT` (5) em `POST /auth/register`. Acima do limite: 429 com mensagem em português e `Retry-After`. `THROTTLE_DISABLED=true` desliga (testes). `TRUST_PROXY` (`false`, `true` ou número de saltos; padrão `false` no app e `1` no compose) define se o IP vem do `X-Forwarded-For`.
- **Guard JWT global** (`APP_GUARD`) com `@Public()` em `auth` e `health`: toda rota nova nasce protegida.
- **SSL do banco** controlado por `DATABASE_SSL` (`false`, `require`, `verify-full`), desacoplado do `NODE_ENV`; a imagem de produção roda com `NODE_ENV=production`.
- **Swagger** controlado por `SWAGGER_ENABLED` (padrão `true`); **CORS** sem `credentials` (a autenticação é por header); `x-request-id` do cliente só é aceito se casar `/^[\w-]{1,64}$/`.
- **Seed** recusa rodar com `NODE_ENV=production` sem `SEED_ALLOW_PROD=true`.
- **Diretório de usuários:** `GET /users` exige `email` ou `name` com 3 ou mais caracteres; desde D-028, só para quem é `owner` ou `admin` de algum projeto e com no máximo 10 itens por página.
- **CSV:** neutralização de fórmulas e limite de 5000 linhas (D-014); **login** compara a senha mesmo para e-mail inexistente (hash falso), para não vazar por tempo de resposta quais e-mails existem.
- **Erros de banco** em corrida (23505, 23503, 22P02) viram 409/409/400 em vez de 500; criação de projeto e remoção de membro rodam em transação.

**Justificativa:** Cada item fecha um achado concreto da revisão sênior: força bruta em login e cadastro em massa (rate limit, mais rígido onde importa), esquecimento de `@UseGuards` (guard global, seguro por padrão), TLS sem validação atrelado a `NODE_ENV` (variável própria), contas de senha conhecida em ambiente real (guarda no seed), enumeração de e-mails (busca com mínimo de caracteres e comparação de senha constante) e injeção de fórmulas em planilhas. O rate limit usa o armazenamento em memória do throttler: simples e suficiente para uma instância.

**Alternativas descartadas:**
- *Rate limit só no nginx*: não conhece as rotas de autenticação nem o contrato de erro em português (avaliada na época).
- *Rate limit com Redis desde já*: dependência a mais para uma instância; registrado como evolução para escalar horizontalmente.
- *Bloqueio de conta após N tentativas*: abre vetor de negação de serviço contra uma conta específica; o limite por IP foi preferido (avaliada na época).
- *Validar o certificado do banco sempre*: o Postgres do compose não oferece SSL; por isso é configurável.

**Limitações:** o rate limit é por instância (memória), e `TRUST_PROXY=1` faz a API confiar no `X-Forwarded-For` também de quem acessa a porta 3000 diretamente; em produção, publique só o nginx.

---

## D-026 - Serviço `migrate` one-shot no compose

**Contexto:** Com D-018, a API não migra no boot; mas isso fazia o `docker compose up` entregar uma API que respondia 500 até alguém rodar `migration:run` à mão, e um clone novo ainda exigia criar o `.env` sem exemplo.

**Decisão:** O `docker-compose.yml` ganhou o serviço **`migrate`**, de uso único: usa a mesma imagem da API (`api-projetos-tarefas/backend:local`, construída uma só vez), roda `npm run migration:run`, depende do Postgres saudável (`service_healthy`) e termina com `restart: no`. A API (`backend`) depende de `migrate` com `condition: service_completed_successfully`, e o frontend depende da API saudável. Há um `.env.example` na raiz (`cp .env.example .env`) com todas as variáveis do compose; só `JWT_SECRET` é obrigatória. Fluxo completo: `cp .env.example .env` → `docker compose up -d --build` → (opcional) `docker compose exec -e SEED_ALLOW_PROD=true backend npm run seed:run`. Depois da subida, `api-migrate` aparece como `Exited (0)`, o que é esperado. O CI valida o compose com `docker compose --env-file .env.example config`.

**Justificativa:** Mantém a regra de D-018 (a API nunca migra no boot) e deixa a subida em um comando. O serviço roda uma vez e termina; se falhar, a API não sobe e o erro aparece em `docker compose logs migrate`.

**Alternativas descartadas:**
- *`migrationsRun: true` na API*: contraria D-018.
- *Entrypoint do backend rodando `migration:run` antes de `node dist/main.js`*: duas réplicas migrariam ao mesmo tempo, e uma falha de migration reiniciaria o container em loop (avaliada na época).
- *Manter o passo manual no Docker*: primeira impressão ruim, API quebrada logo após o `up`.

---

## D-027 - Quem não é membro recebe 404

**Contexto:** O QA (PRJ-20) mostrou que um id de projeto alheio respondia 403 (`Você não faz parte deste projeto.`) e um id inexistente respondia 404: a diferença confirmava que o projeto existe. O UUID v4 dificulta adivinhar ids, mas um id vazado (log, link, print) bastava para saber que ele é válido.

**Decisão:** Em **todos** os endpoints de um projeto (`GET/PATCH/DELETE /projects/:projectId`, membros, tarefas, exportação e importação de CSV e `GET /reports?projectId=`), quem não é membro recebe a mesma resposta de um id inexistente: **404 `Projeto não encontrado.`**. Quem é membro, mas não tem o papel necessário, continua recebendo **403 `Seu papel no projeto não permite esta ação.`**. A regra mora em `ProjectAccessService.requireRole`, que agora faz **uma única consulta** (o vínculo em `project_members`: se ele existe, o projeto existe, por causa da FK com cascade). O `ProjectsService` checa o acesso **antes** de carregar o projeto. No frontend, 400/403/404 de projeto mostram `Projeto não encontrado ou você não tem acesso a ele.` com o botão **Voltar para projetos** (sem "Tentar novamente", que não resolveria).

**Justificativa:** Não confirmar a existência de recursos alheios é a prática recomendada contra enumeração (OWASP); o 403 continua útil para o membro, que sabe que o projeto existe e precisa saber por que a ação foi negada. A validação do arquivo de importação também roda só depois do acesso: um não-membro não aprende nada sobre o arquivo nem sobre o projeto.

**Alternativas descartadas:**
- *Manter o 403 para não-membro*: mensagem mais explícita, mas permite enumerar ids válidos.
- *404 também para o membro sem papel*: esconderia de quem já vê o projeto o motivo da recusa.

---

## D-028 - Busca de usuários restrita a quem gerencia membros

**Contexto:** `GET /users` (MEM-15) servia a qualquer pessoa autenticada e devolvia até 100 usuários por página: com termos de 3 letras dava para varrer o diretório de e-mails.

**Decisão:** A busca continua exigindo 3+ caracteres em `email` ou `name`, e passa a:
- exigir que quem busca seja `owner` ou `admin` de **pelo menos um projeto** (é para isso que a busca existe: adicionar membros). Os demais recebem **403 `Você não tem permissão para buscar usuários.`**, checado antes do termo;
- aceitar no máximo **10 itens por página** (`limit` padrão e máximo 10; `limit=11` é 400 `O campo "Limite" deve ser menor ou igual a 10.`);
- devolver só `id`, `name` e `email`, como antes.

O endpoint passou do `UsersModule` para o `ProjectsModule` (`UserSearchController`, rota `GET /users` inalterada) e a regra fica em `ProjectMembersService.searchUsers`: a permissão depende dos vínculos de projeto, e o `ProjectsModule` já depende do `UsersModule`; o caminho inverso criaria dependência circular. O modal "Adicionar membro" pede 10 por vez e avisa quando há mais resultados ("Digite mais do e-mail para refinar a busca").

**Justificativa:** Reduz a superfície de enumeração ao mínimo que o caso de uso exige (quem pode convidar), sem mudar o contrato da resposta nem o fluxo de quem administra projetos.

**Alternativas descartadas:**
- *Buscar só por e-mail completo*: impede a enumeração, mas piora o fluxo de convite (avaliada).
- *Guard no `UsersController` com `forwardRef` entre os módulos*: dependência circular entre módulos para uma regra que pertence a membros.

---

## D-029 - Busca sem diferenciar acentos (unaccent)

**Contexto:** As buscas usavam `ILIKE`, que só ignora maiúsculas: `descricao` não encontrava `Descrição` (TAR-10), o que em português é a regra, não a exceção.

**Decisão:** Uma migration nova, `1792681800006-EnableUnaccentExtension`, habilita a extensão **`unaccent`** do PostgreSQL (`CREATE EXTENSION IF NOT EXISTS unaccent`; `down`: `DROP EXTENSION IF EXISTS unaccent`). As buscas de projetos (nome e descrição), tarefas (título e descrição) e usuários (nome e e-mail) comparam `unaccent(coluna) ILIKE unaccent(:termo)`, mantendo o escape de `%`, `_` e `\` (o termo continua literal). A extensão faz parte do contrib oficial e vem nas imagens `postgres:17-alpine` do compose e do CI; é "trusted", então não exige superusuário. O setup dos e2e aplica as migrations de `src`, então os testes rodam com a extensão.

**Justificativa:** Resolve o caso no banco, para todas as buscas, sem duplicar colunas. O custo conhecido é que `unaccent(coluna)` não usa índice btree; as buscas já eram `ILIKE '%termo%'` (que também não usa), sempre filtradas por projeto ou por usuário e paginadas.

**Alternativas descartadas:**
- *Colunas normalizadas (sem acento) gravadas pela aplicação*: duplica dados e exige migração de dados e manutenção em toda escrita.
- *Índice trigram (`pg_trgm`) com `unaccent` imutável*: o volume do desafio não justifica; fica como evolução se a busca pesar.
- *Normalizar no frontend*: não resolve, o texto acentuado está no banco.

---

## D-030 - CSV com BOM, validação do arquivo e status flexível

**Contexto:** O QA apontou que um PNG, um JSON ou um texto qualquer viravam "título obrigatório" por linha ou "0 tarefa(s) importada(s)" sem explicação (CSV-05), que `Em Andamento` era recusado sem dizer os valores aceitos (CSV-11), que o Excel em português mostrava os acentos errados (TRV-26) e que exportar e importar de volta invertia a ordem (D-014, D-020).

**Decisão:**
- **Exportação em UTF-8 com BOM** (`EF BB BF` no início) e em **ordem cronológica** (`createdAt asc, id asc`). O frontend baixa o arquivo como `Blob` (lido como texto, o navegador descartaria o BOM).
- **Validação do arquivo**, depois da checagem de acesso e antes de qualquer gravação: byte nulo, conteúdo que começa com `{` ou `[` (JSON) ou aspas quebradas -> 400 `O arquivo enviado não parece ser um CSV válido.`; cabeçalho sem a coluna `titulo` -> 400 `Cabeçalho inválido: o CSV precisa ter a coluna "titulo" (colunas aceitas: titulo, descricao, status, responsavel_email, data_limite).`; nenhuma linha depois do cabeçalho -> 400 `O arquivo enviado não parece ser um CSV válido: não há nenhuma linha de tarefa depois do cabeçalho.`.
- **Nomes de coluna e status normalizados** (sem espaços nas bordas, minúsculas, sem acento, espaço/hífen viram `_`): `Título`, `Data limite`, `Em Andamento`, ` PENDENTE `, `Concluída` são aceitos. Colunas desconhecidas são ignoradas. Status ainda inválido vira erro da linha com a lista: `Status inválido: "xyz". Use: pendente, em_andamento ou concluida.`.
- A importação aceita o arquivo com ou sem BOM, por multipart (o frontend envia o próprio arquivo, sem relê-lo como texto) ou `text/csv`.
- No modal de importação, os 400 aparecem no próprio modal e "todas as linhas com erro" mostra `Nenhuma tarefa foi importada: …` com a lista de linhas.

**Justificativa:** Erro de formato é do arquivo inteiro, não de cada linha; dizer o motivo uma vez é mais útil. O BOM é o que o Excel usa para detectar UTF-8, e os importadores que não o esperam (inclusive o nosso, por `csv-parse`) o tratam. Aceitar variações de escrita do status evita retrabalho com planilhas preenchidas à mão.

**Alternativas descartadas:**
- *Detectar a codificação (Latin-1/Windows-1252)*: exigiria heurística ou dependência; o formato aceito continua sendo UTF-8.
- *Avisos de colunas ignoradas na resposta*: mudaria o contrato `{created, errors}` por pouco ganho (as colunas aceitas estão na mensagem de cabeçalho inválido).
- *Exportar sem BOM e documentar "abra pelo assistente de importação do Excel"*: transfere o problema para quem usa.

---

## D-031 - Entrada sem conversão implícita, limites da conta e aviso de JWT_SECRET

**Contexto:** `POST /tasks` com `{"title": 123}` criava a tarefa "123" (API-03): o `ValidationPipe` usava `enableImplicitConversion`, que converte o corpo pelo tipo declarado antes de validar. O cadastro aceitava nome e senha de 500 caracteres (API-04); como o bcrypt só considera os primeiros 72 bytes, uma senha maior era truncada em silêncio, e textos enormes viravam custo de hash no login. E a API subia com o `JWT_SECRET` público do `.env.example` sem avisar (TRV-20).

**Decisão:**
- O `ValidationPipe` global é criado em um lugar só (`createValidationPipe`, usado pelo `configureApp` e pelos testes) com **`enableImplicitConversion: false`**: número ou booleano no corpo cai no `@IsString` (`O campo "Título" deve ser um texto.`). A query string, que sempre chega como texto, declara a conversão onde precisa (`@Type(() => Number)` em `page` e `limit`).
- Limites: nome até **120**, e-mail até **254**, senha de **6 a 72** caracteres no cadastro; no login, e-mail até 254 e senha até 72 (o 400 vem antes do bcrypt). O frontend aplica os mesmos `maxLength`. Projeto (nome 120, descrição 2000) e tarefa (título 200, descrição 4000) já tinham limites e foram mantidos.
- **Aviso no boot** (`config/env/jwt-secret.check.ts`, chamado no `main.ts`): se o `JWT_SECRET` contém o trecho do exemplo (`troque-este-valor`) ou outros marcadores de exemplo (`changeme`, `secret`, `segredo`) ou tem menos de 10 caracteres distintos, a API registra um `WARN` pedindo um segredo próprio (`openssl rand -hex 32`). Não impede a subida.

**Justificativa:** Conversão implícita esconde erros de quem integra e grava dados que ninguém enviou; o tipo errado deve ser 400. Os limites da conta fecham o truncamento silencioso do bcrypt (em caracteres; um texto com letras acentuadas ocupa mais bytes, então senhas acentuadas perto de 72 caracteres ainda podem passar de 72 bytes, limitação registrada no README) e um vetor barato de negação de serviço. Recusar o segredo de exemplo quebraria o `cp .env.example .env && docker compose up -d --build` prometido para avaliação local; o aviso deixa o risco visível sem quebrar esse fluxo.

**Alternativas descartadas:**
- *`@Type(() => String)` / transformações por campo*: continua convertendo em silêncio.
- *Recusar o segredo de exemplo no boot*: quebra a subida em um comando (decisão do maestro).
- *Limite da senha em bytes*: mensagem difícil de entender para quem cadastra; o limite em caracteres resolve o caso comum.

---

## D-032 - Cabeçalhos de segurança e cache no nginx, sem source maps

**Contexto:** A API e o Swagger já tinham os cabeçalhos do helmet, mas o HTML e os assets do SPA, servidos pelo nginx do frontend, não tinham nenhum (TRV-17); o build publicava os `.map` com o código-fonte (TRV-19); e, sem `Cache-Control`, o navegador podia reaproveitar um `index.html` antigo depois de um deploy (visto na verificação: o portal abriu o bundle anterior).

**Decisão:**
- `docker/nginx-security-headers.conf`, incluído **só** nas locations do SPA (`/` e `/assets/`), com `always`: `Content-Security-Policy` (`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (câmera, microfone, geolocalização, pagamento e USB desligados) e `Cross-Origin-Opener-Policy: same-origin`. As rotas com proxy (`/api/`, `/docs`) não têm `add_header`: ficam só os cabeçalhos do helmet, sem duplicar (o Swagger UI precisa da CSP do helmet).
- `index.html` com `Cache-Control: no-cache` (revalida a cada visita); assets com hash continuam `public, immutable` por 1 ano. `server_tokens off`.
- `vite.config.ts` com `sourcemap: false`: `/assets/*.js.map` responde 404.

**Justificativa:** A CSP sem `unsafe-inline` é possível porque o build do Vite só gera `<script type="module" src>` e `<link rel="stylesheet">`, e os estilos dinâmicos do React passam pelo CSSOM (não são bloqueados). Colocar os cabeçalhos no nível do `server` faria as locations com proxy herdá-los e duplicar os do helmet (e um `add_header` em uma location desliga a herança, por isso o arquivo é incluído inteiro em cada location do SPA).

**Alternativas descartadas:**
- *`add_header` no nível do server*: duplicaria e contradiria os cabeçalhos da API.
- *`sourcemap: 'hidden'` com bloqueio dos `.map` no nginx*: útil com um serviço de rastreamento de erros, que o projeto não tem.
- *HSTS no nginx*: o compose serve HTTP; HSTS pertence ao proxy com TLS de produção.

---

## D-033 - Robustez da interface: estado do projeto, confirmação e quadro com teto

**Contexto:** O QA encontrou telas "pela metade" e fluxos frágeis: depois de uma falha de rede ao entrar em Tarefas/Quadro, "Tentar novamente" recarregava só as tarefas e a tela ficava sem o nome do projeto e em modo somente leitura até o F5 (TRV-11); erros 403/404/400 ofereciam "Tentar novamente" (PRJ-19); a lista não editava responsável nem prazo (TAR-06); exclusões usavam `window.confirm`; depois de Sair, o login de outra pessoa voltava para a rota de quem saiu (AUT-24); o quadro com 5.047 tarefas criava 35 mil nós no DOM e precisaria de mais de 100 requisições por minuto acima de ~9.900 tarefas (KAN-15); o campo "Adicionar" ficava no fim da coluna (KAN-11); o placeholder da busca era cortado (PRJ-08) e não havia skip-link nem título por rota (TRV-25).

**Decisão:**
- **Estado do projeto** (`features/projects/ProjectUnavailable`): Detalhe, Tarefas, Quadro e Membros só renderizam depois que o projeto (e o papel do usuário) carregou; antes, esqueleto. Erro passageiro (rede, 5xx, 429; `isRetryableError`) mostra "Tentar novamente", que recarrega **projeto, membros e a lista**; 400/403/404 mostram `Projeto não encontrado ou você não tem acesso a ele.` e "Voltar para projetos". O relatório com um projeto alheio no filtro oferece "Ver todos os meus projetos".
- **Detalhe da tarefa único** (`features/tasks/TaskDetailsModal`): o mesmo modal no quadro (clique no cartão) e na lista (o título é um botão, com foco visível, Enter abre), com título, descrição, responsável (trocar e remover), status, data limite e excluir; somente leitura para `viewer`. O select de status continua na linha.
- **`ConfirmDialog`** (`components/ui/ConfirmDialog` + `stores/confirmStore` + `useConfirm`): sobre o `Modal`, `role="alertdialog"`, foco inicial em Cancelar, Esc e clique no fundo cancelam, a ação roda dentro do diálogo com o botão em carregamento (mesma largura) e o diálogo travado; falha fecha o diálogo e vira toast. O `Modal` ganhou pilha (só o do topo responde a Esc e Tab) para a confirmação abrir sobre o detalhe da tarefa.
- **Sessão:** Sair marca a saída voluntária (as rotas protegidas levam à home, sem guardar a rota); 401 guarda o id do usuário da sessão expirada, e o login seguinte só volta para a rota de origem se for o **mesmo** usuário (`postLoginPath`). `/login` e `/register` redirecionam quem já tem sessão (`GuestOnly`, único lugar que decide o destino depois de entrar). O erro antigo do formulário some ao editar e quando o navegador barra o envio; `autocomplete` correto nos campos.
- **Quadro:** carrega no máximo **5.000 tarefas** (50 páginas de 100) e avisa `Exibindo as 5.000 tarefas mais recentes. Use a busca ou os filtros para refinar.`; cada coluna mostra 50 cartões por vez ("Mostrar mais (N restantes)") com o total real no cabeçalho, tem altura máxima pela viewport (`--spacing-kanban-column`) com rolagem própria e a criação rápida no topo. O indicador "Carregando tarefas… (página X de Y)" continua.
- **Busca:** a área da direita do campo (selo "Enter" ou "Limpar") só reserva espaço quando aparece, então o placeholder sai completo de 390px a 1440px; "Limpar" devolve o foco ao campo.
- **Acessibilidade:** link "Pular para o conteúdo" nos dois layouts e `<title>` por rota (`useDocumentTitle`: `Projetos · Gestão de Projetos e Tarefas`, `Tarefas — <projeto> · …`). Relatório mostra `<1%` para valores acima de zero e abaixo de 1%.

**Justificativa:** Cada item fecha um achado do QA sem trocar de stack: os estados de erro passam a refletir o que dá para fazer, a edição da tarefa tem um único código para lista e quadro, a confirmação segue o design system e o quadro tem custo limitado no navegador e no rate limit.

**Alternativas descartadas:**
- *Virtualização do quadro (react-window)*: dependência e complexidade a mais com arrastar e soltar entre listas; janelas de 50 cartões resolvem o volume do desafio.
- *Endpoint de quadro por coluna*: muda a API; fica como evolução (README, seção 14).
- *Biblioteca de diálogos (Radix, Headless UI)*: o `Modal` do design system já tinha foco, animação e acessibilidade; faltava só a pilha.

---

## D-034 - Lint e testes do frontend

**Contexto:** O frontend tinha só `tsc` e build (revisão sênior): sem lint, sem testes, e com `lucide-react` instalado sem uso.

**Decisão:** `oxlint` (o mesmo do backend) com os plugins `react`, `jsx-a11y`, `typescript`, `unicorn`, `oxc` e `vitest`, em `frontend/.oxlintrc.json`, rodando com `--deny-warnings` (`npm run lint`: aviso também falha). A regra `jsx-a11y/prefer-tag-over-role` fica **desligada**, com o motivo no arquivo: ela pede `<output>` no lugar de `role="status"` (regiões `aria-live` que não são resultado de formulário), `<dialog>` no lugar do `Modal` (que tem foco, pilha e animação próprios) e `<progress>` na barra indeterminada; os papéis usados são os do WAI-ARIA APG. A regra `react/set-state-in-effect` é desligada **linha a linha**, com motivo, só nos efeitos que disparam a busca de dados (D-007); os demais avisos foram corrigidos no código (`ActivityBar` sem estado derivável, `Toast` ajustando o estado no render, refs do `Modal` atualizados em efeito, cartão do Kanban com botão em vez de `role="button"`, fundo do modal com `role="presentation"`). **Vitest** em ambiente node para a lógica pura (D-008), sem jsdom: `npm run test`. `lucide-react` removido. O CI roda lint, typecheck, testes e build do frontend.

**Justificativa:** Uma ferramenta de lint para o monorepo, rápida e com regras de hooks e acessibilidade; testes da lógica que decide permissões, mensagens e redirecionamentos, onde um erro passaria despercebido no `tsc`.

**Alternativas descartadas:**
- *ESLint + plugins*: mais configuração e mais lento, sem ganho para este código.
- *jsdom + Testing Library já nesta entrega*: mais dependências; os componentes visuais foram verificados no navegador (relatório de verificação) e ficam para a próxima camada de testes.
- *Desligar `react/set-state-in-effect` no projeto inteiro*: esconderia efeitos novos que não são busca de dados.
