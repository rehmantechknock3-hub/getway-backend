import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenException, NotFoundException } from "@nestjs/common";

import { MessagesService } from "./messages.service";

const mockConversation = {
  id:            "conv-1",
  bookingId:     "booking-1",
  customerId:    "user-customer",
  providerId:    "profile-provider",
  lastMessageAt: null,
  createdAt:     new Date("2024-01-01"),
};

const mockMessage = {
  id:             "msg-1",
  conversationId: "conv-1",
  senderId:       "user-customer",
  type:           "TEXT",
  content:        "Hello!",
  readAt:         null,
  createdAt:      new Date("2024-01-01T10:00:00Z"),
};

const customerUser = {
  id:             "user-customer",
  clerkId:        "clerk-customer",
  role:           "CUSTOMER",
  firstName:      "Alice",
  lastName:       "Smith",
  providerProfile: null,
};

const providerUser = {
  id:             "user-provider",
  clerkId:        "clerk-provider",
  role:           "PROVIDER",
  firstName:      "Bob",
  lastName:       "Jones",
  providerProfile: { id: "profile-provider" },
};

describe("MessagesService", () => {
  const prisma = {
    user:         { findUnique: vi.fn() },
    booking:      { findUnique: vi.fn() },
    conversation: {
      findUnique: vi.fn(),
      findMany:   vi.fn(),
      create:     vi.fn(),
      update:     vi.fn().mockResolvedValue({}),
    },
    message: {
      findMany:   vi.fn(),
      count:      vi.fn(),
      groupBy:    vi.fn(),
      updateMany: vi.fn(),
      create:     vi.fn(),
    },
    $transaction: vi.fn(),
  };

  let service: MessagesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MessagesService(prisma as never);
  });

  describe("getOrCreateConversation", () => {
    it("returns existing conversation if one exists", async () => {
      prisma.user.findUnique.mockResolvedValue(customerUser);
      prisma.booking.findUnique.mockResolvedValue({ id: "booking-1", customerId: "user-customer", providerId: "profile-provider" });
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);

      const result = await service.getOrCreateConversation("clerk-customer", "booking-1");

      expect(result.id).toBe("conv-1");
      expect(prisma.conversation.create).not.toHaveBeenCalled();
    });

    it("creates a new conversation when none exists", async () => {
      prisma.user.findUnique.mockResolvedValue(customerUser);
      prisma.booking.findUnique.mockResolvedValue({ id: "booking-1", customerId: "user-customer", providerId: "profile-provider" });
      prisma.conversation.findUnique.mockResolvedValue(null);
      prisma.conversation.create.mockResolvedValue(mockConversation);

      await service.getOrCreateConversation("clerk-customer", "booking-1");

      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: { bookingId: "booking-1", customerId: "user-customer", providerId: "profile-provider" },
      });
    });

    it("throws ForbiddenException for unrelated user", async () => {
      prisma.user.findUnique.mockResolvedValue({ ...customerUser, id: "other-user" });
      prisma.booking.findUnique.mockResolvedValue({ id: "booking-1", customerId: "user-customer", providerId: "profile-provider" });

      await expect(
        service.getOrCreateConversation("clerk-other", "booking-1")
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("throws NotFoundException when booking does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(customerUser);
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrCreateConversation("clerk-customer", "no-booking")
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("listMessages", () => {
    it("returns paginated messages for authorized customer", async () => {
      prisma.user.findUnique.mockResolvedValue(customerUser);
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);
      prisma.message.findMany.mockResolvedValue([mockMessage]);
      prisma.message.count.mockResolvedValue(1);
      prisma.message.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.listMessages("clerk-customer", "conv-1", 1, 30);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0]?.id).toBe("msg-1");
    });

    it("throws ForbiddenException for unrelated user", async () => {
      prisma.user.findUnique.mockResolvedValue({ ...customerUser, id: "other" });
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);

      await expect(
        service.listMessages("clerk-other", "conv-1", 1, 30)
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("marks incoming messages as read on fetch", async () => {
      prisma.user.findUnique.mockResolvedValue(customerUser);
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);
      prisma.message.findMany.mockResolvedValue([mockMessage]);
      prisma.message.count.mockResolvedValue(1);
      prisma.message.updateMany.mockResolvedValue({ count: 1 });

      await service.listMessages("clerk-customer", "conv-1", 1, 30);

      expect(prisma.message.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ readAt: expect.any(Date) }) })
      );
    });
  });

  describe("sendMessage", () => {
    it("persists message via transaction and returns DTO", async () => {
      prisma.user.findUnique.mockResolvedValue(customerUser);
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);
      prisma.message.create.mockResolvedValue(mockMessage);
      prisma.$transaction.mockResolvedValue([mockMessage, mockConversation]);

      const result = await service.sendMessage("clerk-customer", { conversationId: "conv-1", content: "Hello!" });

      expect(result.id).toBe("msg-1");
      expect(result.content).toBe("Hello!");
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("throws ForbiddenException when user is not a participant", async () => {
      prisma.user.findUnique.mockResolvedValue({ ...customerUser, id: "stranger" });
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);

      await expect(
        service.sendMessage("clerk-stranger", { conversationId: "conv-1", content: "Hi" })
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("throws NotFoundException when conversation does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(customerUser);
      prisma.conversation.findUnique.mockResolvedValue(null);

      await expect(
        service.sendMessage("clerk-customer", { conversationId: "bad-id", content: "Hi" })
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("listConversations", () => {
    it("returns empty array when user has no conversations", async () => {
      prisma.user.findUnique.mockResolvedValue(customerUser);
      prisma.conversation.findMany.mockResolvedValue([]);

      const result = await service.listConversations("clerk-customer");

      expect(result).toEqual([]);
      expect(prisma.message.groupBy).not.toHaveBeenCalled();
    });

    it("returns conversations with other-party info and unread counts", async () => {
      prisma.user.findUnique.mockResolvedValue(customerUser);
      prisma.conversation.findMany.mockResolvedValue([
        {
          ...mockConversation,
          messages: [{ content: "Hi there", senderId: "user-provider" }],
          booking: {
            customer: { id: "user-customer", firstName: "Alice", lastName: "Smith", avatarUrl: null },
            provider: { user: { id: "user-provider", firstName: "Bob", lastName: "Jones", avatarUrl: null } },
          },
        },
      ]);
      prisma.message.groupBy.mockResolvedValue([{ conversationId: "conv-1", _count: { id: 2 } }]);

      const result = await service.listConversations("clerk-customer");

      expect(result).toHaveLength(1);
      expect(result[0]?.otherPartyFirstName).toBe("Bob");
      expect(result[0]?.unreadCount).toBe(2);
      expect(result[0]?.lastMessageContent).toBe("Hi there");
    });

    it("shows customer as the other party for provider role", async () => {
      prisma.user.findUnique.mockResolvedValue(providerUser);
      prisma.conversation.findMany.mockResolvedValue([
        {
          ...mockConversation,
          messages: [],
          booking: {
            customer: { id: "user-customer", firstName: "Alice", lastName: "Smith", avatarUrl: null },
            provider: { user: { id: "user-provider", firstName: "Bob", lastName: "Jones", avatarUrl: null } },
          },
        },
      ]);
      prisma.message.groupBy.mockResolvedValue([]);

      const result = await service.listConversations("clerk-provider");

      expect(result[0]?.otherPartyFirstName).toBe("Alice");
    });
  });
});
