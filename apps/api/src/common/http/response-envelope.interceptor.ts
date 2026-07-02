import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { HTTP_CODE_METADATA } from "@nestjs/common/constants";
import { Observable, map } from "rxjs";

export interface SuccessEnvelope<T> {
  success: true;
  data: T | null;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

type MaybeEnvelope<T> =
  | SuccessEnvelope<T>
  | {
      success: false;
      error: unknown;
    };

@Injectable()
export class ResponseEnvelopeInterceptor<T>
  implements NestInterceptor<T, SuccessEnvelope<T> | MaybeEnvelope<T> | void>
{
  constructor(private readonly reflector: Reflector = new Reflector()) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>
  ): Observable<SuccessEnvelope<T> | MaybeEnvelope<T> | void> {
    // Bypassing SSE endpoints from response wrapping
    if (context.getType() === "http") {
      const request = context.switchToHttp().getRequest<any>();
      if (
        request?.headers?.accept === "text/event-stream" ||
        request?.path?.includes("/sse/")
      ) {
        return next.handle();
      }
    }

    const statusCode = this.reflector.get<number>(
      HTTP_CODE_METADATA,
      context.getHandler()
    );

    if (statusCode === HttpStatus.NO_CONTENT) {
      return next.handle().pipe(map(() => undefined));
    }

    return next.handle().pipe(map((data) => this.wrap(data)));
  }

  private wrap(data: T): SuccessEnvelope<T> | MaybeEnvelope<T> {
    if (this.isEnvelope(data)) {
      return data;
    }

    return {
      success: true,
      data: data ?? null
    };
  }

  private isEnvelope(value: unknown): value is MaybeEnvelope<T> {
    if (!value || typeof value !== "object") {
      return false;
    }

    return "success" in value && ("data" in value || "error" in value);
  }
}
