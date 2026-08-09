// Minimal typings for the slice of jest-axe the tests use. The published
// @types/jest-axe pulls in @types/jest via a triple-slash reference, whose global
// expect() shadows Vitest's, so we declare only what we call here instead.
declare module "jest-axe" {
  export interface AxeViolation {
    id: string;
    impact?: string | null;
    description: string;
    help: string;
    helpUrl: string;
    nodes: unknown[];
  }
  export interface AxeResults {
    violations: AxeViolation[];
    passes: unknown[];
    incomplete: unknown[];
    inapplicable: unknown[];
  }
  export function axe(html: Element | string, options?: unknown): Promise<AxeResults>;
  export function configureAxe(options?: unknown): typeof axe;
}
