# Obsidian Plugin: Lock Drag and Drop

Lock Drag and Drop prevents accidental drag-and-drop actions in Obsidian sidebar views.

Every sidebar view with a navigation header starts locked. Select the open-lock button in a view's navigation header to enable dragging for that view. Select it again to restore the lock.

On mobile, the plugin preserves long-press menus by dispatching a context-menu event before it cancels a locked drag.

This plugin is not affiliated with official Obsidian product.

## Development

Install dependencies and build the plugin:

```sh
npm install
npm run build
```

The build writes `main.js`, `manifest.json`, and `styles.css` to `dist/`.
