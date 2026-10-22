/**
 * Usuario autenticado, preenchido pelo `JwtStrategy`.
 *
 * O `password` nunca e devolvido pela API.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
