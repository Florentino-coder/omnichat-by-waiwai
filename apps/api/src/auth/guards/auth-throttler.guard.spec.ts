import { Reflector } from "@nestjs/core";
import { ThrottlerStorage } from "@nestjs/throttler";
import { AuthThrottlerGuard } from "./auth-throttler.guard";

class TestableGuard extends AuthThrottlerGuard {
  track(req: Parameters<AuthThrottlerGuard["getTracker"]>[0]): Promise<string> {
    return this.getTracker(req);
  }
}

const createGuard = (): TestableGuard =>
  new TestableGuard([], {} as ThrottlerStorage, new Reflector());

describe("AuthThrottlerGuard", () => {
  it("tracks authenticated requests by user id", async () => {
    await expect(
      createGuard().track({ ip: "1.1.1.1", user: { sub: "user-1" }, body: { email: "a@b.co" } })
    ).resolves.toBe("user:user-1");
  });

  it("tracks login requests by normalized email, not proxy IP", async () => {
    await expect(
      createGuard().track({ ip: "10.0.0.1", body: { email: "  Owner@Example.COM " } })
    ).resolves.toBe("account:owner@example.com");
  });

  it("tracks forgot-password requests by identifier", async () => {
    await expect(
      createGuard().track({ ip: "10.0.0.1", body: { identifier: "owner" } })
    ).resolves.toBe("account:owner");
  });

  it("falls back to IP when no account is supplied", async () => {
    await expect(createGuard().track({ ip: "10.0.0.1", body: {} })).resolves.toBe("ip:10.0.0.1");
  });
});
