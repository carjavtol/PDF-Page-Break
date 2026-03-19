export function measureContentHeight(contentEl, mode) {
  if (mode === "reading") {
    let h = 0;
    const blocks = contentEl.querySelectorAll(
      ".el-p, .el-h1, .el-h2, .el-h3, .el-h4, .el-h5, .el-h6, " +
      ".el-ul, .el-ol, .el-blockquote, .el-pre, .el-table, " +
      ".callout, .internal-embed, .image-embed, img"
    );

    if (blocks.length > 0) {
      const first = blocks[0].getBoundingClientRect();
      const last  = blocks[blocks.length - 1].getBoundingClientRect();
      h = (last.bottom - first.top) + 48;
      return Math.max(h, contentEl.scrollHeight);
    }

    return contentEl.scrollHeight;
  }

  const cmLines = contentEl.querySelectorAll(".cm-line");
  if (cmLines.length > 0) {
    const last = cmLines[cmLines.length - 1];
    const contentRect = contentEl.getBoundingClientRect();
    const lastRect    = last.getBoundingClientRect();
    return (lastRect.bottom - contentRect.top) + 32;
  }

  return contentEl.scrollHeight;
}