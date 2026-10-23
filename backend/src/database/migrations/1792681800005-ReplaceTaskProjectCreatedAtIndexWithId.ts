import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Troca IDX_tasks_project_id_created_at (project_id, created_at) por
 * IDX_tasks_project_id_created_at_id (project_id, created_at, id).
 *
 * A listagem ordena por created_at DESC, id DESC (desempate deterministico).
 * Com o id no indice, a leitura reversa atende a ordenacao sem Incremental Sort (D-017).
 */
export class ReplaceTaskProjectCreatedAtIndexWithId1792681800005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_tasks_project_id_created_at"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_project_id_created_at_id" ON "tasks" ("project_id", "created_at", "id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_tasks_project_id_created_at_id"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_project_id_created_at" ON "tasks" ("project_id", "created_at") `,
    );
  }
}
