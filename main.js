/*
 * PDF Page Break — Obsidian Plugin v2.3
 *
 * Changes vs v2.2:
 *  - Smarter content height measurement: ignores padding, decorative elements
 *    added by plugins like make.md that inflate scrollHeight
 *  - Auto-calibration: user enters the real PDF page count and the plugin
 *    calculates the correct scale factor automatically
 *  - Persists calibration per vault
 */

const {
  Plugin, PluginSettingTab, Setting,
  Notice, MarkdownView, Modal, ButtonComponent
} = require("obsidian");

const PX_PER_MM = 96 / 25.4;

const PAGE_SIZES = {
  A4:     { h: 297 },
  Letter: { h: 279.4 },
};

const DEFAULT_SETTINGS = {
  avoidBreakInsideImages:     true,
  avoidBreakInsideCodeBlocks: true,
  avoidBreakInsideTables:     true,
  avoidBreakInsideCallouts:   true,
  avoidBreakInsideHeadings:   true,
  showVisualIndicator:        true,
  pageSize:        "A4",
  marginTopMm:     20,
  marginBottomMm:  20,
  scaleCorrection: 0.90,   // more conservative default
  gutterHeightPx:  28,
};

// ─── Height measurement ───────────────────────────────────────────────────────
//
// Returns the "real" content height, filtering out extra padding/decorative
// elements added by plugins like make.md that inflate scrollHeight.

function measureContentHeight(contentEl, mode) {
  if (mode === "reading") {
    // In reading view, sum up the rendered block heights directly
    // This is more accurate than scrollHeight which includes padding
    let h = 0;
    const blocks = contentEl.querySelectorAll(
      ".el-p, .el-h1, .el-h2, .el-h3, .el-h4, .el-h5, .el-h6, " +
      ".el-ul, .el-ol, .el-blockquote, .el-pre, .el-table, " +
      ".callout, .internal-embed, .image-embed, img"
    );
    if (blocks.length > 0) {
      const first = blocks[0].getBoundingClientRect();
      const last  = blocks[blocks.length - 1].getBoundingClientRect();
      const containerTop = contentEl.getBoundingClientRect().top;
      h = (last.bottom - first.top);
      // Add some padding equivalent
      h += 48;
      return Math.max(h, contentEl.scrollHeight);
    }
    return contentEl.scrollHeight;
  }

  // Editor mode (CodeMirror): measure the actual lines, not the wrapper
  // cm-content can have extra bottom padding from plugins
  const cmLines = contentEl.querySelectorAll(".cm-line");
  if (cmLines.length > 0) {
    const last = cmLines[cmLines.length - 1];
    const contentRect = contentEl.getBoundingClientRect();
    const lastRect    = last.getBoundingClientRect();
    // Distance from top of cm-content to bottom of last line
    const h = (lastRect.bottom - contentRect.top) + 32; // 32px bottom buffer
    return Math.max(h, 100);
  }

  // Fallback
  return contentEl.scrollHeight;
}

// ─── Auto-calibration modal ────────────────────────────────────────────────────

class CalibrationModal extends Modal {
  constructor(app, plugin, currentPages) {
    super(app);
    this.plugin       = plugin;
    this.currentPages = currentPages;
    this.realPages    = null;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("plv-cal-modal");

    contentEl.createEl("h2", { text: "Auto-calibración" });
    contentEl.createEl("p", {
      text: `El plugin calcula ${this.currentPages} páginas. ¿Cuántas páginas tiene el PDF real exportado de esta nota?`,
    });

    const inputWrap = contentEl.createDiv({ cls: "plv-cal-row" });
    inputWrap.createEl("label", { text: "Páginas reales en el PDF:" });
    const input = inputWrap.createEl("input", {
      type: "number",
      placeholder: "ej. 4",
      cls: "plv-cal-input",
    });
    input.min = "1";
    input.step = "1";
    input.focus();

    const btnRow = contentEl.createDiv({ cls: "plv-cal-btns" });

    new ButtonComponent(btnRow)
      .setButtonText("Calibrar")
      .setCta()
      .onClick(async () => {
        const real = parseInt(input.value, 10);
        if (!real || real < 1) {
          new Notice("Introduce un número válido.");
          return;
        }
        // New scale = old scale * (real / current)
        const newScale = parseFloat(
          (this.plugin.settings.scaleCorrection * (real / this.currentPages)).toFixed(3)
        );
        const clamped = Math.min(1.5, Math.max(0.5, newScale));
        this.plugin.settings.scaleCorrection = clamped;
        await this.plugin.saveSettings();
        new Notice(`✓ Escala ajustada a ${clamped.toFixed(3)}. El plugin ahora debería mostrar ${real} páginas.`);
        this.close();
        // Re-render if layout view is active
        if (this.plugin.plm.active) this.plugin.plm._scheduleRender();
      });

    new ButtonComponent(btnRow)
      .setButtonText("Cancelar")
      .onClick(() => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }
}

// ─── Page Layout Manager ──────────────────────────────────────────────────────

class PageLayoutManager {
  constructor(plugin) {
    this.plugin      = plugin;
    this.active      = false;
    this.overlay     = null;
    this.indicator   = null;
    this.calBtn      = null;
    this.scrollEl    = null;
    this.contentEl   = null;
    this._mode       = null;
    this._rafId      = null;
    this._totalPages = 0;
    this._scrollBound = this._onScroll.bind(this);
    this._resizeOb   = null;
    this._mutOb      = null;
  }

  _resolveContainers(leaf) {
    const view = leaf?.view;
    if (!view || view.getViewType() !== "markdown") return null;

    const previewEl = view.previewMode?.containerEl;
    if (previewEl && previewEl.isShown()) {
      const content =
        previewEl.querySelector(".markdown-preview-section") ||
        previewEl.querySelector(".markdown-reading-view") ||
        previewEl;
      return { scroll: previewEl, content, mode: "reading" };
    }

    const editorEl = view.contentEl?.querySelector(".cm-editor");
    if (editorEl) {
      const scroller = editorEl.querySelector(".cm-scroller");
      const content  = editorEl.querySelector(".cm-content");
      if (scroller && content) {
        return { scroll: scroller, content, mode: "editor" };
      }
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

    // Calibration button inside the indicator
    this.calBtn = this.indicator.createEl("button", {
      cls: "plv-cal-btn",
      text: "Calibrar",
      title: "Auto-calibrar con el PDF real",
    });
    this.calBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const modal = new CalibrationModal(
        this.plugin.app,
        this.plugin,
        this._totalPages
      );
      modal.open();
    });

    this.scrollEl.addEventListener("scroll", this._scrollBound, { passive: true });

    this._resizeOb = new ResizeObserver(() => this._scheduleRender());
    this._resizeOb.observe(this.contentEl);

    this._mutOb = new MutationObserver(() => this._scheduleRender());
    this._mutOb.observe(this.contentEl, {
      childList: true, subtree: true, characterData: true,
    });

    this.active = true;
    this._scheduleRender();
    new Notice("📄 Page Layout View activado");
  }

  disable() {
    if (!this.active) return;
    this.overlay?.remove();    this.overlay   = null;
    this.indicator?.remove();  this.indicator = null;

    if (this.scrollEl) {
      this.scrollEl.removeEventListener("scroll", this._scrollBound);
      this.scrollEl.classList.remove("plv-scroll-active");
      this.scrollEl.style.position = "";
    }
    this.contentEl?.classList.remove("plv-content-active");

    this._resizeOb?.disconnect(); this._resizeOb = null;
    this._mutOb?.disconnect();    this._mutOb    = null;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }

    this.active    = false;
    this.scrollEl  = null;
    this.contentEl = null;
    this._mode     = null;
    new Notice("📄 Page Layout View desactivado");
  }

  toggle(leaf) {
    if (this.active) this.disable();
    else             this.enable(leaf);
    return this.active;
  }

  refresh(leaf) {
    if (!this.active) return;
    this.disable();
    setTimeout(() => this.enable(leaf), 80);
  }

  _onScroll() {
    if (!this.active || !this.scrollEl || this._totalPages < 1) return;
    const s         = this.plugin.settings;
    const pageH     = PAGE_SIZES[s.pageSize]?.h ?? 297;
    const contentPx = (pageH - s.marginTopMm - s.marginBottomMm)
                      * PX_PER_MM * s.scaleCorrection;
    const cur = Math.min(
      Math.floor(this.scrollEl.scrollTop / contentPx) + 1,
      this._totalPages
    );
    if (this.indicator) {
      // Update only the text node, keep the button
      this.indicator.childNodes[0].textContent = `Página ${cur} / ${this._totalPages}  `;
    }
  }

  _scheduleRender() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = requestAnimationFrame(() => this._render());
  }

  _render() {
    if (!this.active || !this.overlay || !this.contentEl) return;

    const s         = this.plugin.settings;
    const pageH     = PAGE_SIZES[s.pageSize]?.h ?? 297;
    const contentPx = (pageH - s.marginTopMm - s.marginBottomMm)
                      * PX_PER_MM * s.scaleCorrection;
    const gutter    = s.gutterHeightPx;

    // Use smarter height measurement instead of raw scrollHeight
    const totalH    = measureContentHeight(this.contentEl, this._mode);
    const pages     = Math.ceil(totalH / contentPx);
    this._totalPages = pages;

    const scrollRect  = this.scrollEl.getBoundingClientRect();
    const contentRect = this.contentEl.getBoundingClientRect();
    const hPad  = 20;
    const rectL = Math.max(0, (contentRect.left - scrollRect.left) - hPad);
    const rectW = Math.min(contentRect.width + hPad * 2, scrollRect.width - rectL * 2);

    this.overlay.empty();

    for (let i = 0; i < pages; i++) {
      const top = i * contentPx;

      const rect = this.overlay.createDiv({ cls: "plv-page-rect" });
      rect.style.top    = `${top}px`;
      rect.style.height = `${contentPx - gutter / 2}px`;
      rect.style.left   = `${rectL}px`;
      rect.style.width  = `${rectW}px`;

      rect.createDiv({ cls: "plv-page-num", text: `Página ${i + 1}` });

      if (i < pages - 1) {
        const gut = this.overlay.createDiv({ cls: "plv-gutter-strip" });
        gut.style.top    = `${top + contentPx - gutter / 2}px`;
        gut.style.height = `${gutter}px`;
        gut.style.left   = `${rectL}px`;
        gut.style.width  = `${rectW}px`;
        gut.createDiv({ cls: "plv-gutter-label", text: `— página ${i + 1} / ${i + 2} —` });
      }

      const warnTop = top + contentPx * 0.85;
      if (warnTop < totalH) {
        const w = rect.createDiv({ cls: "plv-warn-zone" });
        w.style.top    = `${contentPx * 0.85}px`;
        w.style.height = `${contentPx * 0.15 - gutter / 2}px`;
        w.createDiv({ cls: "plv-warn-label", text: "zona de riesgo" });
      }
    }

    // Set initial indicator text
    if (this.indicator) {
      this.indicator.childNodes[0].textContent = `Página 1 / ${pages}  `;
    }
    this._onScroll();
  }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

class PDFPageBreakPlugin extends Plugin {

  async onload() {
    await this.loadSettings();
    this.plm = new PageLayoutManager(this);

    this.registerMarkdownCodeBlockProcessor("pagebreak", (source, el) => {
      el.empty();
      el.addClass("pdf-page-break-wrapper");
      if (this.settings.showVisualIndicator) {
        const ind = el.createDiv({ cls: "pdf-page-break-indicator" });
        ind.createSpan({ cls: "pdf-pb-line" });
        ind.createSpan({ cls: "pdf-pb-label", text: "⌗ salto de página" });
        ind.createSpan({ cls: "pdf-pb-line" });
      }
      el.createDiv({ cls: "pdf-page-break-actual" });
    });

    this.addCommand({
      id: "insert-page-break",
      name: "Insert page break",
      editorCallback: (editor) => {
        const cursor = editor.getCursor();
        const prefix = editor.getLine(cursor.line).length > 0 ? "\n" : "";
        editor.replaceRange(prefix + "```pagebreak\n```\n", cursor);
        new Notice("✓ Salto de página insertado");
      },
    });

    this.addCommand({
      id: "toggle-page-layout-view",
      name: "Toggle Page Layout View",
      callback: () => {
        const leaf = this.app.workspace.getMostRecentLeaf();
        const on   = this.plm.toggle(leaf);
        this._layoutBtn?.toggleClass("plv-ribbon-active", on);
      },
    });

    this.addCommand({
      id: "calibrate",
      name: "Calibrate Page Layout View",
      callback: () => {
        if (!this.plm.active) {
          new Notice("Activa el Page Layout View primero.");
          return;
        }
        const modal = new CalibrationModal(this.app, this, this.plm._totalPages);
        modal.open();
      },
    });

    this.addRibbonIcon("scissors", "Insertar salto de página PDF", () => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (view) {
        const cursor = view.editor.getCursor();
        const prefix = view.editor.getLine(cursor.line).length > 0 ? "\n" : "";
        view.editor.replaceRange(prefix + "```pagebreak\n```\n", cursor);
        new Notice("✓ Salto de página insertado");
      } else {
        new Notice("Abre una nota primero.");
      }
    });

    this._layoutBtn = this.addRibbonIcon("file-text", "Toggle Page Layout View", () => {
      const leaf = this.app.workspace.getMostRecentLeaf();
      const on   = this.plm.toggle(leaf);
      this._layoutBtn.toggleClass("plv-ribbon-active", on);
    });

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        if (this.plm.active) {
          const leaf = this.app.workspace.getMostRecentLeaf();
          this.plm.refresh(leaf);
        }
      })
    );

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        if (this.plm.active) {
          this.plm.disable();
          this._layoutBtn?.removeClass("plv-ribbon-active");
        }
      })
    );

    this.addSettingTab(new PDFPageBreakSettingTab(this.app, this));
    this.injectPrintCSS();
    console.log("[PDF Page Break] v2.3 loaded.");
  }

  onunload() {
    this.plm.disable();
    document.getElementById("pdf-page-break-dynamic-css")?.remove();
  }

  injectPrintCSS() {
    document.getElementById("pdf-page-break-dynamic-css")?.remove();
    const s = this.settings, r = [];
    if (s.avoidBreakInsideImages)
      r.push(`img,.image-embed,.internal-embed{page-break-inside:avoid;break-inside:avoid}`);
    if (s.avoidBreakInsideCodeBlocks)
      r.push(`pre,code,.code-block{page-break-inside:avoid;break-inside:avoid}`);
    if (s.avoidBreakInsideTables)
      r.push(`table,thead,tbody,tr{page-break-inside:avoid;break-inside:avoid}`);
    if (s.avoidBreakInsideCallouts)
      r.push(`.callout,.callout-content{page-break-inside:avoid;break-inside:avoid}`);
    if (s.avoidBreakInsideHeadings)
      r.push(`h1,h2,h3,h4,h5,h6{page-break-after:avoid;break-after:avoid}`);
    const el = document.createElement("style");
    el.id = "pdf-page-break-dynamic-css";
    el.textContent = `@media print{${r.join(" ")}}`;
    document.head.appendChild(el);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.injectPrintCSS();
    if (this.plm.active) this.plm._scheduleRender();
  }
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

class PDFPageBreakSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "PDF Page Break" });

    containerEl.createEl("h3", { text: "📐 Page Layout View" });

    new Setting(containerEl)
      .setName("Tamaño de página")
      .addDropdown((dd) =>
        dd.addOption("A4",     "A4  (210 × 297 mm)")
          .addOption("Letter", "Letter  (216 × 279 mm)")
          .setValue(this.plugin.settings.pageSize)
          .onChange(async (v) => { this.plugin.settings.pageSize = v; await this.plugin.saveSettings(); })
      );

    new Setting(containerEl).setName("Margen superior (mm)")
      .addSlider((sl) => sl.setLimits(0,50,1).setValue(this.plugin.settings.marginTopMm).setDynamicTooltip()
        .onChange(async (v) => { this.plugin.settings.marginTopMm = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl).setName("Margen inferior (mm)")
      .addSlider((sl) => sl.setLimits(0,50,1).setValue(this.plugin.settings.marginBottomMm).setDynamicTooltip()
        .onChange(async (v) => { this.plugin.settings.marginBottomMm = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName("Factor de corrección de escala")
      .setDesc(`Valor actual: ${this.plugin.settings.scaleCorrection.toFixed(3)}. Usa el botón de calibración en el Page Layout View, o ajusta manualmente.`)
      .addSlider((sl) =>
        sl.setLimits(0.5, 1.5, 0.01).setValue(this.plugin.settings.scaleCorrection).setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.scaleCorrection = v;
            await this.plugin.saveSettings();
            // Refresh description
            this.display();
          })
      );

    new Setting(containerEl)
      .setName("Auto-calibrar ahora")
      .setDesc("Compara el número de páginas del plugin con tu PDF exportado y calcula el factor correcto automáticamente.")
      .addButton((btn) =>
        btn.setButtonText("Abrir calibración")
          .onClick(() => {
            if (!this.plugin.plm.active) {
              new Notice("Activa el Page Layout View primero (icono 📄 en la barra lateral).");
              return;
            }
            const modal = new CalibrationModal(
              this.plugin.app, this.plugin, this.plugin.plm._totalPages
            );
            modal.open();
          })
      );

    new Setting(containerEl).setName("Altura del separador entre páginas (px)")
      .addSlider((sl) => sl.setLimits(8,60,2).setValue(this.plugin.settings.gutterHeightPx).setDynamicTooltip()
        .onChange(async (v) => { this.plugin.settings.gutterHeightPx = v; await this.plugin.saveSettings(); }));

    containerEl.createEl("h3", { text: "🛡️ Protección de cortes (PDF)" });
    const toggles = [
      ["avoidBreakInsideImages",     "Imágenes",          "Evita que imágenes se corten entre páginas."],
      ["avoidBreakInsideCodeBlocks", "Bloques de código", "Mantiene los bloques de código en una sola página."],
      ["avoidBreakInsideTables",     "Tablas",            "Evita que las tablas se dividan entre páginas."],
      ["avoidBreakInsideCallouts",   "Callouts",          "Mantiene los callout boxes sin cortar."],
      ["avoidBreakInsideHeadings",   "Headings",          "El encabezado aparece en la misma página que su contenido."],
      ["showVisualIndicator",        "Indicador de salto manual", "Muestra la línea ⌗ donde insertas un pagebreak."],
    ];
    for (const [key, name, desc] of toggles) {
      new Setting(containerEl).setName(name).setDesc(desc)
        .addToggle((t) => t.setValue(this.plugin.settings[key])
          .onChange(async (v) => { this.plugin.settings[key] = v; await this.plugin.saveSettings(); }));
    }

    containerEl.createEl("h3", { text: "📖 Cómo usar" });
    const hint = containerEl.createDiv({ cls: "pdf-pb-settings-hint" });
    hint.innerHTML = `
      <p><strong>Salto de página manual</strong></p>
      <pre style="background:var(--code-background);padding:8px 12px;border-radius:5px;font-size:0.85em">\`\`\`pagebreak\n\`\`\`</pre>
      <p>O usa <kbd>Ctrl+P</kbd> → <em>Insert page break</em>, o el icono ✂️.</p>
      <hr style="border:none;border-top:1px solid var(--background-modifier-border);margin:0.8em 0">
      <p><strong>Calibración rápida</strong><br>
      1. Activa Page Layout View (icono 📄)<br>
      2. Exporta la nota a PDF y mira cuántas páginas tiene<br>
      3. Pulsa el botón <strong>Calibrar</strong> en la píldora azul e introduce el número de páginas del PDF<br>
      4. El plugin ajusta el factor automáticamente ✓</p>
    `;
  }
}

module.exports = PDFPageBreakPlugin;
