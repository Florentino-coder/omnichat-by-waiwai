import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { SafeUserProfile } from "./types/user.types";

const safeUserSelect = {
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  emailVerified: true,
  twoFaEnabled: true,
  lastLoginAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  memberships: {
    select: {
      id: true,
      tenantId: true,
      workspaceId: true,
      role: true,
      isActive: true,
      joinedAt: true
    }
  }
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string, tenantId: string): Promise<SafeUserProfile> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        memberships: {
          some: {
            tenantId,
            isActive: true
          }
        }
      },
      select: safeUserSelect
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async updateMe(
    userId: string,
    tenantId: string,
    dto: UpdateProfileDto
  ): Promise<SafeUserProfile> {
    await this.getMe(userId, tenantId);
    await this.prisma.user.update({
      where: { id: userId },
      data: dto
    });
    return this.getMe(userId, tenantId);
  }
}
