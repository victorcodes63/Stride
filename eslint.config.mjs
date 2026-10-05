import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["prisma/**/*.js", "scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["src/components/**/*.tsx"],
    rules: {
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    files: ["src/app/**/page.tsx"],
    rules: {
      "@next/next/no-img-element": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    // Marketing product previews reuse dashboard UI. Keep them presentational:
    // no database, session or data-fetching code in the public site's bundle.
    files: ["src/components/marketing/product/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/lib/prisma", "@/lib/prisma/*", "@prisma/client"], message: "Marketing previews must not touch the database." },
            { group: ["next-auth", "next-auth/*", "@/lib/auth", "@/lib/auth/*", "@/lib/session*"], message: "Marketing previews must not read the session." },
            { group: ["@/contexts/*"], message: "Pass demo data as props instead of using dashboard providers." },
            { group: ["server-only"], message: "Marketing previews run on the client." },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
