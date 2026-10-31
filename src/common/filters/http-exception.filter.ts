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
import { Prisma } from '../../generated/prisma/client.js';

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

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        response.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          message: 'A resource with this identifier already exists',
          traceId,
        });
        return;
      }
      if (exception.code === 'P2025' || exception.code === 'P2001') {
        response.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Resource not found',
          traceId,
        });
        return;
      }
      if (exception.code === 'P2003' || exception.code === 'P2023') {
        response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message:
            exception.code === 'P2023'
              ? 'Invalid identifier or data type'
              : 'Foreign key constraint violated',
          traceId,
        });
        return;
      }
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
