import { describe, expect, it, vi } from "vitest";

import { ProviderReviewsController } from "./provider-reviews.controller";

describe("ProviderReviewsController", () => {
  it("list delegates to listForProvider", async () => {
    const reviewsService = {
      listForProvider: vi.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      }),
    };
    const controller = new ProviderReviewsController(reviewsService as never);

    const req = { auth: { sub: "clerk_prov" } } as never;
    const result = await controller.list(req, {});

    expect(reviewsService.listForProvider).toHaveBeenCalledWith("clerk_prov", 1, 20);
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
  });
});
