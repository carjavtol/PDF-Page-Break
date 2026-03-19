const { PluginSettingTab, Setting, Notice } = require("obsidian");
const { CalibrationModal } = require("../ui/calibration-modal");

export class PDFPageBreakSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "PDF Page Break" });

    new Setting(containerEl)
      .setName("Tamaño de página")
      .addDropdown(dd =>
        dd.addOption("A4", "A4  (210 × 297 mm)")
          .addOption("Letter", "Letter  (216 × 279 mm)")
          .setValue(this.plugin.settings.pageSize)
          .onChange(async v => { this.plugin.settings.pageSize = v; await this.plugin.saveSettings(); })
      );

    new Setting(containerEl).setName("Margen superior (mm)")
      .addSlider(sl => sl.setLimits(0,50,1).setValue(this.plugin.settings.marginTopMm).setDynamicTooltip()
        .onChange(async v => { this.plugin.settings.marginTopMm = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl).setName("Margen inferior (mm)")
      .addSlider(sl => sl.setLimits(0,50,1).setValue(this.plugin.settings.marginBottomMm).setDynamicTooltip()
        .onChange(async v => { this.plugin.settings.marginBottomMm = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName("Factor de corrección de escala")
      .setDesc(`Valor actual: ${this.plugin.settings.scaleCorrection.toFixed(3)}`)
      .addSlider(sl => sl.setLimits(0.5, 1.5, 0.01).setValue(this.plugin.settings.scaleCorrection)
        .onChange(async v => { this.plugin.settings.scaleCorrection = v; await this.plugin.saveSettings(); this.display(); }));

    new Setting(containerEl)
      .setName("Auto-calibrar ahora")
      .addButton(btn => btn.setButtonText("Abrir calibración")
        .onClick(() => {
          if (!this.plugin.plm.active) { new Notice("Activa Page Layout View primero."); return; }
          new CalibrationModal(this.plugin.app, this.plugin, this.plugin.plm._totalPages).open();
        }));

    containerEl.createEl("h3", { text: "🛡️ Protección de cortes (PDF)" });
    const toggles = [
      ["avoidBreakInsideImages", "Imágenes"],
      ["avoidBreakInsideCodeBlocks", "Bloques de código"],
      ["avoidBreakInsideTables", "Tablas"],
      ["avoidBreakInsideCallouts", "Callouts"],
      ["avoidBreakInsideHeadings", "Headings"],
      ["showVisualIndicator", "Indicador de salto manual"],
    ];
    toggles.forEach(([key, name]) => {
      new Setting(containerEl)
        .setName(name)
        .addToggle(t => t.setValue(this.plugin.settings[key]).onChange(async v => { this.plugin.settings[key] = v; await this.plugin.saveSettings(); }));
    });
  }
}