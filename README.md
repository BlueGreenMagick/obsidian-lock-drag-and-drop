# Obsidian Plugin: Lock Drag and Drop

Lock Drag and Drop prevents accidental drag-and-drop actions in Obsidian sidebar views.

By default, drag-and-drop locking is enabled in File explorer and Outline. Use **Settings → Lock Drag and Drop → Enabled views** to configure other currently open sidebar views.

An enabled view starts locked. Select the open-lock button in its navigation header to enable dragging for that view. Select it again to restore the lock.

On mobile, the plugin preserves long-press menus by dispatching a context-menu event before it cancels a locked drag.


## Development

Install dependencies and build the plugin:

```sh
npm install
npm run build
```

The build writes `main.js`, `manifest.json`, and `styles.css` to `dist/`.

## Disclaimer

This plugin was developed with AI assistance, and all code have been reviewed by a human.

This plugin is not affiliated with official Obsidian product.
