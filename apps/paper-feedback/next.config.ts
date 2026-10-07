import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
const config: NextConfig = { output: "standalone", outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)), transpilePackages: ["@hospital/database", "@hospital/identity", "@hospital/scoring", "@hospital/forms"], serverExternalPackages: ["@prisma/adapter-pg", "pg"] };
export default config;
