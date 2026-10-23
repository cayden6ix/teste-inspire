import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Libera a rota do `JwtAuthGuard` global (ex.: cadastro, login e health).
 * Toda rota sem este decorator exige token.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
