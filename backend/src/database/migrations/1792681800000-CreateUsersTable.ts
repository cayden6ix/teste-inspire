import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cria a tabela `users` com PK_users e UQ_users_email.
 *
 * Garante antes a extensao `uuid-ossp` (uuid_generate_v4 dos ids). Sem isso, o schema
 * dependeria de o TypeORM criar a extensao ao conectar. Idempotente: inofensivo onde
 * a extensao ja existe.
 */
export class CreateUsersTable1792681800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password" character varying NOT NULL, "name" character varying NOT NULL, "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_users_email" UNIQUE ("email"), CONSTRAINT "PK_users" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
