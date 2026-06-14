/**
 * `react-test-renderer` não publica tipos próprios e `@types/react-test-renderer`
 * não está entre as dependências do projeto (ver comment_versoes em
 * package.json — evitamos adicionar pacotes novos). Este shim cobre apenas a
 * API usada em testes de hooks (ex.: usePoseSession.test.ts).
 */
declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  export interface TestRenderer {
    unmount(): void;
    toJSON(): unknown;
  }

  export function create(element: ReactElement): TestRenderer;
  export function act(callback: () => void | Promise<void>): Promise<void>;
}
