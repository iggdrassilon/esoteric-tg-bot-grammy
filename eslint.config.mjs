import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import eslintPluginPrettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**"
    ],
  },

  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        sourceType: "module"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: {
      ...tseslint.configs.recommended.rules,
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/strict-boolean-expressions": "off",
        "@typescript-eslint/typedef": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        // "@typescript-eslint/no-unused-vars": "off",
        // "@typescript-eslint/no-empty-function": "off",
        // "@typescript-eslint/no-explicit-any": "off",
        // "@typescript-eslint/no-non-null-assertion": "off",
        // "@typescript-eslint/no-unnecessary-condition": "off",
      // ...tseslint.configs["recommended-requiring-type-checking"].rules,
      ...eslintPluginPrettier.rules
    }
  }
];
