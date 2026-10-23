/**
 * Seed minimo do banco de dados (D-002, D-018).
 *
 * Pre-requisito: o schema ja deve existir, criado por `npm run migration:run`.
 * O seed NAO cria tabelas e nao depende de `synchronize`.
 *
 * Popula os dados basicos para navegar pela API: usuarios, projetos com membros
 * e papeis (D-013) e tarefas por projeto (D-011) nos tres status de D-012.
 *
 * Execucao:
 * - local (pasta backend): `npm run seed` (compila e roda) ou `npm run seed:run` (so roda o dist);
 * - Docker: `docker compose exec -e SEED_ALLOW_PROD=true backend npm run seed:run`.
 *
 * As contas do seed tem senha conhecida: com NODE_ENV=production o seed recusa rodar,
 * a menos que SEED_ALLOW_PROD=true (o container do compose roda como producao).
 *
 * O seed e idempotente: rodar de novo nao duplica registros, apenas completa
 * o que falta.
 */
import { Logger, type INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module.js';
import { ProjectRole } from '../../common/enums/project-role.enum.js';
import { TaskStatus } from '../../common/enums/task-status.enum.js';
import type { Project } from '../../modules/projects/entities/project.entity.js';
import { ProjectMembersRepository } from '../../modules/projects/repositories/project-members.repository.js';
import { ProjectsRepository } from '../../modules/projects/repositories/projects.repository.js';
import { TasksRepository } from '../../modules/tasks/repositories/tasks.repository.js';
import type { User } from '../../modules/users/entities/user.entity.js';
import { UsersService } from '../../modules/users/services/users.service.js';

const logger = new Logger('Seed');

/** Senha compartilhada por todos os usuarios do seed. */
const SEED_PASSWORD = 'Senha@123';

interface SeedUser {
  name: string;
  email: string;
}

interface SeedMember {
  email: string;
  role: ProjectRole;
}

interface SeedTask {
  title: string;
  description: string;
  status: TaskStatus;
  assigneeEmail: string | null;
  dueDate: string | null;
}

interface SeedProject {
  name: string;
  description: string;
  ownerEmail: string;
  members: SeedMember[];
  tasks: SeedTask[];
}

/** Data no formato YYYY-MM-DD, deslocada em dias a partir de hoje. */
function inDays(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

const USERS: SeedUser[] = [
  { name: 'Ana Souza', email: 'ana.souza@empresa.com' },
  { name: 'Bruno Lima', email: 'bruno.lima@empresa.com' },
  { name: 'Carla Dias', email: 'carla.dias@empresa.com' },
  { name: 'Diego Rocha', email: 'diego.rocha@empresa.com' },
];

const PROJECTS: SeedProject[] = [
  {
    name: 'Portal do Cliente',
    description:
      'Portal web para o cliente final: cadastro, login e acompanhamento de solicitações.',
    ownerEmail: 'ana.souza@empresa.com',
    members: [
      { email: 'bruno.lima@empresa.com', role: ProjectRole.Admin },
      { email: 'carla.dias@empresa.com', role: ProjectRole.Member },
      { email: 'diego.rocha@empresa.com', role: ProjectRole.Viewer },
    ],
    tasks: [
      {
        title: 'Levantar requisitos do portal',
        description:
          'Entrevistar as áreas de negócio e consolidar o escopo da primeira versão.',
        status: TaskStatus.Concluida,
        assigneeEmail: 'carla.dias@empresa.com',
        dueDate: inDays(-7),
      },
      {
        title: 'Modelar o banco de dados',
        description:
          'Definir tabelas e relacionamentos de usuários, pedidos e solicitações.',
        status: TaskStatus.EmAndamento,
        assigneeEmail: 'bruno.lima@empresa.com',
        dueDate: inDays(3),
      },
      {
        title: 'Implementar tela de login',
        description:
          'Formulário de acesso com validação e recuperação de senha.',
        status: TaskStatus.EmAndamento,
        assigneeEmail: 'carla.dias@empresa.com',
        dueDate: inDays(10),
      },
      {
        title: 'Configurar logs e monitoração',
        description: 'Centralizar logs da aplicação e criar alertas de erro.',
        status: TaskStatus.Pendente,
        assigneeEmail: 'ana.souza@empresa.com',
        dueDate: inDays(15),
      },
    ],
  },
  {
    name: 'Integração com ERP',
    description: 'Sincronização de cadastros e pedidos entre a API e o ERP.',
    ownerEmail: 'bruno.lima@empresa.com',
    members: [
      { email: 'carla.dias@empresa.com', role: ProjectRole.Member },
      { email: 'ana.souza@empresa.com', role: ProjectRole.Viewer },
    ],
    tasks: [
      {
        title: 'Mapear endpoints do ERP',
        description: 'Catalogar os endpoints disponíveis e suas autenticações.',
        status: TaskStatus.EmAndamento,
        assigneeEmail: 'carla.dias@empresa.com',
        dueDate: inDays(2),
      },
      {
        title: 'Criar job de sincronização',
        description: 'Agendar a rotina diária de envio e retorno de cadastros.',
        status: TaskStatus.Pendente,
        assigneeEmail: 'bruno.lima@empresa.com',
        dueDate: inDays(12),
      },
      {
        title: 'Validar conciliação',
        description: 'Conferir os totais importados contra o relatório do ERP.',
        status: TaskStatus.Concluida,
        assigneeEmail: 'bruno.lima@empresa.com',
        dueDate: inDays(-2),
      },
    ],
  },
];

const stats = { users: 0, projects: 0, members: 0, tasks: 0 };

async function upsertUser(
  usersService: UsersService,
  seedUser: SeedUser,
): Promise<User> {
  const existing = await usersService.findByEmail(seedUser.email);
  if (existing) {
    return existing;
  }

  // O UsersService ja aplica o hash bcrypt da senha.
  const user = await usersService.create({
    name: seedUser.name,
    email: seedUser.email,
    password: SEED_PASSWORD,
  });

  stats.users += 1;
  return user;
}

async function upsertProject(
  projectsRepository: ProjectsRepository,
  seedProject: SeedProject,
): Promise<Project> {
  const existing = await projectsRepository.findOne({
    where: { name: seedProject.name },
  });
  if (existing) {
    return existing;
  }

  const project = await projectsRepository.save(
    projectsRepository.create({
      name: seedProject.name,
      description: seedProject.description,
    }),
  );

  stats.projects += 1;
  return project;
}

async function upsertMember(
  membersRepository: ProjectMembersRepository,
  projectId: string,
  userId: string,
  role: ProjectRole,
): Promise<void> {
  const existing = await membersRepository.findByProjectAndUser(
    projectId,
    userId,
  );
  if (existing) {
    return;
  }

  await membersRepository.save(
    membersRepository.create({
      projectId,
      userId,
      role,
    }),
  );

  stats.members += 1;
}

async function upsertTask(
  tasksRepository: TasksRepository,
  projectId: string,
  seedTask: SeedTask,
  assigneeId: string | null,
): Promise<void> {
  const existing = await tasksRepository.findOne({
    where: { projectId, title: seedTask.title },
  });
  if (existing) {
    return;
  }

  await tasksRepository.save(
    tasksRepository.create({
      projectId,
      title: seedTask.title,
      description: seedTask.description,
      status: seedTask.status,
      assigneeId,
      dueDate: seedTask.dueDate,
    }),
  );

  stats.tasks += 1;
}

async function run(app: INestApplicationContext): Promise<void> {
  const usersService = app.get(UsersService);
  const projectsRepository = app.get(ProjectsRepository);
  const membersRepository = app.get(ProjectMembersRepository);
  const tasksRepository = app.get(TasksRepository);

  const usersByEmail = new Map<string, User>();
  for (const seedUser of USERS) {
    usersByEmail.set(seedUser.email, await upsertUser(usersService, seedUser));
  }

  for (const seedProject of PROJECTS) {
    const project = await upsertProject(projectsRepository, seedProject);

    // O criador do projeto e sempre owner (D-013).
    const owner = usersByEmail.get(seedProject.ownerEmail);
    await upsertMember(
      membersRepository,
      project.id,
      owner!.id,
      ProjectRole.Owner,
    );

    for (const member of seedProject.members) {
      const user = usersByEmail.get(member.email);
      await upsertMember(membersRepository, project.id, user!.id, member.role);
    }

    for (const seedTask of seedProject.tasks) {
      const assignee = seedTask.assigneeEmail
        ? usersByEmail.get(seedTask.assigneeEmail)
        : undefined;
      await upsertTask(
        tasksRepository,
        project.id,
        seedTask,
        assignee?.id ?? null,
      );
    }
  }

  logger.log(
    `Seed concluido: ${stats.users} usuario(s), ${stats.projects} projeto(s), ` +
      `${stats.members} membro(s) e ${stats.tasks} tarefa(s) criados.`,
  );
  logger.log('Acesso aos usuarios do seed:');
  for (const seedUser of USERS) {
    logger.log(`  ${seedUser.email} / ${SEED_PASSWORD}`);
  }
}

/**
 * Bloqueia o seed em producao sem liberacao explicita (SEED_ALLOW_PROD=true).
 */
function assertSeedAllowed(): void {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PROD !== 'true') {
    throw new Error(
      'Seed bloqueado: NODE_ENV=production e o seed cria contas com senha conhecida. ' +
        'Para rodar mesmo assim (ex.: ambiente de demonstração), defina SEED_ALLOW_PROD=true.',
    );
  }
}

async function main(): Promise<void> {
  assertSeedAllowed();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    await run(app);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  logger.error(
    'Falha ao executar o seed',
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  process.exitCode = 1;
});
