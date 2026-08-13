import type { ConfigService } from "@nestjs/config";

type OriginChecker = (origin: string | undefined) => boolean;

function parseOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function createSocketOriginChecker(configService: ConfigService): OriginChecker {
  const webUrl = configService.get<string>("WEB_URL");
  const socketCorsOrigin = configService.get<string>("SOCKET_CORS_ORIGIN");
  const apiUrl = configService.get<string>("EXPO_PUBLIC_API_URL");
  const socketUrl = configService.get<string>("EXPO_PUBLIC_SOCKET_URL");
  const isProduction = configService.get<string>("NODE_ENV") === "production";

  // Match HTTP CORS in main.ts: Expo Go / Metro can present varying Origins in dev.
  if (!isProduction) {
    return () => true;
  }

  const allowedOrigins = new Set<string>([
    ...parseOrigins(webUrl),
    ...parseOrigins(socketCorsOrigin),
    ...parseOrigins(apiUrl),
    ...parseOrigins(socketUrl),
  ]);

  return (origin: string | undefined): boolean => {
    // Native mobile websocket clients may omit Origin; allow authenticated no-origin sockets.
    if (!origin) return true;
    return allowedOrigins.has(origin);
  };
}
