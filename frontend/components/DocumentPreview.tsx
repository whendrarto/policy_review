import { memo } from "react";
import type { Block, Run } from "@/lib/documents/types";

function Runs({ runs }: { runs: Run[] }) {
  return runs.map((run, i) => {
    switch (run.type) {
      case "text":
        return <span key={i}>{run.text}</span>;
      case "bold":
        return <strong key={i}>{run.text}</strong>;
      case "link":
        return (
          <a key={i} href={run.href} target="_blank" rel="noopener noreferrer" className="underline">
            {run.text}
          </a>
        );
      case "variable":
        return (
          <span key={i} className="underline decoration-dotted underline-offset-2">
            {run.text}
          </span>
        );
      case "field":
        return (
          <mark
            key={i}
            className={`whitespace-pre-line rounded-sm px-0.5 ${run.filled ? "bg-sky-100 text-inherit" : "bg-amber-100 text-amber-800 italic"}`}
          >
            {run.text}
          </mark>
        );
    }
  });
}

// Memoised because the Standard Terms blocks are the same objects on every render, so
// a chat update only re-renders the cover page.
const PreviewBlock = memo(function PreviewBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      if (block.level === 1) return <h1 className="mb-4 text-center text-2xl font-bold">{block.text}</h1>;
      if (block.level === 2) return <h2 className="mt-6 mb-2 text-sm font-bold tracking-wide">{block.text}</h2>;
      return <h3 className="mt-5 mb-1 font-bold">{block.text}</h3>;
    case "note":
      return <p className="text-xs text-zinc-500 italic">{block.text}</p>;
    case "paragraph":
      return (
        <p className="my-2">
          <Runs runs={block.runs} />
        </p>
      );
    case "numbered":
      // Nested clauses are indented; their numbers ("5.3") need a wider column.
      return (
        <p className={`flex gap-2 ${block.level ? "my-2" : "my-3"}`} style={{ marginLeft: `${block.level * 1.5}rem` }}>
          <span className={`shrink-0 ${block.level === 1 ? "min-w-8" : "min-w-5"}`}>{block.label}</span>
          <span>
            <Runs runs={block.runs} />
          </span>
        </p>
      );
    case "option":
      return (
        <p className="my-1 flex gap-2">
          <span aria-label={block.checked ? "Selected" : "Not selected"}>{block.checked ? "☒" : "☐"}</span>
          <span className={block.checked ? "" : "text-zinc-400"}>
            <Runs runs={block.runs} />
          </span>
        </p>
      );
    case "parties":
      return (
        <>
          <p className="my-2">
            <Runs runs={block.intro} />
          </p>
          <table className="my-4 w-full table-fixed border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-1/4 border border-zinc-300" />
                {block.headers.map((header) => (
                  <th key={header} className="border border-zinc-300 p-2">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.label}>
                  <th className="border border-zinc-300 p-2 text-left align-top font-semibold">
                    {row.label}
                    {row.note && <span className="block text-xs font-normal text-zinc-500 italic">{row.note}</span>}
                  </th>
                  {row.values.map((runs, i) => (
                    <td key={i} className="h-10 border border-zinc-300 p-2 align-top">
                      <Runs runs={runs} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );
    case "pageBreak":
      return <hr className="my-10 border-dashed border-zinc-300" />;
  }
});

export function DocumentPreview({ blocks }: { blocks: Block[] }) {
  return (
    <article className="mx-auto max-w-[8.5in] bg-white px-10 py-12 font-serif text-[15px] leading-relaxed text-zinc-900 shadow-md ring-1 ring-zinc-200 sm:px-16">
      {blocks.map((block, i) => (
        <PreviewBlock key={i} block={block} />
      ))}
    </article>
  );
}
