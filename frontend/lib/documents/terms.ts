import { parseStandardTerms } from "./parse";
import type { Block } from "./types";

// The KAN-4 dataset in templates/ is the single source of the legal text. Each document's
// Standard Terms are bundled as a string (see the *.md rule in next.config.ts) in a chunk of
// their own, so the browser only downloads the documents the user drafts.
export const TERMS_LOADERS: Record<string, () => Promise<{ default: string }>> = {
  "mutual-nda": () => import("../../../templates/mutual-nda/standard-terms.md"),
  "cloud-service-agreement": () => import("../../../templates/cloud-service-agreement/standard-terms.md"),
  "software-license-agreement": () => import("../../../templates/software-license-agreement/standard-terms.md"),
  "professional-services-agreement": () => import("../../../templates/professional-services-agreement/standard-terms.md"),
  "pilot-agreement": () => import("../../../templates/pilot-agreement/standard-terms.md"),
  "design-partner-agreement": () => import("../../../templates/design-partner-agreement/standard-terms.md"),
  "partnership-agreement": () => import("../../../templates/partnership-agreement/standard-terms.md"),
  "service-level-agreement": () => import("../../../templates/service-level-agreement/standard-terms.md"),
  "ai-addendum": () => import("../../../templates/ai-addendum/standard-terms.md"),
  "data-processing-agreement": () => import("../../../templates/data-processing-agreement/standard-terms.md"),
  "business-associate-agreement": () => import("../../../templates/business-associate-agreement/standard-terms.md"),
};

const cache = new Map<string, Promise<Block[]>>();

// Cached so each document's blocks stay the same objects, which keeps the preview's memo working.
export function loadStandardTerms(id: string): Promise<Block[]> {
  let terms = cache.get(id);
  if (!terms) {
    const loader = TERMS_LOADERS[id];
    if (!loader) return Promise.reject(new Error(`No Standard Terms for ${id}`));
    terms = loader().then((module) => parseStandardTerms(module.default));
    // A failed download can be retried.
    terms.catch(() => cache.delete(id));
    cache.set(id, terms);
  }
  return terms;
}
