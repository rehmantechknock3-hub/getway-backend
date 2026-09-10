import { Logger } from "@nestjs/common";
import type { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";

/** Kept in lockstep between the main client and ephemeral-key requests (see payments.service.ts). */
export const STRIPE_API_VERSION = "2026-02-25.clover" as Stripe.LatestApiVersion;

export const STRIPE_CLIENT = "STRIPE_CLIENT";

/** Single Stripe SDK instance, injected wherever needed — mirrors how PrismaService is provided. */
export const stripeClientProvider: Provider = {
  provide: STRIPE_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Stripe => {
    const secretKey = configService.get<string>("STRIPE_SECRET_KEY");
    if (!secretKey) {
      new Logger("StripeClient").warn("STRIPE_SECRET_KEY is not configured — Stripe calls will fail");
    }
    return new Stripe(secretKey ?? "", { apiVersion: STRIPE_API_VERSION });
  },
};
