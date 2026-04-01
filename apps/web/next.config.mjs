/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@repo/ui",
    "@repo/schemas",
    "@repo/api-client",
    "@repo/hooks",
    "@repo/utils",
  ],
};

export default nextConfig;
