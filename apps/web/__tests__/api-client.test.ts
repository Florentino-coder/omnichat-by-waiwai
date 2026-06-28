/** @jest-environment jsdom */

import { apiFetch } from "../app/lib/api-client";

describe("apiFetch", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("returns undefined for 204 No Content without parsing JSON", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 204,
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      }
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    await expect(
      apiFetch("/api/v1/line/channels/ch-1/broadcasts/job-1", { method: "DELETE" })
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns 205 No Content without parsing JSON", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 205,
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      }
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    await expect(apiFetch("/api/v1/example", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("returns undefined for DELETE line channel 204 without losing session", async () => {
    const originalHref = window.location.href;
    let assignedHref = originalHref;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        get href() {
          return assignedHref;
        },
        set href(value: string) {
          assignedHref = value;
        }
      }
    });

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        status: 204,
        ok: true,
        json: async () => {
          throw new SyntaxError("Unexpected end of JSON input");
        }
      } as unknown as Response)
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          success: true,
          data: { id: "user-1", email: "owner@omnichat.local", role: "OWNER" }
        })
      } as unknown as Response);
    globalThis.fetch = fetchMock;

    await expect(
      apiFetch("/api/v1/line/channels/ch-1", { method: "DELETE" })
    ).resolves.toBeUndefined();

    await apiFetch("/api/v1/auth/me");

    expect(assignedHref).toBe(originalHref);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws readable errors for 409 conflict responses", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      status: 409,
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: "CONFLICT",
          message: "Broadcast has already been sent and cannot be cancelled"
        }
      })
    } as unknown as Response);

    await expect(
      apiFetch("/api/v1/line/channels/ch-1/broadcasts/job-1", { method: "DELETE" })
    ).rejects.toThrow("Broadcast has already been sent and cannot be cancelled");
  });
});
