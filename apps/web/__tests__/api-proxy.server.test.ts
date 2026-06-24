/** @jest-environment node */

import { buildBffResponseFromUpstream } from "../app/lib/api-proxy.server";

describe("buildBffResponseFromUpstream", () => {
  it("returns null body for upstream 204 No Content", async () => {
    const upstream = new Response(null, { status: 204 });

    const response = await buildBffResponseFromUpstream(upstream);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("Content-Type")).toBeNull();
  });

  it("forwards upstream 409 conflict JSON unchanged", async () => {
    const payload = {
      success: false,
      error: {
        code: "CONFLICT",
        message: "Broadcast has already been sent and cannot be cancelled"
      }
    };
    const upstream = new Response(JSON.stringify(payload), {
      status: 409,
      headers: { "Content-Type": "application/json" }
    });

    const response = await buildBffResponseFromUpstream(upstream);

    expect(response.status).toBe(409);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual(payload);
  });

  it("forwards upstream 200 JSON envelopes", async () => {
    const payload = { success: true, data: [{ id: "job-1" }] };
    const upstream = new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

    const response = await buildBffResponseFromUpstream(upstream);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(payload);
  });
});
