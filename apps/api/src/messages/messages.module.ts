import { Module, forwardRef } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { RealtimeModule } from "../realtime/realtime.module";

import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";

@Module({
  imports: [PrismaModule, forwardRef(() => RealtimeModule)],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
