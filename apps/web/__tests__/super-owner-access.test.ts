import { authorizedFetch } from "../app/lib/api-client";
import { checkSuperOwnerAccess } from "../app/lib/super-owner-access";

jest.mock("../app/lib/api-client", () => ({
  authorizedFetch: jest.fn()
}));

const authorizedFetchMock = authorizedFetch as jest.Mock;

const respond = (status: number, body: unknown = {}) =>
  authorizedFetchMock.mockResolvedValue({ status, json: async () => body });

describe("checkSuperOwnerAccess", () => {
  beforeEach(() => authorizedFetchMock.mockReset());

  it("allows a successful probe", async () => {
    respond(200);
    await expect(checkSuperOwnerAccess()).resolves.toBe("allowed");
  });

  it.each([500, 502, 503, 504])("does not deny on a %i server error", async (status) => {
    respond(status);
    await expect(checkSuperOwnerAccess()).resolves.toBe("allowed");
  });

  it("does not deny on a network failure", async () => {
    authorizedFetchMock.mockRejectedValue(new Error("Failed to fetch"));
    await expect(checkSuperOwnerAccess()).resolves.toBe("allowed");
  });

  it("denies on 401 and on a plain 403", async () => {
    respond(401);
    await expect(checkSuperOwnerAccess()).resolves.toBe("denied");

    respond(403, { error: { code: "FORBIDDEN" } });
    await expect(checkSuperOwnerAccess()).resolves.toBe("denied");
  });

  it("recognizes the 2FA requirement", async () => {
    respond(403, { error: { code: "SUPER_OWNER_2FA_REQUIRED" } });
    await expect(checkSuperOwnerAccess()).resolves.toBe("two-fa-required");
  });
});
