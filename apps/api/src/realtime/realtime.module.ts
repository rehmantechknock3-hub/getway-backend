import { Module, forwardRef } from "@nestjs/common";

import { MessagesModule } from "../messages/messages.module";

import { BookingGateway } from "./booking.gateway";
import { ChatGateway } from "./chat.gateway";

@Module({
  imports: [forwardRef(() => MessagesModule)],
  providers: [BookingGateway, ChatGateway],
  exports: [BookingGateway, ChatGateway],
})
export class RealtimeModule {}
