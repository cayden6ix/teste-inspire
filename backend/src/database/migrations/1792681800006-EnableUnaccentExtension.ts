import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Habilita a extensao `unaccent` (contrib oficial do PostgreSQL, ja presente na imagem
 * postgres:17-alpine e marcada como "trusted": nao exige superusuario).
 *
 * As buscas de projetos, tarefas e usuarios passam a comparar
 * `unaccent(coluna) ILIKE unaccent(:termo)`: "descricao" encontra "Descrição" (D-029).
 * Nao altera tabelas nem dados.
 */
export class EnableUnaccentExtension1792681800006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "unaccent"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP EXTENSION IF EXISTS "unaccent"`);
  }
}
