import type { Block, Run } from "./types";

// Matches the inline markup used in the Common Paper templates:
// **bold**, <span class="coverpage_link">Variable</span> and [text](url).
const INLINE_RE = /\*\*(.+?)\*\*|<span class="\w+_link">(.*?)<\/span>|\[([^\]]+)\]\(([^)]+)\)/g;

export function parseInline(text: string): Run[] {
  const runs: Run[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    if (match.index > last) runs.push({ type: "text", text: text.slice(last, match.index) });
    const [, bold, variable, linkText, href] = match;
    if (bold !== undefined) runs.push({ type: "bold", text: bold });
    else if (variable !== undefined) runs.push({ type: "variable", text: variable });
    else runs.push({ type: "link", text: linkText, href });
    last = match.index + match[0].length;
  }
  if (last < text.length) runs.push({ type: "text", text: text.slice(last) });
  return runs;
}

/** Parses Standard Terms markdown: headings, numbered clauses and paragraphs, one per line. */
export function parseStandardTerms(markdown: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const numbered = /^(\d+)\.\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length as 1 | 2 | 3, text: heading[2] });
    } else if (numbered) {
      blocks.push({ type: "numbered", number: numbered[1], runs: parseInline(numbered[2]) });
    } else {
      blocks.push({ type: "paragraph", runs: parseInline(line) });
    }
  }
  return blocks;
}
