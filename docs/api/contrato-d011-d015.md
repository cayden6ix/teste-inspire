CONTRATO DE ENDPOINTS - D-011 a D-015 (ATUALIZADO)

Base: http://localhost:3000/api
Auth: Authorization: Bearer <access_token>
Erros: {statusCode,error,message,path,timestamp,requestId}
  error = codigo estavel em maiusculas (BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, PAYLOAD_TOO_LARGE, TOO_MANY_REQUESTS). NUNCA traduzido.
  message = SEMPRE em portugues do Brasil. String para erros de dominio e de status; lista de strings na validacao (400).
  Formato de cada mensagem de validacao: O campo "<rotulo>" <regra>.
  requestId = header x-request-id recebido (aceito so se casar /^[\w-]{1,64}$/, ex.: UUID), senao UUID gerado; tambem vem no header de resposta x-request-id
  Ex. validacao: {"statusCode":400,"error":"BAD_REQUEST","message":["O campo \"Limite\" deve ser menor ou igual a 100."],"path":"/api/projects?limit=101","timestamp":"2026-10-22T12:00:00.000Z","requestId":"3f2b8c1e-..."}
  Ex. dominio: {"statusCode":409,"error":"CONFLICT","message":"Este e-mail já está cadastrado.","path":"/api/auth/register","timestamp":"...","requestId":"..."}

Mensagens genericas por status (usadas quando nao ha mensagem de dominio; o filtro troca os textos padrao do Nest/Express em ingles):
  400 Requisição inválida.
  401 Você precisa estar autenticado para continuar.
      Token expirado: "Sua sessão expirou. Faça login novamente."  |  Token invalido: "Token inválido. Faça login novamente."
  403 Você não tem permissão para realizar esta ação.
  404 Recurso não encontrado.  |  Rota inexistente: "Rota não encontrada."
  408 A requisição demorou mais do que o esperado. Tente novamente.
  409 Conflito: o registro já existe.
  412 A requisição não atende às condições exigidas pelo servidor.
  413 O arquivo ou a requisição excede o tamanho permitido.
  415 Tipo de conteúdo não suportado.
  422 Não foi possível processar os dados enviados.
  429 Muitas requisições. Aguarde alguns instantes e tente novamente. (rate limit; o header Retry-After traz os segundos de espera)
  500 Erro interno do servidor. Tente novamente em instantes. (stack e detalhes internos nunca vao ao cliente)
  503 Serviço temporariamente indisponível. Tente novamente em instantes.

Mensagens de dominio mais comuns:
  Login: "Credenciais inválidas." (401)  |  Cadastro: "Este e-mail já está cadastrado." (409)
  Acesso: quem nao e membro do projeto recebe o MESMO 404 de um projeto inexistente: "Projeto não encontrado." (D-027)  |  membro sem o papel necessario: "Seu papel no projeto não permite esta ação." (403)
  Busca de usuarios sem ser owner/admin de nenhum projeto: "Você não tem permissão para buscar usuários." (403, D-028)
  Nao encontrado: "Projeto não encontrado.", "Tarefa não encontrada.", "Usuário não encontrado.", "Membro não encontrado." (404)
  UUID invalido em parametro de rota: "O identificador informado é inválido." (400)
  Importacao CSV sem arquivo: "Envie o CSV no corpo da requisição (text/csv) ou no campo file (multipart/form-data)." (400)
  Importacao, campo de arquivo errado: "Campo de arquivo inesperado. Envie o arquivo no campo \"file\"." (400)
  Filtro de data: "A data limite inicial não pode ser posterior à data limite final." (400)
  Busca de usuarios sem termo: "Informe ao menos 3 caracteres no e-mail ou no nome para buscar usuários." (400)
  Importacao acima do limite: "O arquivo excede o limite de 5000 linhas por importação." (400)
  Importacao, arquivo que nao e CSV (byte nulo, JSON, aspas quebradas): "O arquivo enviado não parece ser um CSV válido." (400)
  Importacao, so cabecalho: "O arquivo enviado não parece ser um CSV válido: não há nenhuma linha de tarefa depois do cabeçalho." (400)
  Importacao, cabecalho sem titulo: "Cabeçalho inválido: o CSV precisa ter a coluna \"titulo\" (colunas aceitas: titulo, descricao, status, responsavel_email, data_limite)." (400)
  Regras de membros: ver PAPEIS.

Erros de banco (corrida entre requisicoes; detalhes do SQL nunca vao ao cliente):
  Unicidade (23505) -> 409. E-mail: "Este e-mail já está cadastrado."; membro repetido: "Usuário já é membro do projeto."; demais: "O registro informado já existe."
  Chave estrangeira (23503) -> 409 "A operação não pôde ser concluída porque o registro está em uso ou referencia outro inexistente."
  Formato invalido no banco (22P02) -> 400 "Um dos valores informados está em formato inválido."

Rate limit (por IP; janela THROTTLE_TTL_SECONDS, padrao 60 s):
  Geral: THROTTLE_LIMIT (padrao 100) requisicoes por janela em todas as rotas, exceto GET /api/health.
  POST /api/auth/login: THROTTLE_AUTH_LOGIN_LIMIT (padrao 10) por janela. POST /api/auth/register: THROTTLE_AUTH_REGISTER_LIMIT (padrao 5) por janela.
  Acima do limite: 429 com a mensagem generica acima. Atras de proxy (nginx do compose), o IP vem do X-Forwarded-For com TRUST_PROXY=1.

Dicionario de validacao (ValidationPipe global; src/common/messages/validation-messages.ts):
  Rotulos: E-mail, Senha, Nome, Título, Descrição, Status, Responsável, Data limite, Data limite inicial, Data limite final, Papel, Usuário, Página, Limite, Busca, Ordenar por, Ordem, Agrupar por, Projeto, Arquivo. Campo sem rotulo aparece pelo proprio nome.
  Regras: deve ser um e-mail válido | não pode estar vazio | deve ser um texto | deve ser um número inteiro | deve ser verdadeiro ou falso | deve ser uma lista | deve ser um identificador válido (UUID) | deve ser um dos valores: ... | deve ser uma data válida no formato AAAA-MM-DD | deve estar no formato AAAA-MM-DD | deve ser maior ou igual a N | deve ser menor ou igual a N | deve ter no mínimo N caracteres | deve ter no máximo N caracteres | não é permitido (campo fora do contrato)
  Campos desconhecidos no corpo ou na query geram 400 ("O campo \"x\" não é permitido.").

Tipos no corpo (D-031): SEM conversao implicita. Numero ou booleano onde se espera texto e 400 (ex.: {"title":123} -> "O campo \"Título\" deve ser um texto."); o mesmo vale para name, description, email, password, assigneeId, status, dueDate, role e userId. Na query, page e limit (texto) continuam convertidos para numero.

Regras de entrada (aplicadas antes da validacao):
  Textos sao limpos: espacos nas bordas sao removidos. Depois disso, campos obrigatorios vazios geram 400 "O campo \"Nome\" não pode estar vazio.".
  Nome de projeto, titulo de tarefa, nome do usuario e e-mail (criacao, login): obrigatorios e nao vazios apos o trim. Limites de tamanho valem depois do trim.
  Descricao opcional: texto vazio vira null.
  E-mail: salvo e comparado em minusculas, sem espacos (cadastro e login).
  Senha: nao sofre trim (espacos podem fazer parte da senha).
  Limites da conta (D-031): nome ate 120, e-mail ate 254, senha de 6 a 72 caracteres no cadastro; no login, e-mail ate 254 e senha ate 72 (400 antes do bcrypt, que ignora o que passa de 72 bytes).
  Filtros de busca (search de projetos e tarefas, name e email de usuarios): trim; busca vazia ou so de espacos e ignorada (sem filtro). Em GET /api/users, sem email ou name de 3+ caracteres a resposta e 400.

Uma mensagem por campo, na regra mais especifica: vazio ("não pode estar vazio") > tipo (ex.: "deve ser um texto") > tamanho/formato (ex.: "deve ter no máximo 120 caracteres").

Upload do CSV (importacao): 1 arquivo, ate 5 MB.
  Arquivo acima de 5 MB -> 413 "O arquivo excede o tamanho máximo permitido de 5 MB."
  Mais de um arquivo -> 400 "Envie apenas um arquivo por requisição."

Erros documentados por endpoint: 400 (validacao/UUID), 401 (sem token ou invalido), 403 (membro sem o papel; busca de usuarios sem permissao), 404 (nao encontrado, inclusive projeto do qual o usuario nao e membro), 409 (conflito), 429 (rate limit)
Autenticacao: toda rota exige token (guard global), exceto POST /api/auth/register, POST /api/auth/login e GET /api/health.
Swagger/OpenAPI: http://localhost:3000/docs (JSON em /docs-json), publicado quando SWAGGER_ENABLED=true (padrao)

AUTH
POST /api/auth/register {name(max 120),email(max 254),password(6 a 72)} -> 201 {access_token,user:{id,name,email,active,createdAt,updatedAt}} ; 409 email ja cadastrado ; 400 validacao
POST /api/auth/login {email(max 254),password(max 72)} -> 200 {access_token,user} ; 401 credenciais invalidas ; 400 validacao

HEALTH
GET /api/health -> 200 {status:"ok",timestamp} (sem token)

PAGINACAO (listagens paginadas)
Endpoints paginados: GET /api/projects, GET /api/projects/:projectId/tasks, GET /api/projects/:projectId/members, GET /api/users
Query comum: page (int >= 1, default 1), limit (int 1..100, default 15; em GET /api/users: 1..10, default 10)
Valores fora da faixa ou de tipo errado (page=0, limit=101, page=abc) -> 400
sortBy e order (asc|desc) so existem onde o endpoint declara; sortBy aceita apenas os campos da whitelist de cada endpoint (nunca coluna arbitraria)
Campo de query nao declarado -> 400 (ValidationPipe forbidNonWhitelisted)
Resposta: envelope {data: T[], meta: {page, limit, total, totalPages}}
totalPages = 0 quando total = 0; senao ceil(total / limit)
page alem da ultima pagina -> 200 com data [] (meta continua valido)
ORDENACAO DETERMINISTICA: toda listagem paginada tem desempate final por id, na mesma direcao do order (ex.: ORDER BY created_at DESC, id DESC). Assim, registros com a mesma chave de ordenacao (ex.: mesmo created_at) nao se repetem nem somem entre paginas.
Padroes: tarefas createdAt desc (mais novas primeiro); projetos name asc; usuarios name asc; membros nome do usuario asc (desempate por id asc).
Exportacao CSV de tarefas (GET /api/projects/:projectId/tasks/export) sai em ordem CRONOLOGICA: createdAt ASC, id ASC (a mais antiga primeiro; identica entre execucoes). A LISTA continua createdAt DESC (mais nova primeiro). Como a importacao grava created_at crescente por linha, exportar e importar de volta preserva a ordem relativa (D-020, D-030).
Relatorios (GET /api/reports) agregam sem depender da ordem das tarefas; a lista de grupos por usuario desempata por nome e depois pelo id do responsavel.
search (projetos, tarefas, usuarios): busca parcial unaccent(coluna) ILIKE unaccent(termo), sem diferenciar maiusculas NEM acentos ("descricao" acha "Descrição"; extensao unaccent, D-029); % _ e a barra invertida digitados sao tratados como texto literal.
NAO paginados (continuam devolvendo tudo): GET /api/projects/:projectId/tasks/export (CSV), GET /api/reports, endpoints de item unico

USUARIOS
GET /api/users?name=&email=&page=&limit=&sortBy=name|email&order= -> 200 {data:[{id,name,email}],meta} sem password
quem pode buscar (D-028): owner ou admin de pelo menos um projeto; os demais -> 403 "Você não tem permissão para buscar usuários." (checado antes do termo)
limit: 1..10, default 10 (limit=11 -> 400 "O campo \"Limite\" deve ser menor ou igual a 10.")
name e email: busca parcial sem diferenciar maiusculas nem acentos (unaccent), combinadas com AND
obrigatorio: email ou name com pelo menos 3 caracteres apos o trim; sem isso -> 400 "Informe ao menos 3 caracteres no e-mail ou no nome para buscar usuários." (o diretorio de usuarios nao pode ser listado inteiro)
sortBy default name, order default asc
GET /api/users sem token -> 401

PAPEIS
owner > admin > member > viewer
Criador do projeto = owner
Leitura: todos inclusive viewer
Criar/editar/excluir tarefas: owner/admin/member
Editar projeto: owner/admin
Excluir projeto: owner apenas
Membros (adicionar, alterar papel, remover):
  owner: adiciona, altera e remove qualquer membro, exceto a si mesmo e o owner; atribui admin, member ou viewer
  admin: so adiciona, altera e remove membros com papel member ou viewer, e so atribui member ou viewer (alvo admin/owner ou papel admin -> 403)
  O papel owner nasce so na criacao do projeto: atribuir owner (POST ou PATCH) -> 400 "O papel de proprietário é definido apenas na criação do projeto e não pode ser atribuído."
  Alterar o proprio papel -> 400 "Você não pode alterar o seu próprio papel no projeto."; remover a si mesmo -> 400 "Você não pode remover a si mesmo do projeto."
  Alterar ou remover o owner -> 403 ("O papel do proprietário do projeto não pode ser alterado." / "O proprietário do projeto não pode ser removido.")
  Admin sobre admin ou owner -> 403 ("Administradores só podem alterar o papel de membros com papel membro ou visualizador." / "Administradores só podem remover membros com papel membro ou visualizador."); admin atribuindo admin -> 403 "Administradores só podem atribuir os papéis membro ou visualizador."
  Transferir a propriedade (trocar o owner) nao existe nesta versao.
  As mensagens da API usam os termos da interface (proprietário, administrador, membro, visualizador); os valores do enum continuam owner|admin|member|viewer.

PROJETOS
POST /api/projects {name,description?} -> 201
GET /api/projects?search=&page=&limit=&sortBy=name|createdAt|updatedAt&order= -> 200 {data:[{id,name,description,createdAt,updatedAt,role}],meta}
search: busca parcial (sem maiusculas nem acentos) em name e description; so projetos em que o usuario e membro
sortBy default name, order default asc
GET /api/projects/:projectId -> 200 ; 404 "Projeto não encontrado." tambem para quem nao e membro (vale para TODAS as rotas /api/projects/:projectId/... e para GET /api/reports?projectId=)
PATCH /api/projects/:projectId {name?,description?} -> 200
DELETE /api/projects/:projectId -> 204

MEMBROS
GET /api/projects/:projectId/members?role=&page=&limit= -> 200 {data:[{id,userId,name,email,role}],meta}
role: filtra pelo papel (owner|admin|member|viewer); sem sortBy, ordenado por nome do usuario asc
POST /api/projects/:projectId/members {userId,role} -> 201
PATCH /api/projects/:projectId/members/:userId {role} -> 200
DELETE /api/projects/:projectId/members/:userId -> 204 (na mesma transacao, as tarefas do membro nesse projeto ficam sem responsavel: assigneeId = null)

TAREFAS (D-011/D-012)
GET /api/projects/:projectId/tasks?status=&assigneeId=&search=&dueFrom=&dueTo=&page=&limit=&sortBy=&order= -> 200 {data:[task],meta}
search: busca parcial (sem maiusculas nem acentos) em title e description
dueFrom/dueTo: YYYY-MM-DD, intervalo inclusivo sobre dueDate; dueFrom > dueTo -> 400
sortBy: title|status|dueDate|createdAt|updatedAt; default createdAt, order default desc
Exportacao CSV (/tasks/export) nao e paginada
POST /api/projects/:projectId/tasks {title,description?,status?,assigneeId?,dueDate?} -> 201
GET /api/projects/:projectId/tasks/:taskId -> 200
PATCH /api/projects/:projectId/tasks/:taskId -> 200
DELETE /api/projects/:projectId/tasks/:taskId -> 204
status: pendente | em_andamento | concluida
assigneeId deve ser membro do projeto
dueDate (criar e editar): data YYYY-MM-DD sem hora; datetime ou outro formato -> 400 "O campo \"Data limite\" deve estar no formato AAAA-MM-DD."

CSV (D-014)
GET /api/projects/:projectId/tasks/export -> text/csv; charset=utf-8, UTF-8 COM BOM (bytes EF BB BF, para o Excel), Content-Disposition attachment filename tarefas-<projectId>.csv, cabecalho titulo,descricao,status,responsavel_email,data_limite, linhas em ordem cronologica (createdAt ASC, id ASC)
POST /api/projects/:projectId/tasks/import multipart/form-data campo file (1 arquivo, ate 5 MB, ate 5000 linhas de dados) -> 201 {created,errors:[{row,message}]} ; 413 arquivo acima de 5 MB ; 400 "O arquivo excede o limite de 5000 linhas por importação." (nada e importado)
Colunas: titulo,descricao,status,responsavel_email,data_limite (data_limite no formato YYYY-MM-DD). So titulo e obrigatoria no cabecalho; nomes de coluna sao normalizados (trim, minusculas, sem acento, espaco/hifen -> _: "Título" e "Data limite" valem) e colunas desconhecidas sao ignoradas. Arquivo com ou sem BOM.
Validacao do arquivo (antes de importar qualquer linha, depois da checagem de acesso): nao-CSV, cabecalho sem titulo ou sem linhas de dados -> 400 (mensagens acima).
status: vazio = pendente; variacoes de escrita sao aceitas ("Em Andamento", " PENDENTE ", "Concluída", "em-andamento"); invalido -> erro da linha: Status inválido: "xyz". Use: pendente, em_andamento ou concluida.
Regra: linhas validas sao importadas; linhas invalidas NAO interrompem a importacao e voltam em errors[] com row (1=cabecalho) e message
Gravacao: as linhas validas sao inseridas em lotes de 500 numa unica transacao (ou todas entram, ou nenhuma); os responsaveis sao resolvidos com os membros do projeto carregados de uma vez.
Protecao contra formulas (CSV/Formula Injection): na exportacao, valor de texto que comeca com =, +, -, @, tab ou CR (mesmo precedido de apostrofos) sai com um apostrofo na frente (ex.: =1+1 vira '=1+1), e a planilha mostra o texto em vez de executar. Na importacao, um apostrofo inicial seguido desses caracteres e removido ('=1+1 vira =1+1). Exportar e importar de volta preserva o texto original.
Ordem de importacao: cada tarefa importada recebe created_at explicito e crescente por linha (a ultima linha do arquivo e a mais nova). Na lista (createdAt desc) a ultima linha aparece primeiro; na exportacao (cronologica) volta a ser a ultima, entao exportar -> importar preserva a ordem.
Swagger documenta apenas multipart/form-data (campo file binario); o CSV puro no corpo com Content-Type text/csv continua aceito pela API, mas nao aparece no Swagger

RELATORIOS (D-015)
GET /api/reports?groupBy=status|user&projectId=<uuid> -> {groupBy,total,byStatus:{pendente,em_andamento,concluida},groups:[{key,label,count}]}
groupBy default status sem projectId agrega todos projetos onde sou membro; com projectId de um projeto do qual nao sou membro (ou inexistente) -> 404 "Projeto não encontrado."
Contagem feita no banco (GROUP BY por status e por responsavel). groups por usuario: key = id do responsavel (ou sem_responsavel), label = nome (ou "Sem responsável"), ordenados por count desc, depois label e key
roles/status sempre minusculos
