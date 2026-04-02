import {
  BadRequestException,
  Body,
  Controller,
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
import { ClerkAuthGuard } from "../auth/clerk.guard";
import { UsersService }   from "./users.service";
import { z } from "zod";

const UpdateUserProfileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(6).max(20),
});

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

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const UpdateOnboardingSchema = z.union([
  z.object({
    role: z.literal("CUSTOMER"),
    data: z.object({
      primaryLocation: z.string().min(1),
      carCompany: z.string().min(1),
      carModel: z.string().regex(/^\d+$/),
      notes: z.string().max(300).optional(),
    }),
  }),
  z.object({
    role: z.literal("PROVIDER"),
    data: z.object({
      serviceCategory: z.string().min(1),
      experienceYears: z.number().int().min(0).max(60),
      serviceArea: z.string().min(1),
      hasTools: z.boolean(),
      serviceDescription: z.string().min(1).max(500),
      profilePhotoUrl: z.string().url().optional(),
    }),
  }),
]);

@UseGuards(ClerkAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  async findMe(@Req() req: Request) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");
    return this.usersService.findByClerkId(clerkId);
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
      return this.usersService.updateCustomerOnboarding(clerkId, parsed.data.data);
    }
    return this.usersService.updateProviderOnboarding(clerkId, parsed.data.data);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.usersService.findById(id);
  }
}
