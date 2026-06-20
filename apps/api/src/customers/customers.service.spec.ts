import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CustomersService } from "./customers.service";

type MockPrisma = {
  customer: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
  };
  conversation: {
    findMany: jest.Mock<Promise<unknown>, [unknown]>;
  };
};

const createPrisma = (): MockPrisma => ({
  customer: {
    findFirst: jest.fn(),
    update: jest.fn()
  },
  conversation: {
    findMany: jest.fn()
  }
});

const createService = (prisma: MockPrisma): CustomersService =>
  new CustomersService(prisma as unknown as PrismaService);

describe("CustomersService", () => {
  describe("findOne", () => {
    it("should return customer details, aggregated tags and sorted notes on success", async () => {
      const prisma = createPrisma();
      const customerData = {
        id: "cust-1",
        tenantId: "tenant-1",
        displayName: "John Doe",
        avatarUrl: "https://avatar.url",
        phone: "123456",
        email: "john@example.com",
        deletedAt: null
      };

      prisma.customer.findFirst.mockResolvedValue(customerData);
      
      const now = new Date();
      const oldDate = new Date(now.getTime() - 10000);

      prisma.conversation.findMany.mockResolvedValue([
        {
          id: "conv-1",
          tagLinks: [
            {
              tag: {
                name: "VIP",
                deletedAt: null
              }
            }
          ],
          internalNotes: [
            {
              body: "Old note",
              createdAt: oldDate,
              deletedAt: null
            },
            {
              body: "New note",
              createdAt: now,
              deletedAt: null
            }
          ]
        }
      ]);

      const service = createService(prisma);
      const result = await service.findOne("tenant-1", "cust-1");

      expect(result).toEqual({
        id: "cust-1",
        display_name: "John Doe",
        avatar_url: "https://avatar.url",
        phone: "123456",
        email: "john@example.com",
        tags: ["VIP"],
        notes: [
          { text: "New note", created_at: now },
          { text: "Old note", created_at: oldDate }
        ]
      });

      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: {
          id: "cust-1",
          tenantId: "tenant-1",
          deletedAt: null
        }
      });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith({
        where: {
          customerId: "cust-1",
          tenantId: "tenant-1",
          deletedAt: null
        },
        include: {
          tagLinks: {
            where: { deletedAt: null },
            include: { tag: true }
          },
          internalNotes: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" }
          }
        }
      });
    });

    it("should throw NotFoundException if customer is not found or is in another tenant", async () => {
      const prisma = createPrisma();
      prisma.customer.findFirst.mockResolvedValue(null);

      const service = createService(prisma);
      await expect(service.findOne("tenant-1", "cust-1")).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("should update and return customer details on success", async () => {
      const prisma = createPrisma();
      const customerData = {
        id: "cust-1",
        tenantId: "tenant-1",
        displayName: "John Doe",
        phone: "123",
        email: "john@example.com",
        deletedAt: null
      };

      prisma.customer.findFirst.mockResolvedValue(customerData);
      prisma.customer.update.mockResolvedValue({
        ...customerData,
        displayName: "John Edited",
        phone: "456",
        email: "john_new@example.com"
      });

      const service = createService(prisma);
      const result = await service.update("tenant-1", "cust-1", {
        displayName: "John Edited",
        phone: "456",
        email: "john_new@example.com"
      });

      expect(result).toEqual({
        id: "cust-1",
        display_name: "John Edited",
        avatar_url: undefined,
        phone: "456",
        email: "john_new@example.com"
      });

      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: "cust-1" },
        data: {
          displayName: "John Edited",
          phone: "456",
          email: "john_new@example.com"
        }
      });
    });

    it("should throw NotFoundException if customer is not found, soft deleted, or belongs to another tenant during update", async () => {
      const prisma = createPrisma();
      prisma.customer.findFirst.mockResolvedValue(null);

      const service = createService(prisma);
      await expect(service.update("tenant-1", "cust-1", { displayName: "Edit" })).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
