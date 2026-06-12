import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common";

interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface HttpResponseLike {
  status(statusCode: number): {
    json(body: ErrorEnvelope): void;
  };
}

interface ExceptionBody {
  message?: string | string[];
  error?: string;
  details?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponseLike>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const envelope = this.toEnvelope(status, body);

    if (!(exception instanceof HttpException)) {
      this.logger.error("Unhandled exception", exception);
    }

    response.status(status).json(envelope);
  }

  private toEnvelope(status: number, body: string | object | undefined): ErrorEnvelope {
    if (typeof body === "string") {
      return {
        success: false,
        error: {
          code: this.codeFromStatus(status),
          message: body
        }
      };
    }

    const exceptionBody = this.isExceptionBody(body) ? body : {};
    const message = this.messageFromBody(status, exceptionBody);
    const details = Array.isArray(exceptionBody.message)
      ? exceptionBody.message
      : exceptionBody.details;

    return {
      success: false,
      error: {
        code: this.codeFromStatus(status),
        message,
        ...(details ? { details } : {})
      }
    };
  }

  private isExceptionBody(value: string | object | undefined): value is ExceptionBody {
    return !!value && typeof value === "object";
  }

  private messageFromBody(status: number, body: ExceptionBody): string {
    if (typeof body.message === "string") {
      return body.message;
    }

    if (body.error) {
      return body.error;
    }

    return this.defaultMessage(status);
  }

  private codeFromStatus(status: number): string {
    return this.defaultMessage(status).toUpperCase().replaceAll(" ", "_");
  }

  private defaultMessage(status: number): string {
    return HttpStatus[status] ? this.titleCase(HttpStatus[status]) : "Internal Server Error";
  }

  private titleCase(value: string): string {
    return value
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
}
