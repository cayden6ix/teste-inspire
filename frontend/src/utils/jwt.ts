/**
 * Id do usuário (`sub`) guardado no JWT. Lê só o payload, sem validar assinatura: serve apenas
 * para a tela saber qual linha é a do próprio usuário (a API continua sendo quem autoriza).
 */
export function userIdFromToken(token: string | null): string | null {
  if (!token) return null;

  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const sub = (JSON.parse(json) as { sub?: unknown }).sub;

    return typeof sub === 'string' ? sub : null;
  } catch {
    return null;
  }
}
