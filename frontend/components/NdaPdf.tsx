import { Document, Font, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Block, Run } from "@/lib/nda/types";

// Loaded only in the browser, when the user clicks Download (see NdaCreator).

// Legal text should not be hyphenated across lines.
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { paddingVertical: 48, paddingHorizontal: 64, fontFamily: "Times-Roman", fontSize: 10, lineHeight: 1.35 },
  h1: { fontFamily: "Times-Bold", fontSize: 17, textAlign: "center", marginBottom: 8 },
  h2: { fontFamily: "Times-Bold", fontSize: 10.5, marginTop: 6, marginBottom: 3 },
  h3: { fontFamily: "Times-Bold", fontSize: 10.5, marginTop: 7, marginBottom: 1 },
  note: { fontFamily: "Times-Italic", fontSize: 9, color: "#555" },
  paragraph: { marginVertical: 2 },
  row: { flexDirection: "row", marginVertical: 2 },
  number: { width: 18 },
  flex: { flex: 1 },
  checkbox: { width: 9, height: 9, borderWidth: 0.75, borderColor: "#000", marginTop: 3, marginRight: 8, fontSize: 7, textAlign: "center", lineHeight: 1.1 },
  bold: { fontFamily: "Times-Bold" },
  link: { color: "#000", textDecoration: "underline" },
  table: { marginVertical: 8, borderTopWidth: 0.75, borderLeftWidth: 0.75, borderColor: "#999" },
  tableRow: { flexDirection: "row" },
  labelCell: { width: "26%", padding: 4, borderRightWidth: 0.75, borderBottomWidth: 0.75, borderColor: "#999", fontFamily: "Times-Bold" },
  cell: { width: "37%", minHeight: 22, padding: 4, borderRightWidth: 0.75, borderBottomWidth: 0.75, borderColor: "#999" },
  headerCell: { fontFamily: "Times-Bold", textAlign: "center" },
});

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
      return (
        <View wrap={false}>
          <Text style={styles.paragraph}>
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
                  <Text key={i} style={styles.cell}>
                    <Runs runs={runs} />
                  </Text>
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
