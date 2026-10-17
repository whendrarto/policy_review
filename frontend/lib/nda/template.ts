import standardTermsMarkdown from "../../../templates/mutual-nda/standard-terms.md";
import { parseStandardTerms } from "./parse";
import type { Block } from "./types";

// The KAN-4 dataset in templates/ is the single source of the legal text. It is bundled
// into the build as a string (see the *.md rule in next.config.ts), so the server never
// reads it from disk and does not depend on the directory it is started from.
export function loadStandardTerms(): Block[] {
  return parseStandardTerms(standardTermsMarkdown);
}
