import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import stylistic from "@stylistic/eslint-plugin";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ["build/**"],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    plugins: {
      "@stylistic": stylistic
    }
  },
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser }
    }
  },
  {
    settings: {
      react: {
        version: "detect"
      }
    }
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn", 
        { 
          argsIgnorePattern: "^_",
        }
      ],
      "react/react-in-jsx-scope": "off",
      "quotes": ["error", "double", { avoidEscape: true }],
      "@stylistic/indent": ["error", 2],
      "@stylistic/jsx-quotes": ["error"],
      "@stylistic/semi": ["error", "always"],
    }
  },
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "react/prop-types": "off",
    },
  },
  {
    files: ["tailwind.config.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];
