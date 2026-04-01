import {
  Controller,
  Post,
  Headers,
  RawBodyRequest,
  Req,
  HttpCode,
  BadRequestException,
} from "@nestjs/common";
import { Webhook } from "svix";
import type { Request } from "express";
import { Public } from "./public.decorator";
import { UsersService } from "../users/users.service";

interface ClerkWebhookEvent {
  type: "user.created" | "user.updated" | "user.deleted" | string;
  data: ClerkUserPayload;
}

export interface ClerkUserPayload {
  id: string;
  email_addresses: Array<{ email_address: string }>;
  first_name:      string | null;
  last_name:       string | null;
  image_url:       string | null;
  public_metadata: { role?: string };
}

@Controller("webhooks")
export class WebhookController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Post("clerk")
  @HttpCode(200)
  async handleClerkWebhook(
    @Headers("svix-id")        svixId: string,
    @Headers("svix-timestamp") svixTimestamp: string,
    @Headers("svix-signature") svixSignature: string,
    @Req() req: RawBodyRequest<Request>
  ) {
    const secret = process.env["CLERK_WEBHOOK_SECRET"];
    if (!secret) throw new BadRequestException("Webhook secret not configured");

    const wh      = new Webhook(secret);
    const payload = req.rawBody;
    if (!payload) throw new BadRequestException("Missing raw body");

    let event: ClerkWebhookEvent;
    try {
      event = wh.verify(payload, {
        "svix-id":        svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as ClerkWebhookEvent;
    } catch {
      throw new BadRequestException("Invalid webhook signature");
    }

    switch (event.type) {
      case "user.created":
      case "user.updated":
        await this.usersService.upsertFromClerk(event.data);
        break;
    }

    return { received: true };
  }
}
