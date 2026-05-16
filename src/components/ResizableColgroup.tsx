/** Pairs with useResizableColumns — pass columns in visual order. */
export default function ResizableColgroup({ cols, widths }: { cols: string[]; widths: Record<string, number> }) {
  return (
    <colgroup>
      {cols.map(id => (
        <col key={id} style={{ width: widths[id], minWidth: widths[id] }} />
      ))}
    </colgroup>
  )
}
