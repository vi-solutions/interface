import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Needed for monorepo: trace files from workspace root so shared package is included
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@interface/shared"],
};

export default nextConfig;
