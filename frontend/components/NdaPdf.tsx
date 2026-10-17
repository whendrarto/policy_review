import { Document, Font, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { PDF_FONT_FAMILY, PDF_FONT_FILES } from "@/lib/nda/pdfFont";
import type { Block, Run } from "@/lib/nda/types";

// Loaded only in the browser, when the user clicks Download (see NdaCreator).

// The built-in PDF fonts only cover Latin-1, so names like "Łukasz" would print wrongly.
// `fontUrl` maps a font file name to where it can be fetched (public/fonts in the app).
let fontsRegistered = false;
export function registerPdfFonts(fontUrl: (file: string) => string) {
  if (fontsRegistered) return;
  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: fontUrl(PDF_FONT_FILES.regular) },
      { src: fontUrl(PDF_FONT_FILES.bold), fontWeight: "bold" },
      { src: fontUrl(PDF_FONT_FILES.italic), fontStyle: "italic" },
    ],
  });
  fontsRegistered = true;
}

// Legal text should not be hyphenated across lines.
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { paddingVertical: 48, paddingHorizontal: 64, fontFamily: PDF_FONT_FAMILY, fontSize: 10, lineHeight: 1.35 },
  h1: { fontWeight: "bold", fontSize: 17, textAlign: "center", marginBottom: 8 },
  h2: { fontWeight: "bold", fontSize: 10.5, marginTop: 6, marginBottom: 3 },
  h3: { fontWeight: "bold", fontSize: 10.5, marginTop: 7, marginBottom: 1 },
  note: { fontStyle: "italic", fontWeight: "normal", fontSize: 9, color: "#555" },
  paragraph: { marginVertical: 2 },
  row: { flexDirection: "row", marginVertical: 2 },
  number: { width: 18 },
  flex: { flex: 1 },
  checkbox: { width: 9, height: 9, borderWidth: 0.75, borderColor: "#000", marginTop: 3, marginRight: 8, fontSize: 7, textAlign: "center", lineHeight: 1.1 },
  bold: { fontWeight: "bold" },
  link: { color: "#000", textDecoration: "underline" },
  table: { marginVertical: 8, borderTopWidth: 0.75, borderLeftWidth: 0.75, borderColor: "#999" },
  tableRow: { flexDirection: "row" },
  labelCell: { width: "26%", padding: 4, borderRightWidth: 0.75, borderBottomWidth: 0.75, borderColor: "#999", fontWeight: "bold" },
  cell: { width: "37%", minHeight: 22, padding: 4, borderRightWidth: 0.75, borderBottomWidth: 0.75, borderColor: "#999" },
  headerCell: { fontWeight: "bold", textAlign: "center" },
});

// Room for the header, Signature and Print Name rows.
const SIGNATURE_TABLE_LEAD = 90;

function Runs({ runs }: { runs: Run[] }) {
  return runs.map((run, i) => {
    switch (run.type) {
      case "bold":
        return (
          <Text key={i} style={styles.bold}>
            {run.text}
          </Text>
        );
      case "link":
        return (
          <Link key={i} src={run.href} style={styles.link}>
            {run.text}
          </Link>
        );
      case "text":
      case "field":
      case "variable":
        return <Text key={i}>{run.text}</Text>;
    }
  });
}

function PdfBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return <Text style={styles[`h${block.level}`]}>{block.text}</Text>;
    case "note":
      return <Text style={styles.note}>{block.text}</Text>;
    case "paragraph":
      return (
        <Text style={styles.paragraph}>
          <Runs runs={block.runs} />
        </Text>
      );
    case "numbered":
      return (
        <View style={styles.row} wrap>
          <Text style={styles.number}>{block.number}.</Text>
          <Text style={styles.flex}>
            <Runs runs={block.runs} />
          </Text>
        </View>
      );
    case "option":
      return (
        <View style={styles.row} wrap={false}>
          <Text style={styles.checkbox}>{block.checked ? "X" : " "}</Text>
          <Text style={styles.flex}>
            <Runs runs={block.runs} />
          </Text>
        </View>
      );
    case "parties":
      // Not wrap={false}: long notice addresses can make the table taller than a page, and
      // react-pdf clips an unbreakable block that doesn't fit. minPresenceAhead keeps the
      // signing sentence on the same page as the first rows; short rows don't split because
      // their text is within the default orphan/widow limits.
      return (
        <View>
          <Text style={styles.paragraph} minPresenceAhead={SIGNATURE_TABLE_LEAD}>
            <Runs runs={block.intro} />
          </Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.labelCell} />
              {block.headers.map((header) => (
                <Text key={header} style={[styles.cell, styles.headerCell]}>
                  {header}
                </Text>
              ))}
            </View>
            {block.rows.map((row) => (
              <View key={row.label} style={styles.tableRow}>
                <View style={styles.labelCell}>
                  <Text>{row.label}</Text>
                  {row.note && <Text style={styles.note}>{row.note}</Text>}
                </View>
                {row.values.map((runs, i) => (
                  // The border is on a View that stretches to the row height; the Text inside
                  // keeps its own height, so a short cell beside a long one isn't pushed to the
                  // row's last page when the row splits.
                  <View key={i} style={styles.cell}>
                    <Text>
                      <Runs runs={runs} />
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      );
    case "pageBreak":
      return <View break />;
  }
}

export function NdaPdf({ blocks }: { blocks: Block[] }) {
  return (
    <Document title="Mutual Non-Disclosure Agreement" author="Common Paper (CC BY 4.0)">
      <Page size="LETTER" style={styles.page}>
        {blocks.map((block, i) => (
          <PdfBlock key={i} block={block} />
        ))}
      </Page>
    </Document>
  );
}
