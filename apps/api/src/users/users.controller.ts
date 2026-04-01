import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk.guard";
import { UsersService }   from "./users.service";

@UseGuards(ClerkAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.usersService.findById(id);
  }
}
