import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

/** Domain error carrying the stable envelope code. */
export class DomainError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string, id: string) => new DomainError(404, 'NOT_FOUND', `${what} not found`, { id });
export const badRequest = (message: string, details?: unknown) =>
  new DomainError(400, 'VALIDATION_FAILED', message, details);
export const conflict = (code: string, message: string, details?: unknown) =>
  new DomainError(409, code, message, details);
export const unprocessable = (code: string, message: string, details?: unknown) =>
  new DomainError(422, code, message, details);

/** Emits `{code,message,details,requestId}` for every error. */
@Catch()
export class ErrorEnvelopeFilter implements ExceptionFilter {
  private readonly log = new Logger('Error');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = req.requestId ?? 'unknown';

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL';
    let message = 'Unexpected server error';
    let details: unknown;

    if (exception instanceof DomainError) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as { message?: unknown } | string;
      code = status === 404 ? 'NOT_FOUND' : status === 400 ? 'VALIDATION_FAILED' : `HTTP_${status}`;
      if (typeof body === 'string') message = body;
      else {
        message = Array.isArray(body.message)
          ? 'Request validation failed'
          : typeof body.message === 'string'
            ? body.message
            : exception.message;
        if (Array.isArray(body.message)) details = body.message;
      }
    } else {
      this.log.error(exception instanceof Error ? exception.stack : String(exception));
    }
    res.status(status).json({ code, message, details: details ?? null, requestId });
  }
}
