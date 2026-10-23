import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cria o enum nativo `project_role` e a tabela `project_members`, com a
 * UNIQUE (project_id, user_id) e as FKs para `projects` e `users` (CASCADE).
 */
export class CreateProjectMembersTable1792681800002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."project_role" AS ENUM('owner', 'admin', 'member', 'viewer')`,
    );
    await queryRunner.query(
      `CREATE TABLE "project_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "project_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" "public"."project_role" NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_project_members_project_user" UNIQUE ("project_id", "user_id"), CONSTRAINT "PK_project_members" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" ADD CONSTRAINT "FK_project_members_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" ADD CONSTRAINT "FK_project_members_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "project_members" DROP CONSTRAINT "FK_project_members_user"`);
    await queryRunner.query(`ALTER TABLE "project_members" DROP CONSTRAINT "FK_project_members_project"`);
    await queryRunner.query(`DROP TABLE "project_members"`);
    await queryRunner.query(`DROP TYPE "public"."project_role"`);
  }
}
