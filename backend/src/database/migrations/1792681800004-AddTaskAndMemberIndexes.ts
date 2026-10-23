import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indices escolhidos (D-017):
 * - IDX_tasks_project_id_created_at: listagem de tarefas por projeto ordenada por createdAt.
 * - IDX_tasks_assignee_id: relatorio por usuario e filtro por responsavel.
 * - IDX_project_members_user_id: listar os projetos de um usuario.
 */
export class AddTaskAndMemberIndexes1792681800004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_project_id_created_at" ON "tasks" ("project_id", "created_at") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_tasks_assignee_id" ON "tasks" ("assignee_id") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_project_members_user_id" ON "project_members" ("user_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_project_members_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tasks_assignee_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tasks_project_id_created_at"`);
  }
}
