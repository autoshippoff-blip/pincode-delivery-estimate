import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_SERVER_ERROR';

    if (exception instanceof ZodValidationException) {
      statusCode = HttpStatus.BAD_REQUEST;
      const error = exception.getZodError() as any;
      errorCode = 'VALIDATION_ERROR';
      const issues = error.issues || [];
      message = issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const resContent = exception.getResponse() as any;
      errorCode = resContent.error || 'HTTP_ERROR';
      message = typeof resContent === 'object' && resContent.message ? resContent.message : exception.message;
    } else if (exception instanceof Error) {
      // In production, we do not expose raw error messages for internal exceptions
      if (process.env.NODE_ENV !== 'production') {
        message = exception.message;
      }
    }

    response.status(statusCode).json({
      success: false,
      error: errorCode,
      message,
      statusCode,
    });
  }
}
