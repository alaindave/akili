import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "dist-app/**",
      "dist-electron/**",
      "coverage/**",
    ],
  },

  js.configs.recommended,

  ...tseslint.configs.recommended,

  reactHooks.configs.flat.recommended,

  // React renderer code: browser globals
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
  },

  // Electron main/preload code: Node.js globals
  {
    files: [
      "electron/**/*.{js,cjs,mjs,ts,tsx}",
      "src-electron/**/*.{js,cjs,mjs,ts,tsx}",
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
];
