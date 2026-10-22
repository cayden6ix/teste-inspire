import type { BadgeTone } from '@/components/ui/Badge';
import type { ProjectRole } from '@/types/project';
import type { TaskStatus } from '@/types/task';

export const ROLE_TONES: Record<ProjectRole, BadgeTone> = {
  owner: 'violet',
  admin: 'blue',
  member: 'green',
  viewer: 'slate',
};

export const STATUS_TONES: Record<TaskStatus, BadgeTone> = {
  pendente: 'amber',
  em_andamento: 'blue',
  concluida: 'green',
};
