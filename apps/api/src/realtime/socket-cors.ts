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

  const allowedOrigins = new Set<string>([
    ...parseOrigins(webUrl),
    ...parseOrigins(socketCorsOrigin),
    ...parseOrigins(apiUrl),
    ...parseOrigins(socketUrl),
  ]);

  if (!isProduction) {
    // Dev clients can present localhost origins depending on runtime/container.
    parseOrigins("http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001")
      .forEach((origin) => allowedOrigins.add(origin));
  }

  return (origin: string | undefined): boolean => {
    // Native mobile websocket clients may omit Origin; allow authenticated no-origin sockets.
    if (!origin) return true;
    return allowedOrigins.has(origin);
  };
}
