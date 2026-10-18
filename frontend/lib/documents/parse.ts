import type { Block, Run } from "./types";

// Matches the inline markup used in the Common Paper templates: **bold**, spans
// (<span class="header_3">Title</span> section titles, <span class="coverpage_link">Variable</span>
// references and <span id="4.1">…</span> anchors), <https://…> links and [text](url).
const INLINE_RE = /\*\*(.+?)\*\*|<span((?:\s+\w+="[^"]*")*)>(.*?)<\/span>|<(https?:\/\/[^>\s]+)>|\[([^\]]+)\]\(([^)]+)\)/g;

const classOf = (attributes: string) => /\bclass="([^"]*)"/.exec(attributes)?.[1] ?? "";

const asBold = (runs: Run[]): Run[] => runs.map((run) => (run.type === "text" ? { type: "bold", text: run.text } : run));

export function parseInline(text: string): Run[] {
  const runs: Run[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    if (match.index > last) runs.push({ type: "text", text: text.slice(last, match.index) });
    const [, bold, attributes, inner, autolink, linkText, href] = match;
    if (bold !== undefined) runs.push(...asBold(parseInline(bold)));
    else if (inner !== undefined) {
      const className = classOf(attributes);
      if (/^header_\d$/.test(className)) runs.push(...asBold(parseInline(inner)));
      else if (className.endsWith("_link")) runs.push({ type: "variable", text: inner });
      // An anchor only marks a place in the text.
      else runs.push(...parseInline(inner));
    } else if (autolink !== undefined) runs.push({ type: "link", text: autolink, href: autolink });
    else runs.push({ type: "link", text: linkText, href });
    last = match.index + match[0].length;
  }
  if (last < text.length) runs.push({ type: "text", text: text.slice(last) });
  return runs;
}

// Clauses are nested by indenting four spaces per level: 1. / 1.1 / a. / i.
const LIST_ITEM_RE = /^( *)(\d+|[a-z]+)\.\s+(.*)$/;
const INDENT = 4;

function label(path: string[]): string {
  const level = path.length - 1;
  // Second-level clauses print their full number ("5.3"), as in the templates' headings.
  return level === 1 ? path.join(".") : `${path[level]}.`;
}

/** Parses Standard Terms markdown: headings, nested numbered clauses and paragraphs, one per line. */
export function parseStandardTerms(markdown: string): Block[] {
  const blocks: Block[] = [];
  let path: string[] = [];
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const item = LIST_ITEM_RE.exec(line);
    const level = item ? Math.floor(item[1].length / INDENT) : 0;
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length as 1 | 2 | 3, text: heading[2] });
    } else if (item && level <= path.length && (level > 0 || /^\d+$/.test(item[2]))) {
      path = [...path.slice(0, level), item[2]];
      blocks.push({ type: "numbered", number: path.join("."), label: label(path), level, runs: parseInline(item[3]) });
    } else {
      blocks.push({ type: "paragraph", runs: parseInline(line.trim()) });
    }
  }
  return blocks;
}
