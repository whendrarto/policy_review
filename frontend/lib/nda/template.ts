import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife } from "next/cache";
import { parseStandardTerms } from "./parse";
import type { Block } from "./types";

// The KAN-4 dataset in templates/ is the single source of the legal text. It is read
// at build time (`next build` runs in frontend/) and cached with the longest profile,
// so a running server only re-reads it on the rare (30-day) revalidation.
const STANDARD_TERMS_PATH = path.join(process.cwd(), "..", "templates", "mutual-nda", "standard-terms.md");

export async function loadStandardTerms(): Promise<Block[]> {
  "use cache";
  cacheLife("max");
  return parseStandardTerms(await readFile(STANDARD_TERMS_PATH, "utf8"));
}
