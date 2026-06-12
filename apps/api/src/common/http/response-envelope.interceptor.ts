import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from "@nestjs/common";
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
  implements NestInterceptor<T, SuccessEnvelope<T> | MaybeEnvelope<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>
  ): Observable<SuccessEnvelope<T> | MaybeEnvelope<T>> {
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
