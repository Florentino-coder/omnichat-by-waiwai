import { CallHandler, ExecutionContext, HttpStatus } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { firstValueFrom, of } from "rxjs";
import { ResponseEnvelopeInterceptor } from "./response-envelope.interceptor";

const context = {
  getHandler: () => ({}),
  getClass: () => ({})
} as ExecutionContext;

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

  it("does not wrap NO_CONTENT handlers so 204 responses stay empty", async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, "get").mockReturnValue(HttpStatus.NO_CONTENT);

    const interceptor = new ResponseEnvelopeInterceptor(reflector);
    const handler: CallHandler<undefined> = {
      handle: () => of(undefined)
    };
    const noContentContext = {
      getHandler: () => ({}),
      getClass: () => ({})
    } as ExecutionContext;

    await expect(firstValueFrom(interceptor.intercept(noContentContext, handler))).resolves.toBeUndefined();
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
