import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import type { Request } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import sharp from "sharp";
import { z } from "zod";

import { UpdateOnboardingSchema, UpdateUserProfileSchema } from "@repo/schemas";

import { ClerkAuthGuard } from "../auth/clerk.guard";
import { Roles } from "../auth/roles.decorator";
import { UsersService } from "./users.service";

const UpdateSavedLocationsSchema = z.object({
  savedLocations: z.array(
    z.object({
      label: z.string().min(1),
      address: z.string().min(1),
    })
  ).max(10),
});

const UpdateAvatarSchema = z.object({
  avatarUrl: z.string().min(1).max(5000000),
});
const UpdateProviderPresenceSchema = z.object({
  isOnline: z.boolean(),
});

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

@UseGuards(ClerkAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  async findMe(@Req() req: Request) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");
    await this.usersService.syncRoleFromClerkSession(clerkId, req.auth);
    return this.usersService.findByClerkId(clerkId);
  }

  @Post("me/provider/ensure-listing")
  @Roles("PROVIDER")
  async ensureProviderListing(@Req() req: Request) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");
    await this.usersService.syncRoleFromClerkSession(clerkId, req.auth);
    return this.usersService.ensureProviderStarterListing(clerkId);
  }

  @Patch("me/profile")
  async updateProfile(@Req() req: Request, @Body() body: unknown) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = UpdateUserProfileSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid profile payload");

    return this.usersService.updateProfile(clerkId, parsed.data);
  }

  @Put("me/locations")
  async updateSavedLocations(@Req() req: Request, @Body() body: unknown) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = UpdateSavedLocationsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid locations payload");

    return this.usersService.updateSavedLocations(clerkId, parsed.data.savedLocations);
  }

  @Patch("me/avatar")
  async updateAvatar(@Req() req: Request, @Body() body: unknown) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = UpdateAvatarSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid avatar payload");

    return this.usersService.updateAvatar(clerkId, parsed.data.avatarUrl);
  }

  @Patch("me/provider/presence")
  async updateProviderPresence(@Req() req: Request, @Body() body: unknown) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = UpdateProviderPresenceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid provider presence payload");

    return this.usersService.updateProviderPresence(clerkId, parsed.data.isOnline);
  }

  @Post("me/avatar/upload")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_UPLOAD_BYTES },
    })
  )
  async uploadAvatar(
    @Req() req: Request,
    @UploadedFile() file?: Express.Multer.File
  ) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");
    if (!file) throw new BadRequestException("No file uploaded");
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException("Only image files are allowed");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException("Image must be 8MB or smaller");
    }

    let outputBuffer: Buffer;
    try {
      // Normalize all avatars to a compressed JPEG to reduce storage and transfer size.
      outputBuffer = await sharp(file.buffer)
        .rotate()
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();
    } catch {
      throw new BadRequestException("Unable to process image");
    }

    const fileName = `${clerkId}-${Date.now()}.jpg`;
    const avatarsDir = join(process.cwd(), "apps/api/uploads/avatars");
    await mkdir(avatarsDir, { recursive: true });

    const filePath = join(avatarsDir, fileName);
    await writeFile(filePath, outputBuffer);

    const host = req.get("host") ?? "localhost:3001";
    const avatarUrl = `${req.protocol}://${host}/uploads/avatars/${fileName}`;
    return this.usersService.updateAvatar(clerkId, avatarUrl);
  }

  @Put("me/onboarding")
  async updateOnboarding(@Req() req: Request, @Body() body: unknown) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = UpdateOnboardingSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid onboarding payload");

    if (parsed.data.role === "CUSTOMER") {
      return this.usersService.updateCustomerOnboarding(clerkId, parsed.data.data, req.requestId);
    }
    return this.usersService.updateProviderOnboarding(clerkId, parsed.data.data, req.requestId);
  }

  @Get(":id")
  async findOne(@Param("id") id: string, @Req() req: Request) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const me = await this.usersService.findByClerkId(clerkId);
    if (!me) throw new BadRequestException("Authenticated user is not provisioned");
    if (me.role !== "ADMIN" && me.id !== id) {
      throw new ForbiddenException("Cannot access other users' profiles");
    }

    return this.usersService.findById(id);
  }
}
