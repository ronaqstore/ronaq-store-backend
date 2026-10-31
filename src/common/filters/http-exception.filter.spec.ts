import { BadRequestException, HttpStatus } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { GlobalHttpExceptionFilter } from './http-exception.filter.js';

describe('GlobalHttpExceptionFilter', () => {
  const logger = { error: jest.fn() };
  const cls = { getId: () => 'trace-test' };
  const filter = new GlobalHttpExceptionFilter(logger as never, cls as never);

  function mockHost(statusSpy: jest.Mock, jsonSpy: jest.Mock) {
    return {
      switchToHttp: () => ({
        getResponse: () => ({
          status: statusSpy.mockReturnValue({ json: jsonSpy }),
        }),
      }),
    };
  }

  it('returns HttpException body with traceId and no stack', () => {
    const statusSpy = jest.fn();
    const jsonSpy = jest.fn();
    filter.catch(
      new BadRequestException('Invalid store slug'),
      mockHost(statusSpy, jsonSpy) as never,
    );
    expect(statusSpy).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: expect.anything(),
        traceId: 'trace-test',
      }),
    );
    const body = jsonSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(body.stack).toBeUndefined();
  });

  it('maps unknown errors to generic 500 without leaking message', () => {
    const statusSpy = jest.fn();
    const jsonSpy = jest.fn();
    filter.catch(
      new Error('prisma P2002 secret detail'),
      mockHost(statusSpy, jsonSpy) as never,
    );
    expect(statusSpy).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonSpy).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      traceId: 'trace-test',
    });
    expect(logger.error).toHaveBeenCalled();
  });

  it('maps unhandled IMEI unique violation to 400 Bad Request', () => {
    const statusSpy = jest.fn();
    const jsonSpy = jest.fn();
    const p2010 = new Prisma.PrismaClientKnownRequestError(
      'Raw query failed: IMEI already exists in this shop',
      { code: 'P2010', clientVersion: '7.0.0', meta: {} },
    );
    filter.catch(p2010, mockHost(statusSpy, jsonSpy) as never);
    expect(statusSpy).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'IMEI already exists in inventory',
        traceId: 'trace-test',
      }),
    );
  });

  it('maps Prisma P2002 unique constraint violation to 409 Conflict', () => {
    const statusSpy = jest.fn();
    const jsonSpy = jest.fn();
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`name`)',
      { code: 'P2002', clientVersion: '7.0.0', meta: { target: ['name'] } },
    );
    filter.catch(p2002, mockHost(statusSpy, jsonSpy) as never);
    expect(statusSpy).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.CONFLICT,
        message: 'A resource with this identifier already exists',
        traceId: 'trace-test',
      }),
    );
  });

  it('maps Prisma P2025 record not found to 404 Not Found', () => {
    const statusSpy = jest.fn();
    const jsonSpy = jest.fn();
    const p2025 = new Prisma.PrismaClientKnownRequestError(
      'Record to update not found',
      { code: 'P2025', clientVersion: '7.0.0', meta: {} },
    );
    filter.catch(p2025, mockHost(statusSpy, jsonSpy) as never);
    expect(statusSpy).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Resource not found',
        traceId: 'trace-test',
      }),
    );
  });

  it('maps Prisma P2023 invalid data/UUID to 400 Bad Request', () => {
    const statusSpy = jest.fn();
    const jsonSpy = jest.fn();
    const p2023 = new Prisma.PrismaClientKnownRequestError(
      'Inconsistent column data: invalid input syntax for type uuid',
      { code: 'P2023', clientVersion: '7.0.0', meta: {} },
    );
    filter.catch(p2023, mockHost(statusSpy, jsonSpy) as never);
    expect(statusSpy).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid identifier or data type',
        traceId: 'trace-test',
      }),
    );
  });
});
