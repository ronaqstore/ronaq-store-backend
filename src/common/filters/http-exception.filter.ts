import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { TraceLoggerService } from '../logger/trace-logger.service.js';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: TraceLoggerService,
    private readonly cls: ClsService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const traceId = this.cls.getId?.() ?? 'no-trace';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const body =
        typeof exceptionResponse === 'string'
          ? { statusCode: status, message: exceptionResponse, traceId }
          : {
              ...(exceptionResponse as Record<string, unknown>),
              statusCode: status,
              traceId,
            };
      response.status(status).json(body);
      return;
    }

    this.logger.error(
      `Unhandled exception: ${exception instanceof Error ? exception.message : String(exception)}`,
      exception instanceof Error ? exception.stack : undefined,
      'GlobalHttpExceptionFilter',
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      traceId,
    });
  }
}
