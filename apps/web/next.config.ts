import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Monorepo: point Turbopack at the workspace root (where pnpm-lock.yaml lives).
    root: path.join(__dirname, "..", ".."),
  },
};

export default nextConfig;
