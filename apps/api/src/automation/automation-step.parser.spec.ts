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
});
