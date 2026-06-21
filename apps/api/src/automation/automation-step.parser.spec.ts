import { parseAutomationSteps } from "./automation-step.parser";

describe("automation-step.parser", () => {
  it("parses valid step chains", () => {
    const steps = parseAutomationSteps([
      { type: "ADD_TAG", tagName: "off-hours" },
      { type: "SEND_TEXT_REPLY", text: "ร้านปิดแล้วนะคะ" },
      { type: "WAIT", delaySeconds: 60 }
    ]);

    expect(steps).toHaveLength(3);
    expect(steps[2]).toEqual({ type: "WAIT", delaySeconds: 60 });
  });

  it("rejects empty steps", () => {
    expect(() => parseAutomationSteps([])).toThrow("At least one automation step");
  });

  it("parses runAfter and SEND_IMAGE_REPLY", () => {
    const steps = parseAutomationSteps([
      { type: "SEND_TEXT_REPLY", text: "hello" },
      {
        type: "SEND_IMAGE_REPLY",
        imageUrl: "https://cdn.example.com/a.jpg",
        runAfter: "customer_reply"
      }
    ]);

    expect(steps[1]).toEqual({
      type: "SEND_IMAGE_REPLY",
      imageUrl: "https://cdn.example.com/a.jpg",
      runAfter: "customer_reply"
    });
  });

  it("rejects runAfter on step 1", () => {
    expect(() =>
      parseAutomationSteps([
        { type: "SEND_TEXT_REPLY", text: "hello", runAfter: "customer_reply" }
      ])
    ).toThrow("Step 1 cannot use runAfter");
  });

  it("rejects invalid image URLs", () => {
    expect(() =>
      parseAutomationSteps([{ type: "SEND_IMAGE_REPLY", imageUrl: "ftp://bad" }])
    ).toThrow("imageUrl must be an http or https URL");
  });
});
