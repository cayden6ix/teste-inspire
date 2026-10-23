import { httpClient } from '@/services/api/httpClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type {
  AddMemberDto,
  CreateProjectDto,
  Project,
  ProjectMember,
  ProjectRole,
  UpdateProjectDto,
} from '@/types/project';

/**
 * Projetos e membros (D-011, D-013).
 * O backend expoe `role` junto do projeto: o papel do usuario logado.
 */

export interface ProjectListParams extends PaginationParams {
  search?: string;
}

export interface MemberListParams extends PaginationParams {
  role?: ProjectRole;
}

export async function listProjects(
  params: ProjectListParams = {},
): Promise<PaginatedResponse<Project>> {
  const { data } = await httpClient.get<PaginatedResponse<Project>>('/projects', { params });
  return data;
}

export async function getProject(projectId: string): Promise<Project> {
  const { data } = await httpClient.get<Project>(`/projects/${projectId}`);
  return data;
}

export async function createProject(dto: CreateProjectDto): Promise<Project> {
  const { data } = await httpClient.post<Project>('/projects', dto);
  return data;
}

export async function updateProject(projectId: string, dto: UpdateProjectDto): Promise<Project> {
  const { data } = await httpClient.patch<Project>(`/projects/${projectId}`, dto);
  return data;
}

export async function deleteProject(projectId: string): Promise<void> {
  await httpClient.delete(`/projects/${projectId}`);
}

export async function listMembers(
  projectId: string,
  params: MemberListParams = {},
): Promise<PaginatedResponse<ProjectMember>> {
  const { data } = await httpClient.get<PaginatedResponse<ProjectMember>>(
    `/projects/${projectId}/members`,
    { params },
  );
  return data;
}

export async function addMember(projectId: string, dto: AddMemberDto): Promise<ProjectMember> {
  const { data } = await httpClient.post<ProjectMember>(`/projects/${projectId}/members`, dto);
  return data;
}

export async function updateMemberRole(
  projectId: string,
  userId: string,
  role: ProjectRole,
): Promise<ProjectMember> {
  const { data } = await httpClient.patch<ProjectMember>(`/projects/${projectId}/members/${userId}`, {
    role,
  });
  return data;
}

export async function removeMember(projectId: string, userId: string): Promise<void> {
  await httpClient.delete(`/projects/${projectId}/members/${userId}`);
}
