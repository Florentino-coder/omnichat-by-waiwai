import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { authFetchOptions } from "./auth-fetch-expect";
import AppLayout from "../app/app/layout";
import SettingsPage from "../app/app/settings/page";
import { LanguageProvider } from "../app/lib/language-context";

jest.mock("../app/lib/language-context", () => ({
  useLanguage: () => ({ locale: "en", setLocale: () => {} }),
  LanguageProvider: ({ children }: any) => <>{children}</>
}));

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() })
}));

jest.mock("../app/lib/use-auth-session", () => ({
  useAuthSession: () => ({
    user: {
      id: "user-1",
      email: "owner@omnichat.local",
      displayName: "Owner",
      role: "OWNER"
    },
    isLoading: false,
    error: null
  })
}));

describe("App shell", () => {
  let mockWorkspaces: any[] = [];
  let mockLineChannels: any[] = [];
  let mockSavedReplies: any[] = [];
  let mockAiUsage: any = null;
  let mockSettings: any = null;
  let mockPromptTemplate: any = null;
  let lastPostData: any = null;
  let fetchMock: jest.Mock<any, any>;

  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("omnichat.accessToken", "access-token");
    window.localStorage.setItem("omnichat.user", JSON.stringify({ role: "OWNER" }));
    window.localStorage.setItem("chatwai.locale", "en");

    mockWorkspaces = [{ id: "workspace-1", name: "Default Workspace", isDefault: true }];
    mockLineChannels = [];
    mockSavedReplies = [];
    mockSettings = {
      inProgressAlertMinutes: 10,
      enableAiSuggest: true,
      aiProvider: "gemini",
      aiAgentGender: "FEMALE"
    };
    mockPromptTemplate = { systemPrompt: "Default Prompt" };
    mockAiUsage = {
      used: 0,
      limit: 20,
      remaining: 20,
      percentage: 0,
      planId: "free",
      periodStart: "2026-06-01T00:00:00.000Z",
      periodEnd: "2026-06-30T23:59:59.000Z",
      providerLabel: "Google Gemini",
      modelName: "gemini-2.5-flash",
      creditsAvailable: true
    };
    lastPostData = null;

    fetchMock = jest.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.includes("/api/v1/auth/me")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: "user-1",
              email: "owner@omnichat.local",
              displayName: "Owner",
              role: "OWNER"
            }
          })
        };
      }

      if (url.includes("/api/v1/users/me")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: "user-1",
              email: "owner@omnichat.local",
              displayName: "Owner",
              role: "OWNER"
            }
          })
        };
      }

      if (url.includes("/api/v1/workspaces")) {
        return {
          ok: true,
          json: async () => ({ success: true, data: mockWorkspaces })
        };
      }
      if (url.includes("/api/v1/line/channels")) {
        if (method === "POST") {
          lastPostData = JSON.parse(init?.body as string);
          const newChannel = {
            id: "line-channel-" + (mockLineChannels.length + 1),
            name: lastPostData.name,
            badgeColor: lastPostData.badgeColor,
            lineChannelId: lastPostData.lineChannelId,
            workspaceId: lastPostData.workspaceId,
            createdAt: new Date().toISOString()
          };
          mockLineChannels.push(newChannel);
          return {
            ok: true,
            json: async () => ({ success: true, data: newChannel })
          };
        }
        if (method === "DELETE") {
          const channelId = url.split("/").pop();
          mockLineChannels = mockLineChannels.filter((channel) => channel.id !== channelId);
          return {
            status: 204,
            ok: true,
            json: async () => {
              throw new SyntaxError("Unexpected end of JSON input");
            }
          };
        }
        return {
          ok: true,
          json: async () => ({ success: true, data: mockLineChannels })
        };
      }
      if (url.includes("/api/v1/inbox/saved-replies")) {
        if (method === "POST") {
          const body = JSON.parse(init?.body as string);
          const newReply = {
            id: "reply-" + (mockSavedReplies.length + 1),
            lineChannelId: body.lineChannelId,
            title: body.title,
            body: body.body,
            isActive: true
          };
          mockSavedReplies.push(newReply);
          return {
            ok: true,
            json: async () => ({ success: true, data: newReply })
          };
        }
        if (method === "DELETE") {
          const id = url.split("/").pop();
          mockSavedReplies = mockSavedReplies.filter(r => r.id !== id);
          return {
            ok: true,
            json: async () => ({ success: true, data: { id } })
          };
        }
        return {
          ok: true,
          json: async () => ({ success: true, data: mockSavedReplies })
        };
      }
      if (url.includes("/api/v1/inbox/settings")) {
        if (method === "PATCH") {
          const body = JSON.parse(init?.body as string);
          mockSettings = { ...mockSettings, ...body };
          return {
            ok: true,
            json: async () => ({ success: true, data: mockSettings })
          };
        }
        return {
          ok: true,
          json: async () => ({ success: true, data: mockSettings })
        };
      }
      if (url.includes("/api/v1/inbox/prompt-templates")) {
        return {
          ok: true,
          json: async () => ({ success: true, data: mockPromptTemplate })
        };
      }
      if (url.includes("/api/v1/inbox/ai-usage")) {
        return {
          ok: true,
          json: async () => ({ success: true, data: mockAiUsage })
        };
      }
      if (url.includes("/api/v1/scenarios")) {
        return {
          ok: true,
          json: async () => ({ success: true, data: [] })
        };
      }
      if (url.includes("/api/v1/automations")) {
        return {
          ok: true,
          json: async () => ({ success: true, data: [] })
        };
      }
      return {
        ok: true,
        json: async () => ({ success: true, data: null })
      };
    });

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });
  });

  afterEach(() => {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("renders icon rail, enabled inbox nav, disabled future nav, and settings content", async () => {
    render(
      <AppLayout>
        <SettingsPage />
      </AppLayout>
    );

    const nav = screen.getByLabelText("Primary");
    expect(nav).toHaveClass("w-14");

    expect(screen.getByRole("link", { name: "Inbox" })).toHaveAttribute(
      "href",
      "/app/inbox"
    );
    expect(screen.getAllByRole("link", { name: "Settings" })[0]).toHaveAttribute(
      "href",
      "/app/settings"
    );

    const customersButton = within(nav).queryByRole("button", { name: "Customers" });
    expect(customersButton).not.toBeInTheDocument();

    expect(within(nav).getByRole("link", { name: "Reports" })).toHaveAttribute(
      "href",
      "/app/reports"
    );
    expect(within(nav).getByRole("link", { name: "Knowledge" })).toHaveAttribute(
      "href",
      "/app/settings?tab=knowledge&sub=documents"
    );

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(await screen.findByText("No LINE channel connected yet.")).toBeInTheDocument();
  });

  it(
    "posts LINE channel settings from the settings page",
    async () => {
    render(
      <LanguageProvider>
        <SettingsPage />
      </LanguageProvider>
    );

    expect(await screen.findByText("Default Workspace")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Channel name"), {
      target: { value: "Main LINE OA" }
    });
    fireEvent.change(screen.getByLabelText("LINE channel ID"), {
      target: { value: "1234567890" }
    });
    fireEvent.change(screen.getByLabelText("Channel secret"), {
      target: { value: "line-secret-value" }
    });
    fireEvent.change(screen.getByLabelText("Channel access token"), {
      target: { value: "line-access-token-value" }
    });
    fireEvent.change(screen.getByLabelText("Badge color"), {
      target: { value: "#0ea5e9" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Add LINE OA channel" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/line/channels", authFetchOptions({
        body: JSON.stringify({
          channelAccessToken: "line-access-token-value",
          channelSecret: "line-secret-value",
          badgeColor: "#0ea5e9",
          lineChannelId: "1234567890",
          name: "Main LINE OA",
          workspaceId: "workspace-1"
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      }));
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/workspaces", authFetchOptions());
    expect(await screen.findByText("LINE channel saved. Webhook ready for production test.")).toBeInTheDocument();
    expect(
      await screen.findByText(`${window.location.origin}/api/v1/line/webhook/1234567890`)
    ).toBeInTheDocument();
    },
    15000
  );

  it("keeps the LINE settings form ready for adding multiple OA channels", async () => {
    mockLineChannels = [
      {
        id: "line-channel-1",
        name: "Line OA 1",
        badgeColor: "#4f46e5",
        lineChannelId: "1111111111",
        workspaceId: "workspace-1",
        createdAt: "2026-06-14T01:02:00.000Z"
      }
    ];

    render(
      <LanguageProvider>
        <SettingsPage />
      </LanguageProvider>
    );

    const nameInput = await screen.findByLabelText("Channel name");
    expect(nameInput).toHaveValue("");
    fireEvent.change(nameInput, {
      target: { value: "Line OA 2" }
    });
    fireEvent.change(screen.getByLabelText("LINE channel ID"), {
      target: { value: "2222222222" }
    });
    fireEvent.change(screen.getByLabelText("Channel secret"), {
      target: { value: "line-secret-two" }
    });
    fireEvent.change(screen.getByLabelText("Channel access token"), {
      target: { value: "line-access-token-two" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Add LINE OA channel" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/line/channels", authFetchOptions({
        body: JSON.stringify({
          channelAccessToken: "line-access-token-two",
          channelSecret: "line-secret-two",
          badgeColor: "#4f46e5",
          lineChannelId: "2222222222",
          name: "Line OA 2",
          workspaceId: "workspace-1"
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      }));
    });
    expect(await screen.findByText("2 connected")).toBeInTheDocument();
    expect(nameInput).toHaveValue("");
  });

  it("deletes a LINE channel with 204 and keeps the session", async () => {
    mockLineChannels = [
      {
        id: "line-channel-1",
        name: "Line OA 1",
        badgeColor: "#4f46e5",
        lineChannelId: "1111111111",
        workspaceId: "workspace-1",
        createdAt: "2026-06-14T01:02:00.000Z"
      }
    ];

    render(
      <LanguageProvider>
        <SettingsPage />
      </LanguageProvider>
    );

    expect(await screen.findByRole("button", { name: "ลบ channel" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ลบ channel" }));
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันลบ" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/line/channels/line-channel-1",
        authFetchOptions({ method: "DELETE" })
      );
    });
    expect(await screen.findByText("No LINE channel connected yet.")).toBeInTheDocument();
    expect(window.location.href).not.toContain("/login");
  });

  it("manages quick replies per LINE OA from settings", async () => {
    window.localStorage.setItem("omnichat.user", JSON.stringify({ id: "user-1", role: "OWNER" }));
    
    mockLineChannels = [
      {
        id: "line-channel-1",
        name: "Line OA 1",
        badgeColor: "#0ea5e9",
        lineChannelId: "1234567890",
        workspaceId: "workspace-1",
        createdAt: "2026-06-14T01:02:00.000Z"
      }
    ];

    mockSavedReplies = [
      {
        id: "reply-1",
        lineChannelId: "line-channel-1",
        title: "Greeting",
        body: "Hello customer",
        isActive: true
      }
    ];

    render(
      <LanguageProvider>
        <SettingsPage />
      </LanguageProvider>
    );

    expect(await screen.findByText("Line OA 1 : Quick Reply Greeting")).toBeInTheDocument();
    
    fireEvent.change(screen.getByLabelText("Quick Reply title"), {
      target: { value: "Price" }
    });
    fireEvent.change(screen.getByLabelText("Quick Reply body"), {
      target: { value: "Price details" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Quick Reply" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/inbox/saved-replies", authFetchOptions({
        body: JSON.stringify({
          lineChannelId: "line-channel-1",
          title: "Price",
          body: "Price details"
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      }));
    });
    expect(await screen.findByText("Line OA 1 : Quick Reply Price")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete Quick Reply Greeting" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/inbox/saved-replies/reply-1", authFetchOptions({
        method: "DELETE"
      }));
    });
  });
});
