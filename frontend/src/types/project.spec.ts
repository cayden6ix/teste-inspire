import { describe, expect, it } from 'vitest';
import { assignableRoles, canManageMember, canManageMembers, PROJECT_ROLES } from './project';
import type { ProjectRole } from './project';

const ATOR = 'ator';
const ALVO = 'alvo';

describe('assignableRoles', () => {
  it.each<[ProjectRole | undefined, ProjectRole[]]>([
    ['owner', ['admin', 'member', 'viewer']],
    ['admin', ['member', 'viewer']],
    ['member', []],
    ['viewer', []],
    [undefined, []],
  ])('%s atribui %j (owner nunca é atribuível)', (ator, esperado) => {
    expect(assignableRoles(ator)).toEqual(esperado);
    expect(assignableRoles(ator)).not.toContain('owner');
  });

  it('só owner e admin gerenciam membros', () => {
    expect(PROJECT_ROLES.filter((papel) => canManageMembers(papel))).toEqual(['owner', 'admin']);
    expect(canManageMembers(undefined)).toBe(false);
  });
});

describe('canManageMember: matriz ator x alvo (espelha o backend, D-024)', () => {
  const matriz: Record<ProjectRole, Record<ProjectRole, boolean>> = {
    owner: { owner: false, admin: true, member: true, viewer: true },
    admin: { owner: false, admin: false, member: true, viewer: true },
    member: { owner: false, admin: false, member: false, viewer: false },
    viewer: { owner: false, admin: false, member: false, viewer: false },
  };

  for (const ator of PROJECT_ROLES) {
    for (const alvo of PROJECT_ROLES) {
      it(`${ator} sobre ${alvo}: ${matriz[ator][alvo] ? 'pode' : 'não pode'}`, () => {
        expect(canManageMember(ator, ATOR, { userId: ALVO, role: alvo })).toBe(matriz[ator][alvo]);
      });
    }
  }

  it('ninguém altera a si mesmo, nem o owner', () => {
    expect(canManageMember('owner', ATOR, { userId: ATOR, role: 'admin' })).toBe(false);
  });

  it('sem o id do usuário logado ou sem papel, nega', () => {
    expect(canManageMember('owner', null, { userId: ALVO, role: 'member' })).toBe(false);
    expect(canManageMember(undefined, ATOR, { userId: ALVO, role: 'member' })).toBe(false);
  });
});
