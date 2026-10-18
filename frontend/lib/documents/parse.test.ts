import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { blockRuns } from "./document";
import { parseInline, parseStandardTerms } from "./parse";
import { DOCUMENTS } from "./registry";
import type { Block } from "./types";

const termsMarkdown = (id: string) => readFileSync(path.join(import.meta.dirname, `../../../templates/${id}/standard-terms.md`), "utf8");

const textOf = (blocks: Block[]) =>
  blocks
    .flatMap(blockRuns)
    .map((r) => r.text)
    .join("");

describe("parseInline", () => {
  it("splits bold, variables and links", () => {
    expect(parseInline('the **MNDA** for the <span class="coverpage_link">Purpose</span>, see [site](https://x.y).')).toEqual([
      { type: "text", text: "the " },
      { type: "bold", text: "MNDA" },
      { type: "text", text: " for the " },
      { type: "variable", text: "Purpose" },
      { type: "text", text: ", see " },
      { type: "link", text: "site", href: "https://x.y" },
      { type: "text", text: "." },
    ]);
  });

  it("makes section titles bold and keeps variables that carry an id", () => {
    expect(parseInline('<span class="header_3" id="1.1">Access and Use.</span>  During the <span class="orderform_link" id="1.1.a">Pilot Period</span>')).toEqual([
      { type: "bold", text: "Access and Use." },
      { type: "text", text: "  During the " },
      { type: "variable", text: "Pilot Period" },
    ]);
  });

  it("drops anchors but keeps what they wrap", () => {
    expect(parseInline('<span id="4.1"></span>**"Term"** means <span id="5.2">upon</span> notice')).toEqual([
      { type: "bold", text: '"Term"' },
      { type: "text", text: " means " },
      { type: "text", text: "upon" },
      { type: "text", text: " notice" },
    ]);
    expect(parseInline('<span id="13.1">**"Affiliate"**</span> means')).toEqual([
      { type: "bold", text: '"Affiliate"' },
      { type: "text", text: " means" },
    ]);
  });

  it("keeps variables inside bold text", () => {
    expect(parseInline('**liability will not exceed the <span class="keyterms_link">General Cap Amount</span>.**')).toEqual([
      { type: "bold", text: "liability will not exceed the " },
      { type: "variable", text: "General Cap Amount" },
      { type: "bold", text: "." },
    ]);
  });

  it("turns bare URLs into links", () => {
    expect(parseInline("posted at <https://commonpaper.com/standards/pilot-agreement/1.1>.")).toEqual([
      { type: "text", text: "posted at " },
      { type: "link", text: "https://commonpaper.com/standards/pilot-agreement/1.1", href: "https://commonpaper.com/standards/pilot-agreement/1.1" },
      { type: "text", text: "." },
    ]);
  });
});

describe("parseStandardTerms", () => {
  it("numbers nested clauses by section", () => {
    const blocks = parseStandardTerms(["# Title", "1. <span class=\"header_2\">One</span>", "    1. First", "        a. Sub", "            i. Deep", "        b. Sub two", "    2. Second", "2. Two"].join("\n"));
    const numbered = blocks.flatMap((b) => (b.type === "numbered" ? [[b.number, b.label, b.level]] : []));
    expect(numbered).toEqual([
      ["1", "1.", 0],
      ["1.1", "1.1", 1],
      ["1.1.a", "a.", 2],
      ["1.1.a.i", "i.", 3],
      ["1.1.b", "b.", 2],
      ["1.2", "1.2", 1],
      ["2", "2.", 0],
    ]);
  });

  it("treats lettered lines without a parent clause as paragraphs", () => {
    expect(parseStandardTerms("a. not a clause\n        b. too deep")).toEqual([
      { type: "paragraph", runs: [{ type: "text", text: "a. not a clause" }] },
      { type: "paragraph", runs: [{ type: "text", text: "b. too deep" }] },
    ]);
  });

  describe("the Mutual NDA", () => {
    const markdown = termsMarkdown("mutual-nda");
    const blocks = parseStandardTerms(markdown);

    it("parses the heading, the 11 clauses and the license footer", () => {
      expect(blocks[0]).toEqual({ type: "heading", level: 1, text: "Standard Terms" });
      expect(blocks.filter((b) => b.type === "numbered").map((b) => b.type === "numbered" && b.label)).toEqual(
        Array.from({ length: 11 }, (_, i) => `${i + 1}.`),
      );
      expect(blocks.at(-1)?.type).toBe("paragraph");
    });

    it("handles CRLF line endings", () => {
      expect(parseStandardTerms(markdown.replace(/\r?\n/g, "\r\n"))).toEqual(parseStandardTerms(markdown.replace(/\r\n/g, "\n")));
    });
  });

  describe.each(DOCUMENTS.map((doc) => doc.id))("%s", (id) => {
    const markdown = termsMarkdown(id);
    const blocks = parseStandardTerms(markdown);

    it("leaves no markup in the text", () => {
      for (const run of blocks.flatMap(blockRuns)) {
        expect(run.text).not.toMatch(/<\/?span|\*\*|<https?:/);
      }
    });

    it("keeps the legal text verbatim apart from markup", () => {
      const plain = markdown
        .replace(/<(https?:\/\/[^>\s]+)>/g, "$1")
        .replace(/<[^>]+>|\*\*|^#+ |^\s*(\d+|[a-z]+)\. /gm, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/\s+/g, "");
      expect(blocks.map((b) => (b.type === "heading" ? b.text : textOf([b]))).join("").replace(/\s+/g, "")).toBe(plain);
    });

    it("numbers every clause as the template's section ids do", () => {
      const numbered = blocks.filter((b) => b.type === "numbered");
      const lines = markdown.split(/\r?\n/).filter((l) => /^\s*(\d+|[a-z]+)\. /.test(l));
      expect(numbered).toHaveLength(lines.length);
      lines.forEach((line, i) => {
        const id = /^\s*\d+\. <span class="header_\d" id="([^"]+)"/.exec(line)?.[1];
        if (id) expect(numbered[i].number).toBe(id);
      });
    });
  });
});
