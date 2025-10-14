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

declare module "@djthoms/pretty-checkbox" {
  const content: unknown;
  export default content;
}

declare interface ImportMetaEnv {
  readonly VITE_PRIVACY_CF_WEB_ANALYTICS: string | undefined;
  readonly VITE_PRIVACY_COMPANY_NAME: string | undefined;
  readonly VITE_PRIVACY_COMPANY_PARENTHESES_VALUE: string | undefined;
  readonly VITE_PRIVACY_EMAIL: string | undefined;
}
