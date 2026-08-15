import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    /* VENDORED, NOT OURS. The shader wallpapers under this folder are React
       Bits (MIT + Commons Clause, LICENSE.md sits beside them), copied in
       unmodified so they can be re-copied when upstream changes. Linting third
       party code to our house rules only creates a choice between a red build
       and edits that make the next update a merge — so the rules stop at the
       folder boundary. Type checking does NOT: tsc still covers these files,
       and the wrapper that mounts them is ours and fully linted. */
    files: ["src/components/wallpapers/reactbits/**", "src/components/vendor/reactbits/**"],
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/exhaustive-deps": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
]);

export default eslintConfig;
