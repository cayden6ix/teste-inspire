# Design system do frontend

Tailwind v4 (`@tailwindcss/vite`) com tokens definidos em **um unico lugar**: o bloco `@theme` de
`src/styles/global.css`. Componentes em `src/components/ui` consomem esses tokens; paginas e
modais **so compoem componentes**.

## Regra de ouro

> Use `<Button>`, `<ButtonLink>`, `<Input>`, `<Select>`, `<Textarea>` e `<FormField>`.
> **Nunca** defina altura, padding, fonte ou raio de controle na pagina (`h-9`, `px-3`, `py-1.5`,
> `text-sm`, `rounded`...). Se faltar algo, ajuste o token ou o componente, nao a pagina.

Classes de tamanho avulsas (`h-[..]`, `px-[..]`, `text-[..]`) e `className` que mexa na altura de
controle sao proibidas. `className` nos componentes serve para **layout** (`w-full`, `mr-auto`,
`self-start`, `md:col-span-2`), nunca para dimensionar o controle.

## Tokens

### Controles (Button, Input, Select, Textarea, so-icone)

| Token | Valor | Classe | Uso |
|---|---|---|---|
| `--spacing-control` | 40px | `h-control`, `w-control` | altura **unica** de todo botao e campo de 1 linha; so-icone e quadrado 40x40 |
| `--spacing-button` | 96px | `min-w-button` | largura minima de botao com texto (Cancelar, Salvar, Sair... ficam iguais) |
| `--spacing-control-sm` | 32px | `h-control-sm` | variante `sm`: **somente** acao embutida dentro de um campo (ex.: Limpar da busca) |

Padding horizontal: botao `px-4` (16px), campo `px-3` (12px), fonte `text-body` (14px), raio
`rounded-control`. `Textarea`: `py-2` e `min-h-control`.

### Espacamento (escala 4 / 8 / 12 / 16 / 24 / 32)

Use apenas os degraus `1, 2, 3, 4, 6, 8` do Tailwind (4, 8, 12, 16, 24, 32px) em `p-*`, `m-*`,
`gap-*`. Nada de `0.5`, `1.5`, `2.5`, `5`, `7`.

| Contexto | Valor | Classe |
|---|---|---|
| Secoes da pagina (`<Page>`) | 24px | `gap-6` |
| Entre campos de um formulario | 16px | `gap-4` |
| Rotulo -> campo / dica | 8px | `mb-2` / `mt-2` |
| Entre botoes e controles de uma barra | 12px | `gap-3` |
| Cartao, secao e modal (padding) | 24px | `p-card`, `px-card`, `py-card` |
| Barras compactas: toolbar, tabela, rodape, coluna do Kanban, cartao do Kanban | 16px | `p-compact`, `px-compact` |
| Margem lateral da pagina | 16 -> 24 -> 32px | `px-gutter` |
| Margem vertical da pagina | 24 -> 32px | `py-page` |

### Listagens

| Token | Valor | Classe |
|---|---|---|
| `--spacing-row` | 56px | `h-row`, `min-h-row` (linha de tabela/lista; cabe um botao de 40px com 8px de folga) |
| `--spacing-table-head` | 40px | `h-table-head` (cabecalho) |
| `--spacing-kanban-column` | `100dvh - 12rem` | `max-h-kanban-column` (coluna do Kanban rola sozinha; 50 cartoes por vez com "Mostrar mais") |

`DataTable` usa esses tokens para a altura de linha, cabecalho, esqueleto e altura minima da lista.

### Raios (so 3)

| Token | Valor | Uso |
|---|---|---|
| `rounded-control` | 6px | botoes, campos, alertas, cartoes do Kanban |
| `rounded-surface` | 8px | cartoes, modais, tabelas, barras, colunas |
| `rounded-pill` | 9999px | badges e barras de progresso |

Os raios padrao do Tailwind foram zerados (`--radius-*: initial`): `rounded`, `rounded-lg` etc. **nao existem**.

### Tipografia

Os tamanhos padrao do Tailwind (`text-sm`, `text-xl`...) foram zerados; use os semanticos:

| Classe | Tamanho / linha | Uso |
|---|---|---|
| `text-display` | 36 / 40px | chamada da tela de Login/Cadastro |
| `text-title` | 24 / 32px | titulo de pagina (`h1`), numeros dos relatorios |
| `text-heading` | 16 / 24px | titulo de secao/cartao/modal, marca no cabecalho |
| `text-body` | 14 / 20px | texto corrido, botoes, campos, tabelas |
| `text-label` | 14 / 20px (`font-medium`) | rotulo de campo |
| `text-caption` | 12 / 16px | legendas, badges, cabecalho de tabela, dicas |

### Modais

`max-w-modal-sm` (384px), `max-w-modal-md` (512px, padrao), `max-w-modal-lg` (672px). Cabecalho,
corpo e rodape usam `px-card`; rodape alinhado a direita com `gap-3` e botoes de 40px.

## Componentes

| Componente | Observacao |
|---|---|
| `Button` / `ButtonLink` | variantes `primary`, `secondary`, `danger`, `ghost`; **todas** com 40px, `min-w-button`, `text-body`, icone+texto com `gap-2`. `iconOnly` = quadrado 40x40. `buttonClass()` serve para `NavLink`. Link com aparencia de botao: use `ButtonLink`. |
| `Input`, `Select`, `Textarea`, `FormField` | altura 40px, igual a do botao, em formulario, barra de filtros e linha de tabela. Nao ha mais "densidade". |
| `Badge` | 24px de altura, `text-caption`, pilula |
| `Card` | `p-card`, `rounded-surface`, titulo `text-heading` |
| `Page` / `PageHeader` | raiz de pagina (`gap-6`) e cabecalho com titulo, descricao e acoes |
| `Toolbar`, `SearchBox`, `FilterSelect`, `ClearFilters`, `ResultCount` | todos os controles com 40px; `FilterSelect` tem largura unica (`sm:w-56`). No `SearchBox`, a area da direita (`pr-field-action`, 96px) so e reservada quando aparece o selo `Enter` (busca pendente) ou o `Limpar`: com o campo vazio o placeholder usa a largura toda. A dica "Pressione Enter para buscar" fica no `title` do selo e no `aria-describedby`; `Limpar` devolve o foco ao campo |
| `DataTable`, `Pagination` | linha 56px, cabecalho 40px; paginacao com os mesmos botoes de 40px |
| `Modal`, `FormModal` | tamanhos `sm/md/lg`, rodape padrao; `role` `dialog` (padrao) ou `alertdialog`; foco inicial no elemento com `data-autofocus`; modais empilhados: so o do topo responde a Esc e Tab |
| `ConfirmDialog` (`ConfirmDialogHost` no App) + `useConfirm()` | confirmacao de acao destrutiva no lugar do `window.confirm`: `alertdialog` `sm`, titulo ("Excluir projeto?"), descricao com o nome do item, Cancelar (foco inicial) + botao `danger` que roda a acao com `loading` (mesma largura); Esc e fundo cancelam |
| `SkipLink` | "Pular para o conteudo", primeiro focavel dos layouts; fora da tela ate receber foco (so `translate`), leva o foco ao `<main id="conteudo">` |
| `EmptyState`, `Skeleton` | `Skeleton` tem variantes (`line`, `control`, `row`, `stat`, `card`) derivadas dos tokens |
| `AuthLayout` (`src/app`) | Login/Cadastro em tela inteira: painel de identidade (>= lg) + formulario fluido |

## Movimento

Feedback e transições seguem o mesmo princípio dos tokens de tamanho: **um lugar só** (`global.css`) e
nada de valores avulsos (`duration-[..]`, `delay-[..]`, curvas inline). Anima-se **somente `opacity` e
`transform`** (a única exceção seria colapsar altura de linha; hoje a saída de linha é um fade).

### Tokens (`@theme static` em `src/styles/global.css`)

| Token | Valor | Uso |
|---|---|---|
| `--duration-fast` | 150ms | hover/foco/active, **saídas** (modal, toast, linha), atraso da barra de atividade |
| `--duration-base` | 200ms | **entradas** (rota, modal, toast, cartão do Kanban) |
| `--duration-slow` | 300ms | teto: crescimento das barras de relatório; nada passa disso |
| `--stagger-step` | 8ms | atraso por linha de lista (máx. 15 linhas = 112ms) |
| `--ease-enter` | `cubic-bezier(0.16, 1, 0.3, 1)` | desacelera ao entrar |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | acelera ao sair |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | transições de estado (hover, foco) |
| `--spacing-spinner` / `-lg` | 16px / 32px | `size-spinner`, `size-spinner-lg` |
| `--spacing-activity-bar` | 4px | `h-activity-bar` (barra global no topo) |

`--default-transition-duration/-timing-function` apontam para `fast` + `standard`: todo `transition`,
`transition-colors`, `transition-opacity`... do Tailwind já usa os tokens.

### Utilitários (`@utility animate-*`)

`animate-fade-in`, `animate-fade-out`, `animate-slide-up` (conteúdo de rota), `animate-overlay-in/out`,
`animate-dialog-in/out`, `animate-toast-in/out`, `animate-row-in/out`, `animate-settle` (cartão do Kanban),
`animate-spinner`, `animate-progress` (barra indeterminada), `animate-bar-grow` (barras de relatório) e
`skeleton-shimmer` (brilho do `Skeleton`). Entradas usam `fill-mode: backwards` (não deixam `transform`
residual, que quebraria `position: fixed` dos descendentes); saídas usam `forwards`.

### `prefers-reduced-motion: reduce`

O bloco ao final de `global.css` zera `transition-duration` e `animation-duration` de tudo e ainda define
regras **por animação**: entradas e saídas viram um fade de 150ms (sem deslocamento nem escala); o spinner
e a barra de atividade só pulsam em opacidade; o shimmer some (esqueleto estático); as barras de relatório
já nascem preenchidas. Toda animação nova precisa de uma regra nesse bloco.

### Componentes e hooks

| Peça | O que faz |
|---|---|
| `ui/PageTransition` | envolve o `<Outlet />` dos dois layouts; chave por `pathname`: conteúdo entra com `animate-slide-up` sem piscar o cabeçalho; a cada navegação leva a rolagem ao topo, foca o contêiner (`tabIndex=-1`) e anuncia `Página: {h1}` em `role="status"` |
| `ui/ActivityBar` + `services/api/activity.ts` | barra fina no topo, `role="progressbar"` (indeterminada) + `aria-busy`; os interceptors do `httpClient` contam requisições; só aparece depois de 150ms e some com fade |
| `ui/Spinner` | SVG inline (`size="sm"` 16px, `"lg"` 32px); com `label` vira `role="status"` |
| `Button loading loadingLabel` | enquanto `loading`: **spinner centralizado no lugar do texto**, `disabled` e `aria-busy`. O rótulo fica invisível mas continua ocupando espaço: a largura e a altura são **sempre** as do repouso (`min-w-button` 96px etc.). O texto de andamento (`Salvando…`, `Entrando…`, `Excluindo…`, `Importando…`, `Exportando…`) vai para um `role="status"` sr-only e para o `title`. Passe sempre um booleano em `loading`. |
| `Select saving` | desabilita o select e mostra spinner discreto ao lado da seta (PATCH da linha) |
| `Toast` (`ToastProvider`, `useToast`, `stores/toastStore`) | toasts empilhados no canto; regiões `aria-live="polite"` (sucesso/info) e `"assertive"` (erro/aviso) sempre presentes; ~4s sucesso, ~7s erro; fechar; pausa no hover/foco; entrada e saída animadas; mesmo `id` substitui (erros de rede não empilham). `utils/notify.notifyError(err, título)` mostra a `message` em português da API (array vira lista curta) |
| `Modal` | entrada **e saída**: todo pedido de fechar (Esc, fundo, X, `ModalCloseButton`, `closing`) toca a saída e só então chama `onClose` (o pai desmonta). `FormModal.onSubmit` devolve `true` para fechar com animação após salvar |
| `DataTable` | esqueleto com shimmer; linhas entram com fade escalonado (`--row-index`); `rowState` (`saving`/`deleting`/`removing`) e `onRetry` ("Tentar novamente" no erro) |
| `ui/ErrorState` | `Alert` + botão "Tentar novamente" (`onRetry`) e/ou uma ação própria (`action`, ex.: "Voltar para projetos") |
| `features/projects/ProjectUnavailable` | esqueleto enquanto o projeto carrega; erro passageiro (rede, 5xx, 429) com "Tentar novamente" que recarrega projeto, papel e listas; 400/403/404 com "Projeto não encontrado ou você não tem acesso a ele." e "Voltar para projetos" |
| `hooks/useDocumentTitle` | `<title>` por rota: `Projetos · Gestão de Projetos e Tarefas`, `Tarefas — <projeto> · …` |
| `hooks/useRowStates` | estado por linha (`saving` select, `deleting` botão, `removing` animação de saída) |
| `utils/motion` | `motionMs('fast'|'base'|'slow')` lê os tokens do CSS; `delay()` |

### Regras para novas telas

1. Ação que chama a API: `<Button loading loadingLabel="…">`; nunca esconda ou troque o rótulo por `…`.
2. Resultado de ação: `useToast()` (sucesso) / `notifyError()` (erro). Erro de validação **dentro de modal** continua inline.
3. Listagem: `DataTable` (já traz esqueleto, fade, erro com retry). PATCH/DELETE por linha: `useRowStates`.
4. Modal: `Modal`/`FormModal`; botões de dentro que fecham usam `ModalCloseButton`. Exclusão: `useConfirm()` (nunca `window.confirm`).
5. Tela de um projeto: renderize so depois de o projeto carregar (`ProjectUnavailable` antes) e chame `useDocumentTitle`.
6. Nova animação: keyframe + `@utility` em `global.css` usando os tokens, **mais** a regra em `prefers-reduced-motion`.

### Como verificar

`document.getAnimations()` durante a ação: nenhuma duração acima de `--duration-slow`; `PerformanceObserver`
`layout-shift` (sem entradas na troca de rota) e `longtask` (vazio).

## Excecoes documentadas

- **`Button size="sm"` (32px)**: apenas o "Limpar" dentro do campo de busca (40px de altura).
  Nao use em paginas, tabelas ou modais.
- **Cartoes do Kanban e linhas empilhadas em < md**: a altura acompanha o conteudo (titulo,
  descricao, selos); padding, gap e raio seguem os tokens.
- **Selects/inputs de varias linhas**: `Textarea` cresce com `rows`.

## Como verificar

1. `npm run lint`, `npm run typecheck`, `npm run test` e `npm run build`.
2. `rg '\b(h|px|py|text|rounded)-\[' src` nao deve retornar nada.
3. No navegador, `getBoundingClientRect()` de qualquer `button`, `a` com aparencia de botao,
   `input` e `select` deve dar **40px** de altura (32px so no "Limpar" da busca).
