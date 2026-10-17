// Markdown files are imported as strings (see the *.md rule in next.config.ts).
declare module "*.md" {
  const content: string;
  export default content;
}
