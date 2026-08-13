import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "WayNow Admin",
  description: "WayNow marketplace administration console",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ClerkProvider afterSignOutUrl="/sign-in">
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
