/**
 * Limites dos campos da conta, os mesmos da API (CreateUserDto e LoginDto).
 * A senha vai ate 72 caracteres porque o bcrypt ignora o que passa disso.
 */
export const NAME_MAX_LENGTH = 120;
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 72;
