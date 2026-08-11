import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone: a self-contained server with only the traced
  // dependencies, so the runtime image carries no build toolchain.
  output: "standalone",
};

export default nextConfig;
