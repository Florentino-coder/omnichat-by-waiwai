/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { authFetchOptions } from "./auth-fetch-expect";
import BroadcastPage from "../app/app/broadcast/page";
import { LineChannelForm } from "../app/app/settings/line-channel-form";
import { LanguageProvider } from "../app/lib/language-context";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams()
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

describe("DELETE 204 integration", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("omnichat.accessToken", "access-token");

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

      if (url.includes("/api/v1/workspaces")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [{ id: "workspace-1", name: "Default Workspace", isDefault: true }]
          })
        };
      }

      if (url.includes("/api/v1/line/channels/ch-1/broadcasts/job-1") && method === "DELETE") {
        return {
          status: 204,
          ok: true,
          json: async () => {
            throw new SyntaxError("Unexpected end of JSON input");
          }
        };
      }

      if (url.match(/\/api\/v1\/line\/channels\/[^/]+$/) && method === "DELETE") {
        return {
          status: 204,
          ok: true,
          json: async () => {
            throw new SyntaxError("Unexpected end of JSON input");
          }
        };
      }

      if (url.includes("/api/v1/line/channels/ch-1/broadcasts")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: "job-1",
                type: "BROADCAST",
                status: "PENDING",
                recipientCount: 10,
                messages: [{ type: "text", text: "Hello" }],
                scheduledAt: "2099-01-01T10:00:00.000Z",
                sentAt: null,
                errorMessage: null,
                createdAt: "2026-06-01T00:00:00.000Z"
              }
            ]
          })
        };
      }

      if (url.includes("/api/v1/line/channels")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: "ch-1",
                name: "Main OA",
                badgeColor: "#4f46e5",
                lineChannelId: "1234567890",
                workspaceId: "workspace-1",
                createdAt: "2026-06-01T00:00:00.000Z"
              }
            ]
          })
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

  it("deletes a LINE channel via settings UI without logging out", async () => {
    render(
      <LanguageProvider>
        <LineChannelForm />
      </LanguageProvider>
    );

    expect(await screen.findByRole("button", { name: "ลบ channel" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ลบ channel" }));
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันลบ" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/line/channels/ch-1",
        authFetchOptions({ method: "DELETE" })
      );
    });
    expect(await screen.findByText("No LINE channel connected yet.")).toBeInTheDocument();
    expect(window.location.href).not.toContain("/login");
  });

  it("cancels a scheduled broadcast with 204 without logging out", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <LanguageProvider>
        <BroadcastPage />
      </LanguageProvider>
    );

    expect(await screen.findByRole("button", { name: "ยกเลิก" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/line/channels/ch-1/broadcasts/job-1",
        authFetchOptions({ method: "DELETE" })
      );
    });
    expect(window.location.href).not.toContain("/login");
  });
});
