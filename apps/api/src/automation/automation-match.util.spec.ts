import { AutomationTriggerType } from "@prisma/client";
import {
  automationRuleMatchesContext,
  pickMatchingAutomationRules
} from "./automation-match.util";

describe("automation-match.util", () => {
  const baseRule = {
    triggerType: AutomationTriggerType.MESSAGE_RECEIVED,
    triggerKeywords: ["price"],
    triggerTagNames: [],
    triggerStatus: null,
    offHourStart: null,
    offHourEnd: null,
    lineChannelId: null,
    isEnabled: true,
    priority: 100,
    name: "Price rule"
  };

  it("matches message keywords", () => {
    expect(
      automationRuleMatchesContext(baseRule, {
        messageText: "ขอ price list",
        currentHour: 10
      })
    ).toBe(true);
  });

  it("matches OFF_HOURS outside business window", () => {
    const rule = {
      ...baseRule,
      triggerType: AutomationTriggerType.OFF_HOURS,
      triggerKeywords: [],
      offHourStart: 9,
      offHourEnd: 18
    };

    expect(
      automationRuleMatchesContext(rule, {
        messageText: "สวัสดี",
        currentHour: 22
      })
    ).toBe(true);

    expect(
      automationRuleMatchesContext(rule, {
        messageText: "สวัสดี",
        currentHour: 12
      })
    ).toBe(false);
  });

  it("matches TAG_ADDED for configured tag", () => {
    const rule = {
      ...baseRule,
      triggerType: AutomationTriggerType.TAG_ADDED,
      triggerKeywords: [],
      triggerTagNames: ["VIP"]
    };

    expect(
      automationRuleMatchesContext(rule, {
        addedTagName: "vip",
        currentHour: 10
      })
    ).toBe(true);
  });

  it("sorts matching rules by priority", () => {
    const rules = [
      { ...baseRule, priority: 200, name: "B" },
      { ...baseRule, priority: 50, name: "A" }
    ];

    const matched = pickMatchingAutomationRules(rules, {
      messageText: "price please",
      currentHour: 10
    });

    expect(matched.map((rule) => rule.name)).toEqual(["A", "B"]);
  });
});
