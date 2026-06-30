import { Module } from "@nestjs/common";

import { MessagesModule } from "../messages/messages.module";

import { BookingGateway } from "./booking.gateway";
import { ChatGateway }    from "./chat.gateway";

@Module({
  imports:   [MessagesModule],
  providers: [BookingGateway, ChatGateway],
  exports:   [BookingGateway, ChatGateway],
})
export class RealtimeModule {}
