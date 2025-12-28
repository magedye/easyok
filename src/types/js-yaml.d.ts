declare module 'js-yaml' {
  // Minimal declaration to satisfy TypeScript without pulling full type package
  export function load(str: string, opts?: unknown): any;
}
