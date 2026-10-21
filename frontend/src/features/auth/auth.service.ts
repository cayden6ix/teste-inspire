import { httpClient } from '@/services/api/httpClient';
import type { AuthResponse, LoginDto, RegisterDto } from '@/types/auth';

export async function login(dto: LoginDto): Promise<AuthResponse> {
  const { data } = await httpClient.post<AuthResponse>('/auth/login', dto);
  return data;
}

export async function register(dto: RegisterDto): Promise<AuthResponse> {
  const { data } = await httpClient.post<AuthResponse>('/auth/register', dto);
  return data;
}
