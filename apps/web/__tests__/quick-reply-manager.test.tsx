import { render, screen, waitFor } from "@testing-library/react";
import { QuickReplyManager } from "../app/app/settings/quick-reply-manager";

jest.mock("../app/lib/language-context", () => ({
  useLanguage: () => ({ locale: "en", setLocale: () => {} }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

const mockUseAuthSession = jest.fn();

jest.mock("../app/lib/use-auth-session", () => ({
  useAuthSession: () => mockUseAuthSession()
}));

function resolveFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

describe("QuickReplyManager RBAC", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("omnichat.accessToken", "access-token");
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  function mockFetchForQuickReplies(): jest.Mock {
    return jest.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = resolveFetchUrl(input);

      if (url.includes("/api/v1/auth/refresh")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: {} })
        };
      }
      if (url.includes("/api/v1/line/channels")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: [{ id: "channel-1", name: "Test OA", lineChannelId: "line-1" }]
          })
        };
      }
      if (url.includes("/api/v1/inbox/saved-replies")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: [
              {
                id: "reply-1",
                title: "Greeting",
                body: "Hello",
                shortcutKey: "hi"
              }
            ]
          })
        };
      }
      return { ok: true, status: 200, json: async () => ({ success: true, data: [] }) };
    });
  }

  it("shows shared quick reply add/edit controls for OWNER with empty localStorage", async () => {
    mockUseAuthSession.mockReturnValue({
      user: {
        id: "owner-1",
        email: "owner@omnichat.local",
        displayName: "Owner",
        role: "OWNER"
      },
      isLoading: false,
      error: null
    });

    globalThis.fetch = mockFetchForQuickReplies();

    render(<QuickReplyManager />);

    await waitFor(() => {
      expect(screen.getByLabelText("Quick Reply title")).toBeInTheDocument();
    });

    expect(
      await screen.findByLabelText("Edit Quick Reply Greeting")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Delete Quick Reply Greeting")).toBeInTheDocument();
    expect(
      screen.queryByText(/Only owners and administrators can manage shared quick replies/)
    ).not.toBeInTheDocument();
  });

  it("blocks AGENT from managing shared quick replies", async () => {
    mockUseAuthSession.mockReturnValue({
      user: {
        id: "agent-1",
        email: "agent@omnichat.local",
        displayName: "Agent",
        role: "AGENT"
      },
      isLoading: false,
      error: null
    });

    globalThis.fetch = mockFetchForQuickReplies();

    render(<QuickReplyManager />);

    await waitFor(() => {
      expect(
        screen.getByText(/Only owners and administrators can manage shared quick replies/)
      ).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Quick Reply title")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Edit Quick Reply Greeting")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Delete Quick Reply Greeting")).not.toBeInTheDocument();
  });
});
