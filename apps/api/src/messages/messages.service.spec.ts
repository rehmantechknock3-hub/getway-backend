import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenException, NotFoundException } from "@nestjs/common";

import { MessagesService } from "./messages.service";

const mockConversation = {
  id:            "conv-1",
  kind:          "BOOKING",
  bookingId:     "booking-1",
  supportKey:    null,
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

const adminUser = {
  id:              "user-admin",
  clerkId:         "clerk-admin",
  role:            "ADMIN",
  firstName:       "Ada",
  lastName:        "Admin",
  providerProfile: null,
};

const adminThread = {
  id:            "conv-admin",
  kind:          "PROVIDER_ADMIN",
  bookingId:     null,
  supportKey:    "profile-provider",
  customerId:    null,
  providerId:    "profile-provider",
  lastMessageAt: null,
  createdAt:     new Date("2024-01-01"),
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
      count:      vi.fn(),
    },
    message: {
      findMany:   vi.fn(),
      count:      vi.fn(),
      groupBy:    vi.fn(),
      updateMany: vi.fn(),
      create:     vi.fn(),
    },
    providerProfile: { findUnique: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  };

  const notifications = {
    notifyAdminsProviderMessage: vi.fn().mockResolvedValue(undefined),
    notifyProviderAdminReply: vi.fn().mockResolvedValue(undefined),
  };

  let service: MessagesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MessagesService(prisma as never, notifications as never);
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
        data: {
          kind: "BOOKING",
          bookingId: "booking-1",
          customerId: "user-customer",
          providerId: "profile-provider",
        },
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
      expect(result[0]?.otherPartyAvatarUrl).toBeNull();
      expect(result[0]?.unreadCount).toBe(2);
      expect(result[0]?.lastMessageContent).toBe("Hi there");
    });

    it("uses provider onboarding photo when user avatarUrl is empty", async () => {
      prisma.user.findUnique.mockResolvedValue(customerUser);
      prisma.conversation.findMany.mockResolvedValue([
        {
          ...mockConversation,
          messages: [],
          booking: {
            customer: { id: "user-customer", firstName: "Alice", lastName: "Smith", avatarUrl: null },
            provider: {
              user: {
                id: "user-provider",
                firstName: "Bob",
                lastName: "Jones",
                avatarUrl: null,
                providerOnboarding: {
                  experienceYears: 3,
                  serviceArea: "Lahore",
                  shopAddress: "1 Main St",
                  shopLocations: [{ address: "1 Main St" }],
                  hasTools: true,
                  serviceDescription: "Mobile wash",
                  serviceCategories: ["Exterior"],
                  profilePhotoUrl: "https://cdn.example.com/bob.jpg",
                },
              },
            },
          },
        },
      ]);
      prisma.message.groupBy.mockResolvedValue([]);

      const result = await service.listConversations("clerk-customer");

      expect(result[0]?.otherPartyAvatarUrl).toBe("https://cdn.example.com/bob.jpg");
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

  describe("getOrCreateAdminThread", () => {
    it("returns existing admin thread", async () => {
      prisma.user.findUnique.mockResolvedValue(providerUser);
      prisma.conversation.findUnique.mockResolvedValue(adminThread);

      const result = await service.getOrCreateAdminThread("clerk-provider");

      expect(result.id).toBe("conv-admin");
      expect(result.kind).toBe("PROVIDER_ADMIN");
      expect(prisma.conversation.create).not.toHaveBeenCalled();
    });

    it("creates an admin thread when none exists", async () => {
      prisma.user.findUnique.mockResolvedValue(providerUser);
      prisma.conversation.findUnique.mockResolvedValue(null);
      prisma.conversation.create.mockResolvedValue(adminThread);

      await service.getOrCreateAdminThread("clerk-provider");

      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: {
          kind: "PROVIDER_ADMIN",
          supportKey: "profile-provider",
          providerId: "profile-provider",
          customerId: null,
          bookingId: null,
        },
      });
    });

    it("rejects customers", async () => {
      prisma.user.findUnique.mockResolvedValue(customerUser);

      await expect(service.getOrCreateAdminThread("clerk-customer")).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe("getOrCreateAdminThreadForProvider", () => {
    it("lets an admin open a thread for a provider user", async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.providerProfile.findUnique.mockResolvedValue({ id: "profile-provider" });
      prisma.conversation.findUnique.mockResolvedValue(adminThread);

      const result = await service.getOrCreateAdminThreadForProvider(
        "clerk-admin",
        "user-provider",
      );

      expect(result.id).toBe("conv-admin");
      expect(prisma.providerProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: "user-provider" },
        select: { id: true },
      });
    });

    it("rejects a provider opening someone else's thread this way", async () => {
      prisma.user.findUnique.mockResolvedValue(providerUser);

      await expect(
        service.getOrCreateAdminThreadForProvider("clerk-provider", "user-provider"),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("throws when the provider profile is missing", async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.providerProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrCreateAdminThreadForProvider("clerk-admin", "user-missing"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("admin thread access", () => {
    it("lets the provider list messages on their admin thread", async () => {
      prisma.user.findUnique.mockResolvedValue(providerUser);
      prisma.conversation.findUnique.mockResolvedValue(adminThread);
      prisma.message.findMany.mockResolvedValue([]);
      prisma.message.count.mockResolvedValue(0);
      prisma.message.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.listMessages("clerk-provider", "conv-admin", 1, 30);
      expect(result.data).toEqual([]);
    });

    it("lets an admin send on a provider admin thread", async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.conversation.findUnique.mockResolvedValue(adminThread);
      prisma.message.create.mockResolvedValue({
        ...mockMessage,
        conversationId: "conv-admin",
        senderId: "user-admin",
      });
      prisma.$transaction.mockResolvedValue([
        { ...mockMessage, conversationId: "conv-admin", senderId: "user-admin" },
        adminThread,
      ]);
      prisma.providerProfile.findUnique.mockResolvedValue({ userId: "user-provider" });

      const result = await service.sendMessage("clerk-admin", {
        conversationId: "conv-admin",
        content: "Payout sent",
      });

      expect(result.content).toBe("Hello!");
      expect(notifications.notifyProviderAdminReply).toHaveBeenCalled();
    });

    it("forbids a customer from the admin thread", async () => {
      prisma.user.findUnique.mockResolvedValue(customerUser);
      prisma.conversation.findUnique.mockResolvedValue(adminThread);

      await expect(
        service.listMessages("clerk-customer", "conv-admin", 1, 30),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("forbids an admin from a booking conversation", async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);

      await expect(
        service.sendMessage("clerk-admin", { conversationId: "conv-1", content: "Hi" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("listAdminThreads", () => {
    it("rejects non-admins", async () => {
      prisma.user.findUnique.mockResolvedValue(providerUser);

      await expect(service.listAdminThreads("clerk-provider", 1, 30)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("returns provider threads with unread from the provider", async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.conversation.findMany.mockResolvedValue([
        { ...adminThread, messages: [{ content: "Need payout", senderId: "user-provider" }] },
      ]);
      prisma.conversation.count.mockResolvedValue(1);
      prisma.providerProfile.findMany.mockResolvedValue([
        {
          id: "profile-provider",
          user: {
            id: "user-provider",
            firstName: "Bob",
            lastName: "Jones",
            avatarUrl: null,
          },
        },
      ]);
      prisma.message.groupBy.mockResolvedValue([
        { conversationId: "conv-admin", _count: { id: 1 } },
      ]);

      const result = await service.listAdminThreads("clerk-admin", 1, 30);

      expect(result.total).toBe(1);
      expect(result.data[0]?.otherPartyFirstName).toBe("Bob");
      expect(result.data[0]?.unreadCount).toBe(1);
      expect(result.data[0]?.kind).toBe("PROVIDER_ADMIN");
    });
  });
});
