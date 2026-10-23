import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ProjectRole } from '../../../common/enums/project-role.enum.js';
import { User } from '../../users/entities/user.entity.js';
import { Project } from './project.entity.js';

/**
 * Vinculo entre um projeto e um usuario, com o papel do usuario no projeto (D-013).
 *
 * `role` usa enum nativo do Postgres (`project_role`), o que faz o banco rejeitar
 * valores fora de owner/admin/member/viewer (D-016).
 */
@Entity('project_members')
@Unique('UQ_project_members_project_user', ['projectId', 'userId'])
@Index('IDX_project_members_user_id', ['userId'])
export class ProjectMember {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_project_members' })
  id: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: ProjectRole, enumName: 'project_role' })
  role: ProjectRole;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id', foreignKeyConstraintName: 'FK_project_members_project' })
  project: Project;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_project_members_user' })
  user: User;
}
