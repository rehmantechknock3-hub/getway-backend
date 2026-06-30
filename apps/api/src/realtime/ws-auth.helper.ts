import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { verifyToken } from "@clerk/backend";
import type { Socket } from "socket.io";

export async function authenticateSocket(
  client: Socket,
  configService: ConfigService,
  logger: Logger
): Promise<boolean> {
  const token = (client.handshake.auth?.token as string | undefined) ?? undefined;
  if (!token) {
    logger.warn(`Socket ${client.id} rejected: no token provided`);
    client.disconnect();
    return false;
  }

  const secretKey = configService.get<string>("CLERK_SECRET_KEY");
  if (!secretKey) {
    logger.error("CLERK_SECRET_KEY is missing; rejecting socket connection");
    client.disconnect();
    return false;
  }

  try {
    const payload = await verifyToken(token, { secretKey, clockSkewInMs: 60_000 });
    client.data.clerkId = payload.sub;
    return true;
  } catch (error) {
    logger.warn(`Socket ${client.id} rejected: token verification failed`, error);
    client.disconnect();
    return false;
  }
}
