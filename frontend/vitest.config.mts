import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
  // Import Markdown as a string, matching the *.md rule in next.config.ts.
  plugins: [{ name: "raw-markdown", transform: (code, id) => (id.endsWith(".md") ? `export default ${JSON.stringify(code)};` : null) }],
  test: { include: ["**/*.test.ts", "**/*.test.tsx"], exclude: ["node_modules/**", ".next/**"] },
});
