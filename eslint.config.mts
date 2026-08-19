import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores, defineConfig } from "eslint/config";

export default defineConfig(
  globalIgnores([
    "node_modules",
    "dist",
    "esbuild.config.mjs",
    "version-bump.mjs",
    "versions.json",
    "main.js",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
  ]),
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.{js,ts}"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        projectService: true,
        extraFileExtensions: [".json"],
      },
    },
  },
  {
    files: ["esbuild.config.mts", "eslint.config.mts"],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      "obsidianmd/no-nodejs-modules": "off",
    },
  },
);
