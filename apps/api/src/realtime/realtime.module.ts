import { Module } from "@nestjs/common";
import { BookingGateway }  from "./booking.gateway";
import { ChatGateway }     from "./chat.gateway";

@Module({
  providers: [BookingGateway, ChatGateway],
  exports: [BookingGateway, ChatGateway],
})
export class RealtimeModule {}
