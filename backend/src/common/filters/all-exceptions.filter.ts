import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import {
  DATABASE_ERRORS,
  ENGLISH_DEFAULT_MESSAGES,
  INTERNAL_ERROR_MESSAGE,
  ROUTE_NOT_FOUND_MESSAGE,
  STATUS_MESSAGES,
  TECHNICAL_MESSAGE_PATTERNS,
  UNIQUE_CONSTRAINT_MESSAGES,
} from '../messages/http-messages.js';

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
  requestId?: string;
}

/** Erro do Postgres reconhecido: status e mensagem ja resolvidos. */
interface DatabaseError {
  status: number;
  message: string;
}

/**
 * Filtro global de excecoes.
 *
 * Normaliza toda saida de erro da API para o mesmo contrato, escondendo detalhes
 * internos de erros nao tratados (stack trace e SQL nunca vao ao cliente).
 * Mensagens padrao em ingles sao trocadas por textos em portugues por status.
 * Violacoes de unicidade/FK do banco (corridas entre requisicoes) viram 409/400.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const databaseError = this.resolveDatabaseError(exception);
    const status = databaseError?.status ?? this.resolveStatus(exception);

    const body: ErrorResponseBody = {
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      message: databaseError?.message ?? this.resolveMessage(exception, status),
      path: request.originalUrl ?? request.url,
      timestamp: new Date().toISOString(),
    };

    const requestId = (request as Request & { id?: string }).id;
    if (requestId) {
      body.requestId = requestId;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.originalUrl} -> ${status}: ${String(body.message)}`);
    }

    response.status(status).json(body);
  }

  /**
   * Codigo SQLSTATE do Postgres (`driverError.code`) mapeado para 4xx. Outros erros de
   * banco seguem como 500 generico.
   */
  private resolveDatabaseError(exception: unknown): DatabaseError | null {
    if (!(exception instanceof QueryFailedError)) {
      return null;
    }

    const driverError = exception.driverError as { code?: string; constraint?: string };
    const known = driverError.code ? DATABASE_ERRORS[driverError.code] : undefined;
    if (!known) {
      return null;
    }

    const constraintMessage =
      driverError.code === '23505' && driverError.constraint
        ? UNIQUE_CONSTRAINT_MESSAGES[driverError.constraint]
        : undefined;

    return { status: known.status, message: constraintMessage ?? known.message };
  }

  /**
   * Erros de parsing do body-parser (ex.: 413 de corpo grande) nao sao HttpException,
   * mas trazem o status HTTP em `status`.
   */
  private resolveStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    const status = (exception as { status?: unknown } | null)?.status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return status;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveMessage(exception: unknown, status: number): string | string[] {
    if (!(exception instanceof HttpException)) {
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        return INTERNAL_ERROR_MESSAGE;
      }
      return STATUS_MESSAGES[status] ?? INTERNAL_ERROR_MESSAGE;
    }

    const response = exception.getResponse();
    const message =
      typeof response === 'string'
        ? response
        : ((response as { message?: string | string[] }).message ?? exception.message);

    if (Array.isArray(message)) {
      return message;
    }

    return this.translateMessage(message, status);
  }

  private translateMessage(message: string, status: number): string {
    const technical = TECHNICAL_MESSAGE_PATTERNS.find(([pattern]) => pattern.test(message));
    if (technical) {
      return technical[1];
    }

    if (ENGLISH_DEFAULT_MESSAGES.has(message)) {
      return STATUS_MESSAGES[status] ?? INTERNAL_ERROR_MESSAGE;
    }

    if (status === HttpStatus.NOT_FOUND && /^Cannot [A-Z]+ /.test(message)) {
      return ROUTE_NOT_FOUND_MESSAGE;
    }

    return message;
  }
}
