import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A static site in out/, served by the FastAPI backend. trailingSlash emits nda/index.html,
  // which the backend's static file server finds for /nda.
  output: "export",
  trailingSlash: true,
  turbopack: {
    // The repo root, so lib/nda/template.ts can import the legal text from ../templates.
    root: path.join(import.meta.dirname, ".."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
      "*.md": {
        type: "raw",
      },
    },
  },
};

export default nextConfig;
