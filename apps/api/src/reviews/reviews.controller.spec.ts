import { describe, expect, it, vi } from "vitest";

import { ReviewsController } from "./reviews.controller";

describe("ReviewsController", () => {
  it("create parses body and delegates", async () => {
    const reviewsService = {
      create: vi.fn().mockResolvedValue({ id: "r-1", rating: 5 }),
    };
    const controller = new ReviewsController(reviewsService as never);

    const req = { auth: { sub: "clerk_cust" } } as never;
    const result = await controller.create(req, {
      bookingId: "123e4567-e89b-12d3-a456-426614174000",
      rating: 5,
      comment: "Nice",
    });

    expect(reviewsService.create).toHaveBeenCalledWith("clerk_cust", {
      bookingId: "123e4567-e89b-12d3-a456-426614174000",
      rating: 5,
      comment: "Nice",
    });
    expect(result).toEqual({ id: "r-1", rating: 5 });
  });
});
