/**
 * `react-test-renderer` não publica tipos próprios e `@types/react-test-renderer`
 * não está entre as dependências do projeto (ver comment_versoes em
 * package.json — evitamos adicionar pacotes novos). Este shim cobre apenas a
 * API usada nos testes: render de hooks e de telas.
 *
 * Ao usar um método novo da lib, declare-o aqui — é a mesma disciplina do
 * `_FakeRedis` no backend: o dublê tem que acompanhar o que o código chama, ou
 * o erro só aparece em execução.
 */
declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  /** Nó da árvore renderizada, como exposto por `root`/`find`/`findAll`. */
  export interface ReactTestInstance {
    // `any` deliberado: as props variam por componente e tipá-las exigiria os
    // tipos completos do React Native, que é justamente o que se evita aqui.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    props: Record<string, any>;
    type: unknown;
    children: Array<ReactTestInstance | string>;
    parent: ReactTestInstance | null;
    find(predicate: (node: ReactTestInstance) => boolean): ReactTestInstance;
    findAll(
      predicate: (node: ReactTestInstance) => boolean,
      options?: { deep?: boolean }
    ): ReactTestInstance[];
  }

  export interface ReactTestRenderer {
    unmount(): void;
    toJSON(): unknown;
    root: ReactTestInstance;
  }

  /** Nome histórico, mantido para os testes que já o importavam. */
  export type TestRenderer = ReactTestRenderer;

  export function create(element: ReactElement): ReactTestRenderer;
  export function act(callback: () => void | Promise<void>): Promise<void>;
}
