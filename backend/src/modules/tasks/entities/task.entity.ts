import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TaskStatus } from '../../../common/enums/task-status.enum.js';
import { User } from '../../users/entities/user.entity.js';
import { Project } from '../../projects/entities/project.entity.js';

/**
 * Tarefa do projeto (D-011): sempre pertence a um projeto e so e acessada
 * no contexto dele.
 *
 * `status` usa enum nativo do Postgres (`task_status`), com default `pendente` (D-016).
 * Os indices estao descritos em D-017.
 */
@Entity('tasks')
@Index('IDX_tasks_project_id_created_at_id', ['projectId', 'createdAt', 'id'])
@Index('IDX_tasks_assignee_id', ['assigneeId'])
export class Task {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_tasks' })
  id: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    enumName: 'task_status',
    default: TaskStatus.Pendente,
  })
  status: TaskStatus;

  @Column({ name: 'assignee_id', type: 'uuid', nullable: true })
  assigneeId: string | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id', foreignKeyConstraintName: 'FK_tasks_project' })
  project: Project;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignee_id', foreignKeyConstraintName: 'FK_tasks_assignee' })
  assignee: User | null;
}
