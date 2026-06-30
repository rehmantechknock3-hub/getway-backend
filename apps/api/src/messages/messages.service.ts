import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";

import type {
  Conversation,
  ConversationListItem,
  Message,
} from "@repo/schemas";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Private helpers ────────────────────────────────────────────────────────

  private toConversationDto(row: {
    id: string;
    bookingId: string;
    customerId: string;
    providerId: string;
    lastMessageAt: Date | null;
    createdAt: Date;
  }): Conversation {
    return {
      id: row.id,
      bookingId: row.bookingId,
      customerId: row.customerId,
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

  private async assertConversationAccess(
    userId: string,
    providerProfileId: string | undefined,
    conv: { customerId: string; providerId: string }
  ): Promise<void> {
    const isCustomer = conv.customerId === userId;
    const isProvider = providerProfileId != null && conv.providerId === providerProfileId;
    if (!isCustomer && !isProvider) {
      throw new ForbiddenException("You do not have access to this conversation");
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async getOrCreateConversation(
    clerkId: string,
    bookingId: string,
    requestId?: string
  ): Promise<Conversation> {
    const user = await this.resolveUserAndProfile(clerkId);

    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException("Booking not found");

    await this.assertConversationAccess(
      user.id,
      user.providerProfile?.id,
      { customerId: booking.customerId, providerId: booking.providerId }
    );

    const existing = await this.prisma.conversation.findUnique({ where: { bookingId } });
    if (existing) return this.toConversationDto(existing);

    const conv = await this.prisma.conversation.create({
      data: {
        bookingId,
        customerId: booking.customerId,
        providerId: booking.providerId,
      },
    });

    this.logger.log(`Conversation created for booking ${bookingId} [rid:${requestId}]`);
    return this.toConversationDto(conv);
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
                  select: { id: true, firstName: true, lastName: true, avatarUrl: true },
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
    const unreadByConvId = new Map(
      unreadRows.map((r) => [r.conversationId, r._count.id])
    );

    return convs.map((conv) => {
      const lastMsg = conv.messages[0];
      const otherParty =
        user.role === "PROVIDER"
          ? conv.booking.customer
          : conv.booking.provider.user;

      return {
        id: conv.id,
        bookingId: conv.bookingId,
        customerId: conv.customerId,
        providerId: conv.providerId,
        lastMessageAt: conv.lastMessageAt ?? undefined,
        createdAt: conv.createdAt,
        otherPartyFirstName: otherParty.firstName,
        otherPartyLastName: otherParty.lastName,
        otherPartyAvatarUrl: otherParty.avatarUrl ?? null,
        lastMessageContent: lastMsg?.content ?? null,
        lastMessageSenderId: lastMsg?.senderId ?? null,
        unreadCount: unreadByConvId.get(conv.id) ?? 0,
      };
    });
  }

  async listMessages(
    clerkId: string,
    conversationId: string,
    page: number,
    limit: number,
    requestId?: string
  ): Promise<{ data: Message[]; total: number; page: number; limit: number }> {
    const user = await this.resolveUserAndProfile(clerkId);

    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException("Conversation not found");

    await this.assertConversationAccess(user.id, user.providerProfile?.id, conv);

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

    // Mark incoming messages as read
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: user.id }, readAt: null },
      data: { readAt: new Date() },
    });

    this.logger.debug(
      `Listed ${rows.length}/${total} messages for conversation ${conversationId} [rid:${requestId}]`
    );

    return { data: rows.map((r) => this.toMessageDto(r)), total, page: safePage, limit: safeLimit };
  }

  async sendMessage(
    clerkId: string,
    input: { conversationId: string; content: string; type?: string },
    requestId?: string
  ): Promise<Message> {
    const user = await this.resolveUserAndProfile(clerkId);

    const conv = await this.prisma.conversation.findUnique({
      where: { id: input.conversationId },
    });
    if (!conv) throw new NotFoundException("Conversation not found");

    await this.assertConversationAccess(user.id, user.providerProfile?.id, conv);

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
      `Message sent in conversation ${input.conversationId} by ${user.id} [rid:${requestId}]`
    );

    return this.toMessageDto(row);
  }
}
