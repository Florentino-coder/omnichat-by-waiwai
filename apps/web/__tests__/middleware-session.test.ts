import { AUTH_COOKIE_NAMES } from "../app/lib/auth-cookie-names";
import { resolveMiddlewareSession } from "../app/lib/middleware-session";
import { verifyAccessToken } from "../app/lib/jwt-edge";

jest.mock("../app/lib/jwt-edge", () => ({
  verifyAccessToken: jest.fn()
}));

const verifyAccessTokenMock = verifyAccessToken as jest.MockedFunction<typeof verifyAccessToken>;

describe("resolveMiddlewareSession", () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
    verifyAccessTokenMock.mockReset();
  });

  it("returns null when the access token cookie is missing", async () => {
    await expect(resolveMiddlewareSession("omnichat.session=1")).resolves.toBeNull();
  });

  it("allows marker fallback when access token is missing but refresh token exists", async () => {
    const cookieHeader = [
      `${AUTH_COOKIE_NAMES.refreshToken}=refresh-token`,
      `${AUTH_COOKIE_NAMES.session}=1`,
      `${AUTH_COOKIE_NAMES.tenantId}=tenant-b`,
      `${AUTH_COOKIE_NAMES.workspaceId}=workspace-b`
    ].join("; ");

    await expect(resolveMiddlewareSession(cookieHeader)).resolves.toEqual({
      isSuperOwner: false,
      tenantId: "tenant-b",
      workspaceId: "workspace-b"
    });
  });

  it("uses verified JWT claims when JWT verification succeeds", async () => {
    process.env.JWT_SECRET = "test-jwt-secret";
    verifyAccessTokenMock.mockResolvedValue({
      sub: "user-1",
      tenantId: "tenant-a",
      workspaceId: "workspace-a",
      isSuperOwner: false
    });

    const cookieHeader = `${AUTH_COOKIE_NAMES.accessToken}=signed-token; ${AUTH_COOKIE_NAMES.session}=1`;

    await expect(resolveMiddlewareSession(cookieHeader)).resolves.toEqual({
      isSuperOwner: false,
      tenantId: "tenant-a",
      workspaceId: "workspace-a"
    });
    expect(verifyAccessTokenMock).toHaveBeenCalledWith("signed-token", "test-jwt-secret");
  });

  it("falls back to session marker cookies when JWT verification fails", async () => {
    process.env.JWT_SECRET = "test-jwt-secret";
    verifyAccessTokenMock.mockResolvedValue(null);

    const cookieHeader = [
      `${AUTH_COOKIE_NAMES.accessToken}=opaque-token`,
      `${AUTH_COOKIE_NAMES.session}=1`,
      `${AUTH_COOKIE_NAMES.tenantId}=tenant-b`,
      `${AUTH_COOKIE_NAMES.workspaceId}=workspace-b`
    ].join("; ");

    await expect(resolveMiddlewareSession(cookieHeader)).resolves.toEqual({
      isSuperOwner: false,
      tenantId: "tenant-b",
      workspaceId: "workspace-b"
    });
  });

  it("falls back to tenant marker cookies when JWT verification fails without session marker", async () => {
    process.env.JWT_SECRET = "test-jwt-secret";
    verifyAccessTokenMock.mockResolvedValue(null);

    const cookieHeader = [
      `${AUTH_COOKIE_NAMES.accessToken}=opaque-token`,
      `${AUTH_COOKIE_NAMES.tenantId}=tenant-b`,
      `${AUTH_COOKIE_NAMES.workspaceId}=workspace-b`
    ].join("; ");

    await expect(resolveMiddlewareSession(cookieHeader)).resolves.toEqual({
      isSuperOwner: false,
      tenantId: "tenant-b",
      workspaceId: "workspace-b"
    });
  });

  it("merges tenant markers into verified JWT claims when payload lacks tenant context", async () => {
    process.env.JWT_SECRET = "test-jwt-secret";
    verifyAccessTokenMock.mockResolvedValue({
      sub: "user-1",
      isSuperOwner: false
    });

    const cookieHeader = [
      `${AUTH_COOKIE_NAMES.accessToken}=signed-token`,
      `${AUTH_COOKIE_NAMES.tenantId}=tenant-b`,
      `${AUTH_COOKIE_NAMES.workspaceId}=workspace-b`
    ].join("; ");

    await expect(resolveMiddlewareSession(cookieHeader)).resolves.toEqual({
      isSuperOwner: false,
      tenantId: "tenant-b",
      workspaceId: "workspace-b"
    });
  });

  it("requires marker fallback when JWT verification fails", async () => {
    process.env.JWT_SECRET = "test-jwt-secret";
    verifyAccessTokenMock.mockResolvedValue(null);

    const cookieHeader = `${AUTH_COOKIE_NAMES.accessToken}=opaque-token`;

    await expect(resolveMiddlewareSession(cookieHeader)).resolves.toBeNull();
  });
});
