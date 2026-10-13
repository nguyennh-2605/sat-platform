/** Resolve the destination before upload so the image stays at the original caret. */
export const insertTestImage = (source: string, start: number, end: number, assetId: string) => {
  const markers = [...source.matchAll(/^[ \t]*(?:\[(?:IMG|TEXT|TABLE|POEM|NOTE|QUESTION)\]|QUESTION\s+\d+|={3,}\s*MODULE\s+\d+\s*={3,})[ \t\r]*$/gim)];
  let markerIndex = -1;
  for (let index = 0; index < markers.length && markers[index].index <= start; index++) markerIndex = index;
  const marker = markers[markerIndex];
  const blockEnd = markers[markerIndex + 1]?.index ?? source.length;

  if (marker && marker[0].trim().toUpperCase() === '[IMG]') {
    const contentStart = marker.index + marker[0].length;
    const content = source.slice(contentStart, blockEnd);
    const header = content.match(/^(?:\r?\n)?(?:[ \t]*@meta[^\r\n]*(?:\r?\n|$))*/)?.[0] ?? '';
    const remaining = content.slice(header.length);
    const reference = remaining.match(/^(?:[ \t]*\r?\n)*[ \t]*(?:asset:|https?:\/\/|data:|\/|[^ \r\n]+\.(?:png|jpe?g|webp))[^\r\n]*/i)?.[0] ?? '';
    const referenceEnd = contentStart + header.length + reference.length;
    const blankLines = source.slice(referenceEnd, blockEnd).match(/^(?:[ \t]*\r?\n)*/)?.[0] ?? '';
    const imageEnd = referenceEnd + blankLines.length;

    if (end <= imageEnd) {
      const metadata = header.split('\n').filter(line => /^[ \t]*@meta\s+/i.test(line)).map(line => line.replace(/\r$/, ''));
      const block = `[IMG]\n${metadata.length ? `${metadata.join('\n')}\n` : ''}asset:${assetId}\n\n`;
      return { text: source.slice(0, marker.index) + block + source.slice(imageEnd), cursor: marker.index + block.length };
    }
  }

  const before = source.slice(0, start);
  const after = source.slice(end);
  const block = `${before && !before.endsWith('\n\n') ? before.endsWith('\n') ? '\n' : '\n\n' : ''}[IMG]\nasset:${assetId}\n\n`;
  return { text: before + block + after, cursor: before.length + block.length };
};
