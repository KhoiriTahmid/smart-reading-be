import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

type ErrorResponse = {
  code: string;
  message: string;
  errors: any[];
};

@Catch()
export class CommnonExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext('ExceptionFilter');
  }

  catch(exception: Error, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let errorResponse: ErrorResponse = {
      code: 'general_error',
      message: 'Please contact admin',
      errors: [],
    };

    if (status >= 500) {
      errorResponse = {
        code: 'internal_error',
        message: 'Internal server error',
        errors: [],
      };
    } else if (exception instanceof HttpException) {
      const body = exception.getResponse();

      if (typeof body === 'string') {
        errorResponse = {
          code: HttpStatus[status].toLowerCase(),
          message: body,
          errors: [],
        };
      } else {
        const b = body as Record<string, any>;
        errorResponse = {
          code: b.code ?? b.error?.toLowerCase() ?? 'error',
          message: Array.isArray(b.message)
            ? 'Validation failed'
            : (b.message ?? exception.message),
          errors: Array.isArray(b.message) ? b.message : (b.errors ?? []),
        };
      }
    } else {
      errorResponse = {
        ...errorResponse,
        message: exception.message,
        code: exception.name,
      };
    }

    if (status >= 500) this.logger.error({ err: exception }, 'unhandled error');
    else
      this.logger.warn(
        { status, message: (exception as Error).message },
        'request failed',
      );

    res.status(status).json(errorResponse);
  }
}
