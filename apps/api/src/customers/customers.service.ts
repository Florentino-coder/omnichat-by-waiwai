import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PatchCustomerDto } from "./dto/patch-customer.dto";

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null
      }
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    // Query active conversations for this customer to aggregate tags and notes
    const conversations = await this.prisma.conversation.findMany({
      where: {
        customerId: customer.id,
        tenantId,
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

    // Extract unique tag names
    const tagsMap = new Set<string>();
    for (const conv of conversations) {
      for (const link of conv.tagLinks) {
        if (link.tag && !link.tag.deletedAt) {
          tagsMap.add(link.tag.name);
        }
      }
    }
    const tags = Array.from(tagsMap);

    // Extract and sort internal notes by date desc
    const notes = conversations
      .flatMap((conv) =>
        conv.internalNotes.map((note) => ({
          text: note.body,
          created_at: note.createdAt
        }))
      )
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    return {
      id: customer.id,
      display_name: customer.displayName,
      avatar_url: customer.avatarUrl,
      phone: customer.phone,
      email: customer.email,
      tags,
      notes
    };
  }

  async update(tenantId: string, id: string, dto: PatchCustomerDto) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null
      }
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    const displayName = dto.displayName !== undefined ? dto.displayName : dto.display_name;

    const updated = await this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        ...(displayName !== undefined ? { displayName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {})
      }
    });

    return {
      id: updated.id,
      display_name: updated.displayName,
      avatar_url: updated.avatarUrl,
      phone: updated.phone,
      email: updated.email
    };
  }
}
