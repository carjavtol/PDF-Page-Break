const { Notice } = require("obsidian");
const PX_PER_MM = 96 / 25.4;
const PAGE_SIZES = { A4: { h: 297 }, Letter: { h: 279.4 } };
const CalibrationModal = require("../ui/calibration-modal");

// Smarter content height measurement
function measureContentHeight(contentEl, mode) {
  if (mode === "reading") {
    let h = 0;
    const blocks = contentEl.querySelectorAll(
      ".el-p, .el-h1, .el-h2, .el-h3, .el-h4, .el-ol, .el-ul, .el-blockquote, .el-pre, .el-table, .callout, .internal-embed, .image-embed, img"
    );
    if (blocks.length) {
      const first = blocks[0].getBoundingClientRect();
      const last  = blocks[blocks.length - 1].getBoundingClientRect();
      h = (last.bottom - first.top) + 48;
      return Math.max(h, contentEl.scrollHeight);
    }
    return contentEl.scrollHeight;
  }

  const cmLines = contentEl.querySelectorAll(".cm-line");
  if (cmLines.length) {
    const last = cmLines[cmLines.length - 1];
    const contentRect = contentEl.getBoundingClientRect();
    return (last.getBoundingClientRect().bottom - contentRect.top) + 32;
  }

  return contentEl.scrollHeight;
}

class PageLayoutManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.active = false;
    this.overlay = null;
    this.indicator = null;
    this.scrollEl = null;
    this.contentEl = null;
    this._rafId = null;
    this._totalPages = 0;
  }

  _resolveContainers(leaf) {
    const view = leaf?.view;
    if (!view || view.getViewType() !== "markdown") return null;

    const previewEl = view.previewMode?.containerEl;
    if (previewEl && previewEl.isShown()) {
      const content = previewEl.querySelector(".markdown-preview-section") || previewEl;
      return { scroll: previewEl, content, mode: "reading" };
    }

    const editorEl = view.contentEl?.querySelector(".cm-editor");
    if (editorEl) {
      const scroller = editorEl.querySelector(".cm-scroller");
      const content  = editorEl.querySelector(".cm-content");
      if (scroller && content) return { scroll: scroller, content, mode: "editor" };
    }
    return null;
  }

  enable(leaf) {
    if (this.active) this.disable();
    const containers = this._resolveContainers(leaf);
    if (!containers) {
      new Notice("Abre una nota en Editor o Reading View primero.");
      return;
    }

    this.scrollEl  = containers.scroll;
    this.contentEl = containers.content;
    this._mode     = containers.mode;

    this.scrollEl.style.position = "relative";
    this.scrollEl.classList.add("plv-scroll-active");
    this.contentEl.classList.add("plv-content-active");

    this.overlay   = this.scrollEl.createDiv({ cls: "plv-overlay" });
    this.indicator = this.scrollEl.createDiv({ cls: "plv-indicator" });
    this.indicator.setText("Página 1 / 1");

    this.active = true;
    this._scheduleRender();
    new Notice("📄 Page Layout View activado");
  }

  disable() {
    if (!this.active) return;
    this.overlay?.remove();
    this.indicator?.remove();
    this.scrollEl?.classList.remove("plv-scroll-active");
    this.scrollEl.style.position = "";
    this.contentEl?.classList.remove("plv-content-active");
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this.active = false;
    new Notice("📄 Page Layout View desactivado");
  }

  toggle(leaf) {
    if (this.active) this.disable();
    else this.enable(leaf);
    return this.active;
  }

  _scheduleRender() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = requestAnimationFrame(() => this._render());
  }

  _render() {
    if (!this.active || !this.overlay || !this.contentEl) return;
    const s = this.plugin.settings;
    const pageH = PAGE_SIZES[s.pageSize]?.h ?? 297;
    const contentPx = (pageH - s.marginTopMm - s.marginBottomMm) * PX_PER_MM * s.scaleCorrection;

    this.overlay.empty();

    const totalH = measureContentHeight(this.contentEl, this._mode);
    const pages = Math.ceil(totalH / contentPx);
    this._totalPages = pages;

    for (let i = 0; i < pages; i++) {
      const top = i * contentPx;
      const rect = this.overlay.createDiv({ cls: "plv-page-rect" });
      rect.style.top = `${top}px`;
      rect.style.height = `${contentPx}px`;
    }

    if (this.indicator) this.indicator.textContent = `Página 1 / ${pages}`;
  }
}

module.exports = PageLayoutManager;