import { BadRequestException, HttpStatus } from '@nestjs/common';
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
});
