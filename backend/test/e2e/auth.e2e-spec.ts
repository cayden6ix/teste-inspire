import { JwtService } from '@nestjs/jwt';
import { createTestApp, type TestApp } from '../utils/app.js';
import { limparBanco } from '../utils/database.js';
import {
  bearer,
  criarUsuario,
  emailUnico,
  login,
  SENHA_PADRAO,
  url,
} from '../utils/factories.js';

describe('Auth (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await limparBanco(testApp.dataSource);
  });

  describe('POST /auth/register', () => {
    it('cadastra o usuário (201), devolve o token e nunca a senha', async () => {
      const email = emailUnico('ana');

      const response = await testApp
        .http()
        .post(url('/auth/register'))
        .send({ email, password: SENHA_PADRAO, name: 'Ana Souza' });

      expect(response.status).toBe(201);
      expect(response.body.access_token).toEqual(expect.any(String));
      expect(response.body.user).toMatchObject({
        email,
        name: 'Ana Souza',
        active: true,
      });
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('grava a senha como hash bcrypt', async () => {
      const email = emailUnico();
      await testApp
        .http()
        .post(url('/auth/register'))
        .send({ email, password: SENHA_PADRAO, name: 'Ana' });

      const [linha] = (await testApp.dataSource.query(
        'SELECT password FROM users WHERE email = $1',
        [email],
      )) as Array<{ password: string }>;

      expect(linha?.password).toMatch(/^\$2[aby]\$/);
      expect(linha?.password).not.toContain(SENHA_PADRAO);
    });

    it('normaliza o e-mail para minúsculas e sem espaços', async () => {
      const response = await testApp.http().post(url('/auth/register')).send({
        email: '  Maria.Silva@Teste.COM ',
        password: SENHA_PADRAO,
        name: 'Maria',
      });

      expect(response.status).toBe(201);
      expect(response.body.user.email).toBe('maria.silva@teste.com');
    });

    it('devolve 409 para e-mail já cadastrado, inclusive com outra caixa', async () => {
      const email = emailUnico('dup');
      await criarUsuario(testApp, { email });

      const response = await testApp.http().post(url('/auth/register')).send({
        email: email.toUpperCase(),
        password: SENHA_PADRAO,
        name: 'Outro',
      });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        statusCode: 409,
        message: 'Este e-mail já está cadastrado.',
        path: '/api/auth/register',
      });
    });

    it('devolve 400 com mensagens em português para dados inválidos', async () => {
      const response = await testApp
        .http()
        .post(url('/auth/register'))
        .send({ email: 'sem-arroba', password: '123', name: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual([
        'O campo "E-mail" deve ser um e-mail válido.',
        'O campo "Senha" deve ter no mínimo 6 caracteres.',
        'O campo "Nome" não pode estar vazio.',
      ]);
    });

    it('rejeita campos fora da whitelist (400)', async () => {
      const response = await testApp.http().post(url('/auth/register')).send({
        email: emailUnico(),
        password: SENHA_PADRAO,
        name: 'Ana',
        active: false,
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual([
        'O campo "active" não é permitido.',
      ]);
    });

    it('JSON malformado devolve 400 em português, sem detalhes internos', async () => {
      const response = await testApp
        .http()
        .post(url('/auth/register'))
        .set('Content-Type', 'application/json')
        .send('{"email": ');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'Corpo da requisição inválido: o JSON está malformado.',
      );
    });
  });

  describe('POST /auth/login', () => {
    it('autentica com as credenciais corretas e devolve token e usuário', async () => {
      const usuario = await criarUsuario(testApp, { name: 'Bruno' });

      const response = await testApp
        .http()
        .post(url('/auth/login'))
        .send({ email: usuario.email, password: usuario.password });

      expect(response.status).toBe(200);
      expect(response.body.access_token).toEqual(expect.any(String));
      expect(response.body.user).toMatchObject({
        id: usuario.id,
        email: usuario.email,
        name: 'Bruno',
      });
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('aceita o e-mail com outra caixa e espaços', async () => {
      const usuario = await criarUsuario(testApp);

      const response = await testApp
        .http()
        .post(url('/auth/login'))
        .send({
          email: ` ${usuario.email.toUpperCase()} `,
          password: usuario.password,
        });

      expect(response.status).toBe(200);
    });

    it('senha errada devolve 401 "Credenciais inválidas."', async () => {
      const usuario = await criarUsuario(testApp);

      const response = await testApp
        .http()
        .post(url('/auth/login'))
        .send({ email: usuario.email, password: 'senha-errada' });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        statusCode: 401,
        message: 'Credenciais inválidas.',
      });
    });

    it('e-mail inexistente devolve a mesma resposta da senha errada', async () => {
      const response = await testApp
        .http()
        .post(url('/auth/login'))
        .send({ email: emailUnico('fantasma'), password: SENHA_PADRAO });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Credenciais inválidas.');
    });

    it('dados inválidos devolvem 400 com mensagens em português', async () => {
      const response = await testApp
        .http()
        .post(url('/auth/login'))
        .send({ email: 'x', password: '' });

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual([
        'O campo "E-mail" deve ser um e-mail válido.',
        'O campo "Senha" não pode estar vazio.',
      ]);
    });

    it('usuário inativo não consegue entrar', async () => {
      const usuario = await criarUsuario(testApp);
      await testApp.dataSource.query(
        'UPDATE users SET active = false WHERE id = $1',
        [usuario.id],
      );

      const response = await testApp
        .http()
        .post(url('/auth/login'))
        .send({ email: usuario.email, password: usuario.password });

      expect(response.status).toBe(401);
    });
  });

  describe('rotas protegidas', () => {
    it('sem token devolve 401', async () => {
      const response = await testApp.http().get(url('/projects'));

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        statusCode: 401,
        message: 'Você precisa estar autenticado para continuar.',
        path: '/api/projects',
      });
    });

    it('com o token do login acessa a rota protegida', async () => {
      const usuario = await criarUsuario(testApp);
      const token = await login(testApp, usuario.email, usuario.password);

      const response = await testApp
        .http()
        .get(url('/projects'))
        .set(...bearer(token));

      expect(response.status).toBe(200);
    });

    it('token inválido devolve 401 com mensagem própria', async () => {
      const response = await testApp
        .http()
        .get(url('/projects'))
        .set(...bearer('isto.nao.e-um-jwt'));

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        'Token inválido. Faça login novamente.',
      );
    });

    it('token assinado com outro segredo devolve 401', async () => {
      const usuario = await criarUsuario(testApp);
      const falso = new JwtService({
        secret: 'outro-segredo-qualquer-com-32-caracteres!!',
      }).sign({
        sub: usuario.id,
        email: usuario.email,
      });

      const response = await testApp
        .http()
        .get(url('/projects'))
        .set(...bearer(falso));

      expect(response.status).toBe(401);
    });

    it('token expirado devolve 401 com a mensagem de sessão expirada', async () => {
      const usuario = await criarUsuario(testApp);
      const expirado = new JwtService({ secret: process.env.JWT_SECRET }).sign(
        { sub: usuario.id, email: usuario.email },
        { expiresIn: -10 },
      );

      const response = await testApp
        .http()
        .get(url('/projects'))
        .set(...bearer(expirado));

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        'Sua sessão expirou. Faça login novamente.',
      );
    });

    it('token válido de um usuário que não existe mais devolve 401', async () => {
      const usuario = await criarUsuario(testApp);
      await testApp.dataSource.query('DELETE FROM users WHERE id = $1', [
        usuario.id,
      ]);

      const response = await testApp
        .http()
        .get(url('/projects'))
        .set(...bearer(usuario.token));

      expect(response.status).toBe(401);
    });

    it('esquema de autorização diferente de Bearer devolve 401', async () => {
      const usuario = await criarUsuario(testApp);

      const response = await testApp
        .http()
        .get(url('/projects'))
        .set('Authorization', usuario.token);

      expect(response.status).toBe(401);
    });
  });

  describe('health', () => {
    it('GET /health é público e devolve 200 com status ok', async () => {
      const response = await testApp.http().get(url('/health'));

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.headers['x-request-id']).toEqual(expect.any(String));
    });
  });

  describe('rota inexistente', () => {
    it('devolve 404 em português no formato padrão de erro', async () => {
      const response = await testApp.http().get(url('/nao-existe'));

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        statusCode: 404,
        message: 'Rota não encontrada.',
        path: '/api/nao-existe',
        requestId: expect.any(String),
      });
    });
  });
});
