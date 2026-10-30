import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { JwtTenantPayload } from "../../auth/types/auth.types";
import { SuperOwnerGuard } from "./super-owner.guard";

const contextFor = (user?: Partial<JwtTenantPayload>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) })
  }) as unknown as ExecutionContext;

describe("SuperOwnerGuard", () => {
  const guard = new SuperOwnerGuard();

  it("allows a super owner with 2FA enabled", () => {
    expect(guard.canActivate(contextFor({ isSuperOwner: true, twoFaEnabled: true }))).toBe(true);
  });

  it("denies other users", () => {
    expect(guard.canActivate(contextFor({ isSuperOwner: false, twoFaEnabled: true }))).toBe(false);
    expect(guard.canActivate(contextFor(undefined))).toBe(false);
  });

  it.each([[false], [undefined]])("requires 2FA when twoFaEnabled is %s", (twoFaEnabled) => {
    expect(() =>
      guard.canActivate(contextFor({ isSuperOwner: true, twoFaEnabled }))
    ).toThrow(ForbiddenException);
  });
});
