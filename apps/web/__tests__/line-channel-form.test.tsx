/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LineChannelForm } from "../app/app/settings/line-channel-form";
import { LanguageProvider } from "../app/lib/language-context";

describe("LineChannelForm validation", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("omnichat.accessToken", "access-token");

    globalThis.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes("/api/v1/workspaces")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [{ id: "workspace-1", name: "Default Workspace", isDefault: true }]
          })
        };
      }
      if (url.includes("/api/v1/line/channels")) {
        return {
          ok: true,
          json: async () => ({ success: true, data: [] })
        };
      }
      return {
        ok: true,
        json: async () => ({ success: true, data: null })
      };
    }) as jest.Mock;
  });

  afterEach(() => {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("shows required field errors when submitting an incomplete form", async () => {
    render(
      <LanguageProvider>
        <LineChannelForm />
      </LanguageProvider>
    );

    expect(await screen.findByText("Default Workspace")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add LINE OA channel" }));

    await waitFor(() => {
      expect(screen.getAllByText("Required").length).toBeGreaterThan(0);
    });
  });
});
