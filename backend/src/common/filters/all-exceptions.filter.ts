import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
  requestId?: string;
}

/**
 * Filtro global de excecoes.
 *
 * Normaliza toda saida de erro da API para o mesmo contrato, hiding detalhes
 * internos de erros nao tratados (stack trace nunca e exposto ao cliente).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body: ErrorResponseBody = {
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      message: this.resolveMessage(exception, status),
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

  private resolveMessage(exception: unknown, status: number): string | string[] {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return response;
      }

      const message = (response as { message?: string | string[] }).message;
      if (Array.isArray(message)) {
        return message;
      }
      if (typeof message === 'string') {
        return message;
      }

      return exception.message;
    }

    return 'Erro interno do servidor';
  }
}
