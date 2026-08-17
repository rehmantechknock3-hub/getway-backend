import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";

import {
  safeParseProviderOnboardingJson,
  type Conversation,
  type ConversationListItem,
  type Message,
} from "@repo/schemas";

import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

const ADMIN_DISPLAY = { firstName: "WayNow", lastName: "Admin" } as const;

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private resolvePartyAvatar(user: {
    avatarUrl: string | null;
    providerOnboarding?: unknown;
  }): string | null {
    if (user.avatarUrl) return user.avatarUrl;
    const parsed = safeParseProviderOnboardingJson(user.providerOnboarding);
    return parsed.success ? parsed.data.profilePhotoUrl ?? null : null;
  }

  private toConversationDto(row: {
    id: string;
    kind?: string;
    bookingId: string | null;
    supportKey?: string | null;
    customerId: string | null;
    providerId: string;
    lastMessageAt: Date | null;
    createdAt: Date;
  }): Conversation {
    return {
      id: row.id,
      kind: row.kind === "PROVIDER_ADMIN" ? "PROVIDER_ADMIN" : "BOOKING",
      bookingId: row.bookingId ?? undefined,
      supportKey: row.supportKey ?? undefined,
      customerId: row.customerId ?? undefined,
      providerId: row.providerId,
      lastMessageAt: row.lastMessageAt ?? undefined,
      createdAt: row.createdAt,
    };
  }

  private toMessageDto(row: {
    id: string;
    conversationId: string;
    senderId: string;
    type: string;
    content: string;
    readAt: Date | null;
    createdAt: Date;
  }): Message {
    return {
      id: row.id,
      conversationId: row.conversationId,
      senderId: row.senderId,
      type: row.type as Message["type"],
      content: row.content,
      readAt: row.readAt ?? undefined,
      createdAt: row.createdAt,
    };
  }

  private async resolveUserAndProfile(clerkId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { providerProfile: { select: { id: true } } },
    });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  private assertConversationAccess(
    user: { id: string; role: string; providerProfile?: { id: string } | null },
    conv: { kind?: string; customerId: string | null; providerId: string },
  ): void {
    if (conv.kind === "PROVIDER_ADMIN") {
      const isProvider = user.providerProfile?.id === conv.providerId;
      if (!isProvider && user.role !== "ADMIN") {
        throw new ForbiddenException("You do not have access to this conversation");
      }
      return;
    }

    const isCustomer = conv.customerId === user.id;
    const isProvider = user.providerProfile != null && conv.providerId === user.providerProfile.id;
    if (!isCustomer && !isProvider) {
      throw new ForbiddenException("You do not have access to this conversation");
    }
  }

  private async notifyAdminThread(
    user: { id: string; role: string; firstName: string; lastName: string },
    conv: { kind?: string; providerId: string },
    content: string,
  ): Promise<void> {
    if (conv.kind !== "PROVIDER_ADMIN") return;

    try {
      if (user.role === "PROVIDER") {
        await this.notificationsService.notifyAdminsProviderMessage({
          providerName: `${user.firstName} ${user.lastName}`.trim() || "A provider",
          preview: content,
        });
        return;
      }
      if (user.role !== "ADMIN") return;

      const profile = await this.prisma.providerProfile.findUnique({
        where: { id: conv.providerId },
        select: { userId: true },
      });
      if (!profile) return;

      await this.notificationsService.notifyProviderAdminReply({
        providerUserId: profile.userId,
        preview: content,
      });
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`admin-thread notify failed: ${reason}`);
    }
  }

  async getOrCreateConversation(
    clerkId: string,
    bookingId: string,
    requestId?: string,
  ): Promise<Conversation> {
    const user = await this.resolveUserAndProfile(clerkId);

    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException("Booking not found");

    this.assertConversationAccess(user, {
      kind: "BOOKING",
      customerId: booking.customerId,
      providerId: booking.providerId,
    });

    const existing = await this.prisma.conversation.findUnique({ where: { bookingId } });
    if (existing) return this.toConversationDto(existing);

    const conv = await this.prisma.conversation.create({
      data: {
        kind: "BOOKING",
        bookingId,
        customerId: booking.customerId,
        providerId: booking.providerId,
      },
    });

    this.logger.log(`Conversation created for booking ${bookingId} [rid:${requestId}]`);
    return this.toConversationDto(conv);
  }

  private async upsertAdminThread(profileId: string, requestId?: string): Promise<Conversation> {
    const existing = await this.prisma.conversation.findUnique({
      where: { supportKey: profileId },
    });
    if (existing) return this.toConversationDto(existing);

    const conv = await this.prisma.conversation.create({
      data: {
        kind: "PROVIDER_ADMIN",
        supportKey: profileId,
        providerId: profileId,
        customerId: null,
        bookingId: null,
      },
    });

    this.logger.log(`Admin thread created for provider ${profileId} [rid:${requestId}]`);
    return this.toConversationDto(conv);
  }

  async getOrCreateAdminThread(clerkId: string, requestId?: string): Promise<Conversation> {
    const user = await this.resolveUserAndProfile(clerkId);
    const profileId = user.providerProfile?.id;
    if (user.role !== "PROVIDER" || !profileId) {
      throw new ForbiddenException("Only providers can open admin chat");
    }
    return this.upsertAdminThread(profileId, requestId);
  }

  async getOrCreateAdminThreadForProvider(
    clerkId: string,
    providerUserId: string,
    requestId?: string,
  ): Promise<Conversation> {
    const user = await this.resolveUserAndProfile(clerkId);
    if (user.role !== "ADMIN") {
      throw new ForbiddenException("Admin access required");
    }

    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId: providerUserId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException("Provider not found");

    return this.upsertAdminThread(profile.id, requestId);
  }

  async listConversations(clerkId: string): Promise<ConversationListItem[]> {
    const user = await this.resolveUserAndProfile(clerkId);
    const profileId = user.providerProfile?.id;

    const where =
      user.role === "PROVIDER" && profileId
        ? { providerId: profileId }
        : { customerId: user.id };

    const convs = await this.prisma.conversation.findMany({
      where,
      orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, senderId: true },
        },
        booking: {
          include: {
            customer: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true },
            },
            provider: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    avatarUrl: true,
                    providerOnboarding: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (convs.length === 0) return [];

    const convIds = convs.map((c) => c.id);
    const unreadRows = await this.prisma.message.groupBy({
      by: ["conversationId"],
      where: {
        conversationId: { in: convIds },
        senderId: { not: user.id },
        readAt: null,
      },
      _count: { id: true },
    });
    const unreadByConvId = new Map(unreadRows.map((r) => [r.conversationId, r._count.id]));

    return convs.flatMap((conv) => {
      const lastMsg = conv.messages[0];
      const isAdminThread = conv.kind === "PROVIDER_ADMIN";

      if (!isAdminThread && !conv.booking) return [];

      const otherParty = isAdminThread
        ? { firstName: ADMIN_DISPLAY.firstName, lastName: ADMIN_DISPLAY.lastName, avatarUrl: null }
        : user.role === "PROVIDER"
          ? conv.booking!.customer
          : conv.booking!.provider.user;

      return [
        {
          id: conv.id,
          kind: isAdminThread ? "PROVIDER_ADMIN" as const : "BOOKING" as const,
          bookingId: conv.bookingId ?? undefined,
          supportKey: conv.supportKey ?? undefined,
          customerId: conv.customerId ?? undefined,
          providerId: conv.providerId,
          lastMessageAt: conv.lastMessageAt ?? undefined,
          createdAt: conv.createdAt,
          otherPartyFirstName: otherParty.firstName,
          otherPartyLastName: otherParty.lastName,
          otherPartyAvatarUrl: isAdminThread
            ? null
            : this.resolvePartyAvatar(otherParty),
          lastMessageContent: lastMsg?.content ?? null,
          lastMessageSenderId: lastMsg?.senderId ?? null,
          unreadCount: unreadByConvId.get(conv.id) ?? 0,
        },
      ];
    });
  }

  async listAdminThreads(
    clerkId: string,
    page: number,
    limit: number,
    requestId?: string,
  ): Promise<{ data: ConversationListItem[]; total: number; page: number; limit: number }> {
    const user = await this.resolveUserAndProfile(clerkId);
    if (user.role !== "ADMIN") {
      throw new ForbiddenException("Admin access required");
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;
    const where = { kind: "PROVIDER_ADMIN" as const };

    const [convs, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        skip,
        take: safeLimit,
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { content: true, senderId: true },
          },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    if (convs.length === 0) {
      return { data: [], total, page: safePage, limit: safeLimit };
    }

    const providerIds = [...new Set(convs.map((c) => c.providerId))];
    const profiles = await this.prisma.providerProfile.findMany({
      where: { id: { in: providerIds } },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            providerOnboarding: true,
          },
        },
      },
    });
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    const convIds = convs.map((c) => c.id);
    const providerUserIds = profiles.map((p) => p.user.id);
    const unreadRows =
      providerUserIds.length === 0
        ? []
        : await this.prisma.message.groupBy({
            by: ["conversationId"],
            where: {
              conversationId: { in: convIds },
              senderId: { in: providerUserIds },
              readAt: null,
            },
            _count: { id: true },
          });
    const unreadByConvId = new Map(unreadRows.map((r) => [r.conversationId, r._count.id]));

    this.logger.debug(
      `Listed ${convs.length}/${total} admin message threads [rid:${requestId}]`,
    );

    return {
      data: convs.map((conv) => {
        const lastMsg = conv.messages[0];
        const providerUser = profileById.get(conv.providerId)?.user;
        return {
          id: conv.id,
          kind: "PROVIDER_ADMIN" as const,
          bookingId: conv.bookingId ?? undefined,
          supportKey: conv.supportKey ?? undefined,
          customerId: conv.customerId ?? undefined,
          providerId: conv.providerId,
          lastMessageAt: conv.lastMessageAt ?? undefined,
          createdAt: conv.createdAt,
          otherPartyFirstName: providerUser?.firstName ?? "Provider",
          otherPartyLastName: providerUser?.lastName ?? "",
          otherPartyAvatarUrl: providerUser ? this.resolvePartyAvatar(providerUser) : null,
          lastMessageContent: lastMsg?.content ?? null,
          lastMessageSenderId: lastMsg?.senderId ?? null,
          unreadCount: unreadByConvId.get(conv.id) ?? 0,
        };
      }),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async listMessages(
    clerkId: string,
    conversationId: string,
    page: number,
    limit: number,
    requestId?: string,
  ): Promise<{ data: Message[]; total: number; page: number; limit: number }> {
    const user = await this.resolveUserAndProfile(clerkId);

    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException("Conversation not found");

    this.assertConversationAccess(user, conv);

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [rows, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        skip,
        take: safeLimit,
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: user.id }, readAt: null },
      data: { readAt: new Date() },
    });

    this.logger.debug(
      `Listed ${rows.length}/${total} messages for conversation ${conversationId} [rid:${requestId}]`,
    );

    return { data: rows.map((r) => this.toMessageDto(r)), total, page: safePage, limit: safeLimit };
  }

  async sendMessage(
    clerkId: string,
    input: { conversationId: string; content: string; type?: string },
    requestId?: string,
  ): Promise<Message> {
    const user = await this.resolveUserAndProfile(clerkId);

    const conv = await this.prisma.conversation.findUnique({
      where: { id: input.conversationId },
    });
    if (!conv) throw new NotFoundException("Conversation not found");

    this.assertConversationAccess(user, conv);

    const [row] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: input.conversationId,
          senderId: user.id,
          type: (input.type ?? "TEXT") as "TEXT" | "IMAGE" | "SYSTEM",
          content: input.content,
        },
      }),
      this.prisma.conversation.update({
        where: { id: input.conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    this.logger.log(
      `Message sent in conversation ${input.conversationId} by ${user.id} [rid:${requestId}]`,
    );

    await this.notifyAdminThread(user, conv, input.content);

    return this.toMessageDto(row);
  }
}
