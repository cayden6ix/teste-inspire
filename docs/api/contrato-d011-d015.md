CONTRATO DE ENDPOINTS - D-011 a D-015

Base: http://localhost:3000/api
Auth: Authorization: Bearer <access_token>
Erros: {statusCode,error,message,path,timestamp}

PAPEIS
owner > admin > member > viewer
Criador do projeto = owner
Leitura: todos inclusive viewer
Criar/editar/excluir tarefas: owner/admin/member
Editar projeto: owner/admin
Adicionar/remover membro member|viewer: owner/admin
Adicionar admin|owner ou alterar papeis: owner apenas
Excluir projeto: owner apenas

PROJETOS
POST /api/projects {name,description?} -> 201
GET /api/projects -> 200
GET /api/projects/:projectId -> 200
PATCH /api/projects/:projectId {name?,description?} -> 200
DELETE /api/projects/:projectId -> 204

MEMBROS
GET /api/projects/:projectId/members -> 200
POST /api/projects/:projectId/members {userId,role} -> 201
PATCH /api/projects/:projectId/members/:userId {role} -> 200
DELETE /api/projects/:projectId/members/:userId -> 204

TAREFAS (D-011/D-012)
GET /api/projects/:projectId/tasks?status=&assigneeId= -> 200
POST /api/projects/:projectId/tasks {title,description?,status?,assigneeId?,dueDate?} -> 201
GET /api/projects/:projectId/tasks/:taskId -> 200
PATCH /api/projects/:projectId/tasks/:taskId -> 200
DELETE /api/projects/:projectId/tasks/:taskId -> 204
Status: pendente/em_andamento/concluida
assigneeId deve ser membro do projeto

CSV (D-014)
GET /api/projects/:projectId/tasks/export -> text/csv Content-Disposition attachment filename tarefas-<projectId>.csv cabecalho titulo,descricao,status,responsavel_email,data_limite
POST /api/projects/:projectId/tasks/import -> {created,errors:[{row,message}]} CSV puro ou multipart file campo file mesmo cabecalho titulo obrigatorio status default pendente

RELATORIOS (D-015)
GET /api/reports?groupBy=status|user&projectId=<uuid> -> {groupBy,total,byStatus:{pendente,em_andamento,concluida},groups:[{key,label,count}]}
groupBy default status sem projectId agrega todos projetos onde sou membro
