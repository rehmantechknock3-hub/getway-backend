import { Module } from "@nestjs/common";
import { MapsModule } from "../maps/maps.module";
import { UsersController } from "./users.controller";
import { UsersService }    from "./users.service";

@Module({
  imports: [MapsModule],
  controllers: [UsersController],
  providers:   [UsersService],
  exports:     [UsersService],
})
export class UsersModule {}
