import { z } from "zod";

import { ProviderPublicSummarySchema } from "./provider.schema";

export const AddFavoriteProviderSchema = z.object({
  providerId: z.string().uuid(),
});

export const FavoriteProviderListSchema = z.object({
  data: z.array(ProviderPublicSummarySchema),
});

export type AddFavoriteProviderInput = z.infer<typeof AddFavoriteProviderSchema>;
export type FavoriteProviderListResponse = z.infer<typeof FavoriteProviderListSchema>;
