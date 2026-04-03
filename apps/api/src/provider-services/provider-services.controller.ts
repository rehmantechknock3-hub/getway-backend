import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import {
  CreateServiceCategorySchema,
  CreateServiceSchema,
  UpdateServiceSchema,
} from "@repo/schemas";

import { Roles } from "../auth/roles.decorator";
import { ProviderServicesService } from "./provider-services.service";

@Controller("provider/services")
@Roles("PROVIDER")
export class ProviderServicesController {
  constructor(private readonly providerServicesService: ProviderServicesService) {}

  @Get()
  async list(@Req() req: Request) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");
    return this.providerServicesService.listMyServices(clerkId);
  }

  @Get("categories")
  async categories(@Req() req: Request) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");
    return this.providerServicesService.listCategories(clerkId);
  }

  @Post("categories")
  async createCategory(@Req() req: Request, @Body() body: unknown) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = CreateServiceCategorySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid category payload");

    return this.providerServicesService.createCategory(clerkId, parsed.data);
  }

  @Delete("categories/:categoryId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCategory(@Req() req: Request, @Param("categoryId", ParseUUIDPipe) categoryId: string) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    await this.providerServicesService.deleteCategory(clerkId, categoryId);
  }

  @Post()
  async create(@Req() req: Request, @Body() body: unknown) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = CreateServiceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid service payload");

    return this.providerServicesService.create(clerkId, parsed.data);
  }

  @Patch(":id")
  async update(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = UpdateServiceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid service update payload");

    return this.providerServicesService.update(clerkId, id, parsed.data);
  }
}
