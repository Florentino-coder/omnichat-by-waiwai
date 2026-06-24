import { render, screen, waitFor } from "@testing-library/react";
import SuperAdminPage from "../app/super-admin/page";
import { useAuthSession } from "../app/lib/use-auth-session";

const replaceMock = jest.fn();
const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock })
}));

jest.mock("../app/lib/use-auth-session", () => ({
  useAuthSession: jest.fn()
}));

const mockedUseAuthSession = useAuthSession as jest.MockedFunction<typeof useAuthSession>;

const superOwnerUser = {
  id: "super-1",
  email: "super@omnichat.local",
  displayName: "Super Owner",
  isSuperOwner: true
};

function mockFetchForSuperAdmin(): jest.Mock {
  return jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/v1/super-admin/backups/health")) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            status: "healthy",
            latestSuccessfulBackup: null,
            latestFailedBackup: null,
            failuresLast7Days: 0,
            backupBucket: "chatwai-backups"
          }
        })
      };
    }
    if (url.includes("/api/v1/super-admin/tenants")) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: []
        })
      };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

describe("SuperAdminPage", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    pushMock.mockClear();
    window.localStorage.clear();
    mockedUseAuthSession.mockReturnValue({
      user: superOwnerUser,
      isLoading: false,
      error: null
    });
  });

  afterEach(() => {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("shows loading state and does not redirect before auth session resolves", () => {
    mockedUseAuthSession.mockReturnValue({
      user: null,
      isLoading: true,
      error: null
    });

    render(<SuperAdminPage />);

    expect(screen.getByText("Verifying authorization...")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("allows super owner with cookie session and empty localStorage", async () => {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: mockFetchForSuperAdmin()
    });

    render(<SuperAdminPage />);

    expect(await screen.findByText("Platform Management Portal")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalledWith("/login");
    expect(window.localStorage.getItem("omnichat.user")).toBeNull();
  });

  it("redirects non-super-owner to login after auth resolves", async () => {
    mockedUseAuthSession.mockReturnValue({
      user: {
        id: "user-1",
        email: "owner@tenant.local",
        displayName: "Owner",
        isSuperOwner: false
      },
      isLoading: false,
      error: null
    });

    render(<SuperAdminPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login");
    });
  });

  it("redirects unauthenticated users to login after auth resolves", async () => {
    mockedUseAuthSession.mockReturnValue({
      user: null,
      isLoading: false,
      error: null
    });

    render(<SuperAdminPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login");
    });
  });
});
