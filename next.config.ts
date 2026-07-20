import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. Without it, a stray lockfile in a
  // parent directory (e.g. one in $HOME) makes Turbopack infer the wrong root
  // and warn on every dev/build run — and can misdirect module resolution.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
