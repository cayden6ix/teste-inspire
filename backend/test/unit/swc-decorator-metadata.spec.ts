import 'reflect-metadata';
import { UsersService } from '../../src/modules/users/services/users.service.js';
import { UsersRepository } from '../../src/modules/users/repositories/users.repository.js';
import { ProjectAccessService } from '../../src/modules/projects/services/project-access.service.js';
import { ProjectMembersRepository } from '../../src/modules/projects/repositories/project-members.repository.js';
import { CreateProjectDto } from '../../src/modules/projects/dto/create-project.dto.js';

/**
 * O Vitest/Vite nao emite `emitDecoratorMetadata`; o plugin SWC dos vitest.config*.ts supre
 * isso. Se este spec falhar, a injecao de dependencias do Nest deixa de funcionar nos testes.
 */
describe('metadados de decorators (SWC)', () => {
  it('emite design:paramtypes nos construtores injetaveis', () => {
    expect(Reflect.getMetadata('design:paramtypes', UsersService)).toEqual([
      UsersRepository,
    ]);
    expect(
      Reflect.getMetadata('design:paramtypes', ProjectAccessService),
    ).toEqual([ProjectMembersRepository]);
  });

  it('emite design:type nas propriedades dos DTOs', () => {
    expect(
      Reflect.getMetadata('design:type', CreateProjectDto.prototype, 'name'),
    ).toBe(String);
  });
});
