import type { INestApplicationContext } from "@nestjs/common";
import { Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { IoAdapter } from "@nestjs/platform-socket.io";
import type { ServerOptions } from "socket.io";

import { createSocketOriginChecker } from "./socket-cors";

export class SocketIoAdapter extends IoAdapter {
  private readonly logger = new Logger(SocketIoAdapter.name);
  private readonly allowOrigin;

  constructor(
    appOrHttpServer: INestApplicationContext | object,
    configService: ConfigService
  ) {
    super(appOrHttpServer);
    this.allowOrigin = createSocketOriginChecker(configService);
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const baseCors =
      options?.cors != null && typeof options.cors === "object" ? options.cors : {};
    return super.createIOServer(port, {
      ...options,
      cors: {
        ...baseCors,
        credentials: true,
        origin: (
          origin: string | undefined,
          callback: (error: Error | null, allow?: boolean) => void
        ) => {
          if (this.allowOrigin(origin)) {
            callback(null, true);
            return;
          }
          this.logger.warn(`Rejected websocket origin: ${origin ?? "unknown"}`);
          callback(new Error("Socket origin is not allowed by CORS"), false);
        },
      },
    });
  }
}
