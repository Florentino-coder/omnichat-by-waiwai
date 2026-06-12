import { CallHandler, ExecutionContext } from "@nestjs/common";
import { firstValueFrom, of } from "rxjs";
import { ResponseEnvelopeInterceptor } from "./response-envelope.interceptor";

const context = {} as ExecutionContext;

describe("ResponseEnvelopeInterceptor", () => {
  it("wraps controller data in a success envelope", async () => {
    const interceptor = new ResponseEnvelopeInterceptor();
    const handler: CallHandler<{ id: string }> = {
      handle: () => of({ id: "tenant-1" })
    };

    await expect(firstValueFrom(interceptor.intercept(context, handler))).resolves.toEqual({
      success: true,
      data: { id: "tenant-1" }
    });
  });

  it("uses null data for undefined controller responses", async () => {
    const interceptor = new ResponseEnvelopeInterceptor();
    const handler: CallHandler<undefined> = {
      handle: () => of(undefined)
    };

    await expect(firstValueFrom(interceptor.intercept(context, handler))).resolves.toEqual({
      success: true,
      data: null
    });
  });

  it("does not double-wrap an existing envelope", async () => {
    const interceptor = new ResponseEnvelopeInterceptor();
    const envelope = {
      success: true as const,
      data: { ok: true }
    };
    const handler: CallHandler<typeof envelope> = {
      handle: () => of(envelope)
    };

    await expect(firstValueFrom(interceptor.intercept(context, handler))).resolves.toBe(
      envelope
    );
  });
});
