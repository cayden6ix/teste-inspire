import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import type { ProjectRole } from '../../src/common/enums/project-role.enum.js';
import type { TaskStatus } from '../../src/common/enums/task-status.enum.js';
import { API_PREFIX, type TestApp } from './app.js';

export const SENHA_PADRAO = 'Senha@123';

export interface UsuarioCriado {
  id: string;
  name: string;
  email: string;
  password: string;
  token: string;
}

export interface ProjetoCriado {
  id: string;
  name: string;
  description: string | null;
  role: ProjectRole;
}

export interface TarefaCriada {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DadosTarefa {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  assigneeId?: string | null;
  dueDate?: string | null;
}

export function url(caminho: string): string {
  return `/${API_PREFIX}${caminho}`;
}

export function emailUnico(prefixo = 'usuario'): string {
  return `${prefixo}-${randomUUID().slice(0, 8)}@teste.com`;
}

export function bearer(token: string): [string, string] {
  return ['Authorization', `Bearer ${token}`];
}

/** Cadastra um usuario pela API (POST /auth/register) e devolve o token. */
export async function criarUsuario(
  testApp: TestApp,
  dados: Partial<Pick<UsuarioCriado, 'name' | 'email' | 'password'>> = {},
): Promise<UsuarioCriado> {
  const password = dados.password ?? SENHA_PADRAO;
  const email = dados.email ?? emailUnico();
  const name = dados.name ?? 'Usuário de Teste';

  const response = await testApp
    .http()
    .post(url('/auth/register'))
    .send({ email, password, name });
  if (response.status !== 201) {
    throw new Error(
      `criarUsuario falhou (${response.status}): ${JSON.stringify(response.body)}`,
    );
  }

  return {
    id: response.body.user.id,
    name: response.body.user.name,
    email: response.body.user.email,
    password,
    token: response.body.access_token,
  };
}

/** Login pela API; devolve o token. */
export async function login(
  testApp: TestApp,
  email: string,
  password = SENHA_PADRAO,
): Promise<string> {
  const response = await testApp
    .http()
    .post(url('/auth/login'))
    .send({ email, password });
  if (response.status !== 200) {
    throw new Error(
      `login falhou (${response.status}): ${JSON.stringify(response.body)}`,
    );
  }
  return response.body.access_token;
}

/** Cria o projeto como `dono`, que vira owner. */
export async function criarProjeto(
  testApp: TestApp,
  dono: Pick<UsuarioCriado, 'token'>,
  dados: { name?: string; description?: string | null } = {},
): Promise<ProjetoCriado> {
  const response = await testApp
    .http()
    .post(url('/projects'))
    .set(...bearer(dono.token))
    .send({
      name: dados.name ?? `Projeto ${randomUUID().slice(0, 6)}`,
      description: dados.description,
    });
  if (response.status !== 201) {
    throw new Error(
      `criarProjeto falhou (${response.status}): ${JSON.stringify(response.body)}`,
    );
  }
  return response.body;
}

/** Adiciona `usuario` ao projeto, com a permissao de `quemAdiciona` (owner/admin). */
export async function adicionarMembro(
  testApp: TestApp,
  quemAdiciona: Pick<UsuarioCriado, 'token'>,
  projectId: string,
  usuario: Pick<UsuarioCriado, 'id'>,
  role: ProjectRole,
): Promise<void> {
  const response = await testApp
    .http()
    .post(url(`/projects/${projectId}/members`))
    .set(...bearer(quemAdiciona.token))
    .send({ userId: usuario.id, role });
  if (response.status !== 201) {
    throw new Error(
      `adicionarMembro falhou (${response.status}): ${JSON.stringify(response.body)}`,
    );
  }
}

export async function criarTarefa(
  testApp: TestApp,
  autor: Pick<UsuarioCriado, 'token'>,
  projectId: string,
  dados: DadosTarefa = {},
): Promise<TarefaCriada> {
  const response = await testApp
    .http()
    .post(url(`/projects/${projectId}/tasks`))
    .set(...bearer(autor.token))
    .send({ title: `Tarefa ${randomUUID().slice(0, 6)}`, ...dados });
  if (response.status !== 201) {
    throw new Error(
      `criarTarefa falhou (${response.status}): ${JSON.stringify(response.body)}`,
    );
  }
  return response.body;
}

/**
 * Insere `quantidade` tarefas direto no banco, TODAS com o mesmo `created_at`.
 * Serve para provar que a ordenacao desempata por id (paginacao estavel sem repeticao).
 */
export async function semearTarefasComMesmoInstante(
  dataSource: DataSource,
  projectId: string,
  quantidade: number,
): Promise<void> {
  await dataSource.query(
    `INSERT INTO tasks (project_id, title, status, created_at, updated_at)
     SELECT $1, 'Tarefa ' || n, 'pendente', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
     FROM generate_series(1, $2::int) AS n`,
    [projectId, quantidade],
  );
}
