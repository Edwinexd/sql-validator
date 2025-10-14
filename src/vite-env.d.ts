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
