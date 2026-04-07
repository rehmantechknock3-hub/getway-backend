import { describe, expect, it, vi } from "vitest";

import { PublicProviderReviewsController } from "./public-provider-reviews.controller";

describe("PublicProviderReviewsController", () => {
  it("list parses query and delegates", async () => {
    const reviewsService = {
      listForPublicProvider: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    };
    const controller = new PublicProviderReviewsController(reviewsService as never);

    const result = await controller.list("pp-1", { page: "2", limit: "10" });

    expect(reviewsService.listForPublicProvider).toHaveBeenCalledWith("pp-1", 2, 10);
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
  });
});
