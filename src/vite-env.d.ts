/// <reference types="vite/client" />

declare module "*.css" {
  const content: string;
  export default content;
}

declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}

declare interface ImportMetaEnv {
  readonly VITE_PRIVACY_CF_WEB_ANALYTICS: string | undefined;
  readonly VITE_PRIVACY_COMPANY_NAME: string | undefined;
  readonly VITE_PRIVACY_COMPANY_PARENTHESES_VALUE: string | undefined;
  readonly VITE_PRIVACY_EMAIL: string | undefined;
}

// Prism ships its core and its language components as untyped legacy scripts;
// @types/prismjs only covers the "prismjs" entry point.
declare module "prismjs/components/prism-core" {
  import type Prism from "prismjs";
  const core: typeof Prism;
  export default core;
  export const highlight: typeof Prism.highlight;
  export const languages: typeof Prism.languages;
  export const tokenize: typeof Prism.tokenize;
}
declare module "prismjs/components/prism-sql";
