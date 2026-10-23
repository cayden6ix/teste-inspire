import { ProjectRole } from '../../src/common/enums/project-role.enum.js';
import { createTestApp, type TestApp } from '../utils/app.js';
import { limparBanco } from '../utils/database.js';
import {
  adicionarMembro,
  bearer,
  criarProjeto,
  criarUsuario,
  url,
  type ProjetoCriado,
  type UsuarioCriado,
} from '../utils/factories.js';

/**
 * Matriz de papéis de D-013 pela API (R05/R06): quem pode atribuir, alterar e remover quem.
 */
describe('Matriz de papéis dos membros (e2e)', () => {
  let testApp: TestApp;
  let dono: UsuarioCriado;
  let admin: UsuarioCriado;
  let outroAdmin: UsuarioCriado;
  let membro: UsuarioCriado;
  let leitor: UsuarioCriado;
  let projeto: ProjetoCriado;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await limparBanco(testApp.dataSource);
    dono = await criarUsuario(testApp, { name: 'Dono' });
    admin = await criarUsuario(testApp, { name: 'Admin' });
    outroAdmin = await criarUsuario(testApp, { name: 'Outro Admin' });
    membro = await criarUsuario(testApp, { name: 'Membro' });
    leitor = await criarUsuario(testApp, { name: 'Leitor' });
    projeto = await criarProjeto(testApp, dono);
    await adicionarMembro(testApp, dono, projeto.id, admin, ProjectRole.Admin);
    await adicionarMembro(
      testApp,
      dono,
      projeto.id,
      outroAdmin,
      ProjectRole.Admin,
    );
    await adicionarMembro(
      testApp,
      dono,
      projeto.id,
      membro,
      ProjectRole.Member,
    );
    await adicionarMembro(
      testApp,
      dono,
      projeto.id,
      leitor,
      ProjectRole.Viewer,
    );
  });

  const membrosUrl = (sufixo = '') =>
    url(`/projects/${projeto.id}/members${sufixo}`);

  const papelNoBanco = async (usuario: UsuarioCriado) => {
    const [linha] = (await testApp.dataSource.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projeto.id, usuario.id],
    )) as Array<{ role: string }>;
    return linha?.role ?? null;
  };

  const totalDeOwners = async () =>
    Number(
      (
        (await testApp.dataSource.query(
          `SELECT count(*) AS n FROM project_members WHERE project_id = $1 AND role = 'owner'`,
          [projeto.id],
        )) as Array<{ n: string }>
      )[0]?.n,
    );

  const adicionar = (ator: UsuarioCriado, alvo: UsuarioCriado, role: string) =>
    testApp
      .http()
      .post(membrosUrl())
      .set(...bearer(ator.token))
      .send({ userId: alvo.id, role });

  const alterar = (ator: UsuarioCriado, alvo: UsuarioCriado, role: string) =>
    testApp
      .http()
      .patch(membrosUrl(`/${alvo.id}`))
      .set(...bearer(ator.token))
      .send({ role });

  const remover = (ator: UsuarioCriado, alvo: UsuarioCriado) =>
    testApp
      .http()
      .delete(membrosUrl(`/${alvo.id}`))
      .set(...bearer(ator.token));

  describe('owner', () => {
    it('não atribui o papel owner (400), nem ao adicionar nem ao alterar', async () => {
      const novo = await criarUsuario(testApp);

      const adicao = await adicionar(dono, novo, 'owner');
      const alteracao = await alterar(dono, membro, 'owner');

      expect(adicao.status).toBe(400);
      expect(adicao.body.message).toBe(
        'O papel de proprietário é definido apenas na criação do projeto e não pode ser atribuído.',
      );
      expect(alteracao.status).toBe(400);
      expect(await papelNoBanco(membro)).toBe('member');
      expect(await totalDeOwners()).toBe(1);
    });

    it('não altera o próprio papel (400): o projeto nunca fica sem owner', async () => {
      const response = await alterar(dono, dono, 'admin');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'Você não pode alterar o seu próprio papel no projeto.',
      );
      expect(await papelNoBanco(dono)).toBe('owner');
      expect(await totalDeOwners()).toBe(1);
    });

    it('altera o papel de admin, member e viewer para qualquer papel exceto owner', async () => {
      expect((await alterar(dono, admin, 'viewer')).status).toBe(200);
      expect((await alterar(dono, membro, 'admin')).status).toBe(200);
      expect((await alterar(dono, leitor, 'member')).status).toBe(200);

      expect(await papelNoBanco(admin)).toBe('viewer');
      expect(await papelNoBanco(membro)).toBe('admin');
      expect(await papelNoBanco(leitor)).toBe('member');
    });

    it('remove admin, member e viewer (204), mas não a si mesmo (400)', async () => {
      expect((await remover(dono, admin)).status).toBe(204);
      expect((await remover(dono, membro)).status).toBe(204);
      expect((await remover(dono, leitor)).status).toBe(204);
      const propria = await remover(dono, dono);

      expect(propria.status).toBe(400);
      expect(propria.body.message).toBe(
        'Você não pode remover a si mesmo do projeto.',
      );
      expect(await totalDeOwners()).toBe(1);
    });
  });

  describe('admin', () => {
    it('adiciona member e viewer, mas não admin (403) nem owner (400)', async () => {
      const [a, b, c, d] = await Promise.all([
        criarUsuario(testApp),
        criarUsuario(testApp),
        criarUsuario(testApp),
        criarUsuario(testApp),
      ]);

      const comoMember = await adicionar(admin, a, 'member');
      const comoViewer = await adicionar(admin, b, 'viewer');
      const comoAdmin = await adicionar(admin, c, 'admin');
      const comoOwner = await adicionar(admin, d, 'owner');

      expect([comoMember.status, comoViewer.status]).toEqual([201, 201]);
      expect(comoAdmin.status).toBe(403);
      expect(comoAdmin.body.message).toBe(
        'Administradores só podem atribuir os papéis membro ou visualizador.',
      );
      expect(comoOwner.status).toBe(400);
      expect(await papelNoBanco(c)).toBeNull();
      expect(await papelNoBanco(d)).toBeNull();
    });

    it('altera member <-> viewer, mas nunca promove a admin (403)', async () => {
      expect((await alterar(admin, membro, 'viewer')).status).toBe(200);
      expect((await alterar(admin, leitor, 'member')).status).toBe(200);
      const promocao = await alterar(admin, leitor, 'admin');

      expect(promocao.status).toBe(403);
      expect(await papelNoBanco(membro)).toBe('viewer');
      expect(await papelNoBanco(leitor)).toBe('member');
    });

    it('não rebaixa nem remove outro admin (403)', async () => {
      const rebaixa = await alterar(admin, outroAdmin, 'member');
      const remocao = await remover(admin, outroAdmin);

      expect(rebaixa.status).toBe(403);
      expect(rebaixa.body.message).toBe(
        'Administradores só podem alterar o papel de membros com papel membro ou visualizador.',
      );
      expect(remocao.status).toBe(403);
      expect(remocao.body.message).toBe(
        'Administradores só podem remover membros com papel membro ou visualizador.',
      );
      expect(await papelNoBanco(outroAdmin)).toBe('admin');
    });

    it('não mexe no owner: alterar ou remover devolve 403', async () => {
      const alteracao = await alterar(admin, dono, 'viewer');
      const remocao = await remover(admin, dono);

      expect(alteracao.status).toBe(403);
      expect(alteracao.body.message).toBe(
        'O papel do proprietário do projeto não pode ser alterado.',
      );
      expect(remocao.status).toBe(403);
      expect(remocao.body.message).toBe(
        'O proprietário do projeto não pode ser removido.',
      );
      expect(await papelNoBanco(dono)).toBe('owner');
    });

    it('remove member e viewer (204)', async () => {
      expect((await remover(admin, membro)).status).toBe(204);
      expect((await remover(admin, leitor)).status).toBe(204);
    });

    it('não altera o próprio papel nem se remove (400)', async () => {
      expect((await alterar(admin, admin, 'viewer')).status).toBe(400);
      expect((await remover(admin, admin)).status).toBe(400);
      expect(await papelNoBanco(admin)).toBe('admin');
    });
  });

  describe('member e viewer não gerenciam membros', () => {
    it.each(['membro', 'leitor'] as const)(
      '%s recebe 403 ao adicionar, alterar e remover',
      async (quem) => {
        const ator = quem === 'membro' ? membro : leitor;
        const novo = await criarUsuario(testApp);

        const respostas = [
          await adicionar(ator, novo, 'viewer'),
          await alterar(ator, outroAdmin, 'viewer'),
          await remover(ator, outroAdmin),
        ];

        expect(respostas.map((r) => r.status)).toEqual([403, 403, 403]);
        expect(await papelNoBanco(outroAdmin)).toBe('admin');
        expect(await papelNoBanco(novo)).toBeNull();
      },
    );
  });
});
