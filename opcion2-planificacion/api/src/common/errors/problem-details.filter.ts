import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { STATUS_CODES } from 'http';
import { Response } from 'express';
import { ProblemDetailsException } from './problem-details.exception';
import { ProblemDetailsBody } from './problem-details.types';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;

    let detail = 'Error interno del servidor';

    if (exception instanceof ProblemDetailsException) {
      detail = exception.detail;
    } else if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        detail = body;
      } else if (body && typeof body === 'object') {
        const message = (body as { message?: unknown }).message;
        if (Array.isArray(message)) {
          detail = message.join('; ');
        } else if (typeof message === 'string') {
          detail = message;
        } else {
          detail = exception.message;
        }
      } else {
        detail = exception.message;
      }
    }

    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    const title = STATUS_CODES[status] ?? 'Error';
    const payload: ProblemDetailsBody = {
      type: 'about:blank',
      title,
      status,
      detail,
    };

    response.setHeader('Content-Type', 'application/problem+json');
    response.status(status).json(payload);
  }
}
