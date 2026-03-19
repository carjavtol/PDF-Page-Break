# PDF Page Break — Obsidian Plugin

> Control page breaks and preview page boundaries when exporting your notes to PDF — directly inside Obsidian, without leaving your editor.

![Obsidian](https://img.shields.io/badge/Obsidian-0.15%2B-7C3AED?style=flat-square&logo=obsidian&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![Version](https://img.shields.io/badge/version-2.2.0-green?style=flat-square)

---

## The problem

When you export a note to PDF in Obsidian, screenshots, code blocks, and tables often get sliced in half across two pages. There's no native way to preview where page breaks will fall or to force a break at a specific point.

## What this plugin does

- **Page Layout View** — overlays Word-style page boundaries on your note (gray background, white page rectangles, sticky page counter). Works in both **Live Preview / Source mode** and **Reading View**.
- **Manual page breaks** — insert a `\`\`\`pagebreak\`\`\`` block anywhere to force a page break at that exact position when exporting to PDF.
- **Automatic break protection** — prevents images, code blocks, tables, callouts, and headings from being cut in the middle of a page.

---

## Screenshots

> *Page Layout View active in Live Preview mode. The white rectangles represent individual PDF pages; the red zone at the bottom of each page indicates where content risks being cut.*

---

## Installation

### Manual (recommended until BRAT/community listing)

1. Download the latest release zip from the [Releases](../../releases) page.
2. Extract it — you should have a folder called `pdf-page-break` containing `main.js`, `styles.css`, and `manifest.json`.
3. Copy that folder to your vault's plugin directory:
   ```
   <your-vault>/.obsidian/plugins/pdf-page-break/
   ```
4. In Obsidian → **Settings → Community plugins**, disable Safe Mode if prompted, then enable **PDF Page Break**.

### Via BRAT (beta testers)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat).
2. In BRAT settings, add this repository URL.
3. Enable the plugin in **Settings → Community plugins**.

---

## Usage

### Page Layout View

Click the **📄 icon** in the left ribbon, or open the command palette (`Ctrl/Cmd + P`) and run:

```
PDF Page Break: Toggle Page Layout View
```

Your note will switch to a Word-style layout:

| Element | What it means |
|---|---|
| Gray background | Outside the printable area |
| White rectangle | One PDF page |
| `Página X / Y` pill (top right) | Current page — updates live while you scroll and type |
| Red tinted zone (bottom of each page) | Risk zone — content here may get cut |

> **Tip:** If the page boundaries don't align perfectly with your exported PDF, go to **Settings → PDF Page Break** and adjust the **Scale correction factor** slider until they match. You only need to calibrate once.

### Manual page breaks

Insert a page break at the cursor position using the command palette or the **✂️ ribbon icon**. This inserts:

````markdown
```pagebreak
```
````

In Reading View, this renders as a subtle dashed line labeled `⌗ salto de página`. When you export to PDF, it becomes an actual page break — the dashed line disappears entirely.

You can also type the block manually anywhere in your note.

### Automatic break protection

By default, the plugin injects `page-break-inside: avoid` print CSS rules that prevent the following from being split across pages:

- Images and embedded files
- Code blocks
- Tables
- Callout blocks (`> [!info]`, `> [!warning]`, etc.)
- Headings (kept on the same page as the content that follows them)

All of these can be individually toggled in the plugin settings.

---

## Settings

| Setting | Default | Description |
|---|---|---|
| Page size | A4 | Matches Obsidian's PDF export setting |
| Top margin (mm) | 20 | Should match your PDF export margins |
| Bottom margin (mm) | 20 | Should match your PDF export margins |
| Scale correction factor | 1.0 | Fine-tune if page boundaries don't align with the real PDF |
| Page separator height (px) | 28 | Thickness of the gray gutter strip between pages |
| Protect images | ✅ | |
| Protect code blocks | ✅ | |
| Protect tables | ✅ | |
| Protect callouts | ✅ | |
| Protect headings | ✅ | |
| Show manual break indicator | ✅ | Show the `⌗` dashed line in the editor |

---

## Calibration guide

The Page Layout View is an approximation — Obsidian's screen render and its PDF engine use slightly different scaling. Here's how to calibrate:

1. Enable Page Layout View on a note you've already exported to PDF.
2. Compare where the gray gutter strips appear vs. where the real page breaks are in the PDF.
3. Open **Settings → PDF Page Break → Scale correction factor**.
   - If the gutter appears **too early** (before the actual cut) → increase the value.
   - If the gutter appears **too late** (after the actual cut) → decrease the value.
4. Once calibrated, the value stays across all your notes.

---

## Compatibility

| Environment | Status |
|---|---|
| Live Preview (CodeMirror 6) | ✅ Supported |
| Source mode | ✅ Supported |
| Reading View | ✅ Supported |
| Light theme | ✅ |
| Dark theme | ✅ |
| Obsidian 0.15+ | ✅ |
| Mobile | ❌ Desktop only |

---

## Roadmap

- [ ] Custom page size input (arbitrary mm values)
- [ ] Per-note margin configuration via frontmatter
- [ ] Visual ruler showing distance to the next page break
- [ ] Community plugin registry submission

---

## Contributing

Pull requests and issues are welcome. If you find a case where the page boundaries don't match your PDF output (after calibration), please open an issue including:

- Your Obsidian version
- Your OS
- The scale correction value you ended up using
- A rough description of your note content (lots of images? long code blocks?)

This helps improve the default calibration for everyone.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

*Built to scratch an itch while documenting CTFs and security labs in Obsidian. If it's useful for you too, a star goes a long way ⭐*
