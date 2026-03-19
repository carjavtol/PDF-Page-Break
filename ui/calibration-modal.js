const { Modal, Notice } = require("obsidian");

export class CalibrationModal extends Modal {
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

    btnRow.createEl("button", { text: "Calibrar" }).addEventListener("click", async () => {
      const real = parseInt(input.value, 10);
      if (!real || real < 1) {
        new Notice("Introduce un número válido.");
        return;
      }
      const newScale = parseFloat((this.plugin.settings.scaleCorrection * (real / this.currentPages)).toFixed(3));
      const clamped = Math.min(1.5, Math.max(0.5, newScale));
      this.plugin.settings.scaleCorrection = clamped;
      await this.plugin.saveSettings();
      new Notice(`✓ Escala ajustada a ${clamped.toFixed(3)}. Ahora debería mostrar ${real} páginas.`);
      this.close();
      if (this.plugin.plm.active) this.plugin.plm._render();
    });

    btnRow.createEl("button", { text: "Cancelar" }).addEventListener("click", () => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }
}