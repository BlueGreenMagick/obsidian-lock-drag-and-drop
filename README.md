# Obsidian Plugin: Lock Drag and Drop

Lock Drag and Drop prevents accidental drag-and-drop actions in Obsidian sidebar views.

You can toggle the unlock button on the top to unlock drag and drop only when needed.

On Mobile, long press triggers context-menu without drag and drop.

## Development

Install dependencies and build the plugin:

```sh
pnpm install
pnpm run build
```

The build writes `main.js`, `manifest.json`, and `styles.css` to `./dist/`.

Then symlink the `./dist/` folder from the Obsidian plugin folder. `ln -s <path to ./dist/> obsidian-lock-drag-and-drop`

### Creating a release

1. Update the version number in package.json and manifest.json
2. Update versions.json using `pnpm version`
3. Run below command to create and upload new version tag

```
git tag -a 1.0.0 -m "1.0.0"
git push origin main 1.0.0
```

## Disclaimer

This plugin was developed with AI assistance, and all code have been reviewed by a human.

This plugin is not affiliated with official Obsidian product.
