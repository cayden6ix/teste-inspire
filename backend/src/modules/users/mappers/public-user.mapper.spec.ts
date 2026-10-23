import type { User } from '../entities/user.entity.js';
import { toPublicUser } from './public-user.mapper.js';

describe('toPublicUser', () => {
  const usuario = {
    id: 'user-1',
    email: 'ana@empresa.com',
    name: 'Ana',
    password: '$2b$10$hash-que-nunca-sai',
    active: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    projectMemberships: [],
  } as unknown as User;

  it('devolve só os campos públicos, sem o hash da senha', () => {
    const publico = toPublicUser(usuario);

    expect(publico).toEqual({
      id: 'user-1',
      email: 'ana@empresa.com',
      name: 'Ana',
      active: true,
      createdAt: usuario.createdAt,
      updatedAt: usuario.updatedAt,
    });
    expect(publico).not.toHaveProperty('password');
    expect(JSON.stringify(publico)).not.toContain('hash-que-nunca-sai');
  });

  it('não altera o objeto original', () => {
    toPublicUser(usuario);

    expect(usuario.password).toBe('$2b$10$hash-que-nunca-sai');
  });
});
