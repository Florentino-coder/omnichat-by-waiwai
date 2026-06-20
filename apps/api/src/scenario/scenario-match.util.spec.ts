import {
  formatScenarioInstructions,
  getBangkokHour,
  isWithinActiveHours,
  pickBestMatchingScenario,
  scenarioMatchesContext
} from "./scenario-match.util";

describe("scenario-match.util", () => {
  const baseScenario = {
    isEnabled: true,
    lineChannelId: null,
    activeHourStart: null,
    activeHourEnd: null,
    triggerKeywords: ["ราคา", "price"],
    triggerTagNames: [],
    priority: 10,
    instructions: "แจ้งช่วงราคา"
  };

  it("matches keyword in Thai message", () => {
    expect(
      scenarioMatchesContext(baseScenario, {
        messageText: "สอบถามราคาครับ",
        tagNames: [],
        currentHour: 12
      })
    ).toBe(true);
  });

  it("requires tag trigger when configured", () => {
    expect(
      scenarioMatchesContext(
        {
          ...baseScenario,
          triggerKeywords: [],
          triggerTagNames: ["VIP"]
        },
        {
          messageText: "สวัสดี",
          tagNames: ["vip"],
          currentHour: 12
        }
      )
    ).toBe(true);
  });

  it("respects active hours window", () => {
    expect(isWithinActiveHours(10, 9, 18)).toBe(true);
    expect(isWithinActiveHours(22, 9, 18)).toBe(false);
    expect(isWithinActiveHours(23, 22, 6)).toBe(true);
  });

  it("picks lowest priority scenario", () => {
    const picked = pickBestMatchingScenario(
      [
        { ...baseScenario, priority: 50, instructions: "low" },
        { ...baseScenario, priority: 10, instructions: "high" }
      ],
      {
        messageText: "price?",
        tagNames: [],
        currentHour: getBangkokHour()
      }
    );

    expect(picked?.instructions).toBe("high");
  });

  it("formats instructions block", () => {
    expect(formatScenarioInstructions(null)).toContain("ไม่มี scenario");
    expect(
      formatScenarioInstructions({ name: "Price", instructions: "บอกช่วงราคา" })
    ).toContain("Scenario: Price");
  });
});
