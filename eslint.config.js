import eslintPluginAstro from "eslint-plugin-astro";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", ".astro/**"] },
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  eslintConfigPrettier,
);
