import { describe, expect, it, vi } from "vitest";

import { FavoritesController } from "./favorites.controller";
import { FavoritesService } from "./favorites.service";

describe("FavoritesController", () => {
  it("add calls service with provider id", async () => {
    const favoritesService = {
      add: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new FavoritesController(favoritesService as never);
    const req = { auth: { sub: "clerk_x" } } as never;

    const result = await controller.add(req, "pp-99");

    expect(favoritesService.add).toHaveBeenCalledWith("clerk_x", "pp-99");
    expect(result).toEqual({ ok: true });
  });
});
