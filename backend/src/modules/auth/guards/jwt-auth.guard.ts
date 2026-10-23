import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator.js';
import {
  TOKEN_EXPIRED_MESSAGE,
  TOKEN_INVALID_MESSAGE,
  STATUS_MESSAGES,
} from '../../../common/messages/http-messages.js';

/**
 * Guard global (APP_GUARD): toda rota exige token, exceto as marcadas com `@Public()`.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * Mantem o erro original quando ele ocorre (ex.: falha de banco) e
   * diferencia token expirado, token invalido e ausencia de token.
   */
  handleRequest<TUser = unknown>(err: Error | null, user: TUser | false, info: unknown): TUser {
    if (err) {
      throw err;
    }

    if (!user) {
      throw new UnauthorizedException(this.resolveMessage(info));
    }

    return user;
  }

  private resolveMessage(info: unknown): string {
    const name = (info as { name?: string } | undefined)?.name;

    if (name === 'TokenExpiredError') {
      return TOKEN_EXPIRED_MESSAGE;
    }

    if (name === 'JsonWebTokenError') {
      return TOKEN_INVALID_MESSAGE;
    }

    return STATUS_MESSAGES[401];
  }
}
