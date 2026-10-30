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
import { isImeiUniqueViolation } from '../../helpers/prisma-error-helper.js';

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

    if (isImeiUniqueViolation(exception)) {
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'IMEI already exists in inventory',
        errors: [
          'A phone with this IMEI is already IN_STOCK in this shop. IMEIs must be unique inside a shop.',
        ],
        traceId,
      });
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
