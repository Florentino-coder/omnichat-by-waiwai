import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { AuditAction, ConversationPriority, Role } from "@prisma/client";
import { ScenarioService } from "./scenario.service";

describe("ScenarioService", () => {
  const prisma = {
    aiScenario: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    lineChannel: {
      findFirst: jest.fn()
    },
    workspaceMember: {
      findFirst: jest.fn()
    },
    auditLog: {
      create: jest.fn()
    },
    conversation: {
      findFirst: jest.fn(),
      update: jest.fn()
    },
    conversationTag: {
      findFirst: jest.fn(),
      create: jest.fn()
    },
    conversationTagLink: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    }
  };

  const service = new ScenarioService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.auditLog.create.mockResolvedValue({});
  });

  it("creates scenario with audit log", async () => {
    prisma.lineChannel.findFirst.mockResolvedValue({ id: "ch-1" });
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: "mem-1" });
    prisma.aiScenario.create.mockResolvedValue({
      id: "sc-1",
      name: "Price",
      priority: 10
    });

    await service.createScenario("tenant-1", "user-1", {
      name: "Price",
      triggerKeywords: ["ราคา"],
      instructions: "บอกช่วงราคา",
      lineChannelId: "ch-1",
      actionAssignMemberId: "mem-1"
    });

    expect(prisma.aiScenario.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AuditAction.AI_SCENARIO_CREATED,
        targetId: "sc-1"
      })
    });
  });

  it("blocks agent from updating scenarios", async () => {
    prisma.aiScenario.findFirst.mockResolvedValue({
      id: "sc-1",
      tenantId: "tenant-1",
      triggerKeywords: ["ราคา"],
      triggerTagNames: []
    });

    await expect(
      service.updateScenario("tenant-1", "user-1", "sc-1", { name: "X" }, Role.AGENT)
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("builds scenario instructions from match", async () => {
    prisma.aiScenario.findMany.mockResolvedValue([
      {
        id: "sc-1",
        name: "Price",
        priority: 10,
        isEnabled: true,
        lineChannelId: null,
        activeHourStart: null,
        activeHourEnd: null,
        triggerKeywords: ["ราคา"],
        triggerTagNames: [],
        instructions: "บอกช่วงราคา"
      }
    ]);

    const result = await service.buildScenarioInstructions(
      "tenant-1",
      "ขอราคาหน่อย",
      []
    );

    expect(result.scenario?.name).toBe("Price");
    expect(result.instructions).toContain("Scenario: Price");
  });

  it("throws when scenario not found", async () => {
    prisma.aiScenario.findFirst.mockResolvedValue(null);

    await expect(service.findOne("tenant-1", "missing")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("applies tag and priority actions", async () => {
    prisma.conversation.findFirst.mockResolvedValue({
      id: "conv-1",
      assignedToMemberId: null
    });
    prisma.conversationTag.findFirst.mockResolvedValue(null);
    prisma.conversationTag.create.mockResolvedValue({ id: "tag-1", name: "สนใจราคา" });
    prisma.conversationTagLink.findFirst.mockResolvedValue(null);
    prisma.conversationTagLink.create.mockResolvedValue({ id: "link-1" });
    prisma.conversation.update.mockResolvedValue({});

    await service.applyScenarioActions({
      tenantId: "tenant-1",
      conversationId: "conv-1",
      scenario: {
        id: "sc-1",
        name: "Price",
        actionAddTagName: "สนใจราคา",
        actionAssignMemberId: null,
        actionSetPriority: ConversationPriority.HIGH,
        actionEscalate: false
      } as never,
      source: "inbound_message"
    });

    expect(prisma.conversationTagLink.create).toHaveBeenCalled();
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: { priority: ConversationPriority.HIGH }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AuditAction.AI_SCENARIO_MATCHED
      })
    });
  });
});
