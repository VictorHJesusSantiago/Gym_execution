import { readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';

/**
 * Fitness functions do grafo de módulos do app (ADP + regra de dependência).
 *
 * A camada `services/` é descrita em todo lugar como "lógica pura e testável",
 * mas nada impedia um service importar um hook ou uma tela — e no dia em que
 * isso acontecesse, os testes de service passariam a exigir React, provider e
 * mock de navegação, sem nenhum aviso.
 *
 * Análise estática por leitura de arquivo: importar os módulos de verdade
 * criaria o próprio ciclo que se quer detectar.
 */

const SRC = resolve(__dirname, '..');

/** Da mais externa para a mais interna: cada uma só pode depender das de baixo. */
const LAYERS = ['navigation', 'screens', 'hooks', 'services'] as const;
type Layer = (typeof LAYERS)[number];

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry !== '__tests__') sourceFiles(path, found);
    } else if (/\.tsx?$/.test(entry) && !entry.endsWith('.d.ts')) {
      found.push(path);
    }
  }
  return found;
}

/**
 * O miolo do import NÃO pode conter outro `import`: com um `[\s\S]*?` solto, um
 * `import { useState } from 'react'` no topo do arquivo casava com o `from
 * '../algum/caminho'` de VÁRIAS linhas abaixo, e o `type` do import certo era
 * lido como ausente — todo import de tipo virava aresta de runtime e o
 * verificador acusava ciclos que não existem.
 */
const IMPORT_PATTERN = /^[ \t]*import\s+(type\s+)?((?:(?!\bimport\b)[\s\S])*?)from\s*['"](\.[^'"]+)['"]/gm;

/**
 * Arestas de RUNTIME. `import type` é apagado na compilação e não conta:
 * as telas importam `AuthenticatedStackParamList` de `navigation/AppNavigator`,
 * que por sua vez importa as telas — um ciclo que existe só no sistema de
 * tipos e desaparece no bundle. Tratá-lo como real obrigaria a uma indireção
 * inútil só para agradar o verificador.
 */
function runtimeImports(file: string): string[] {
  const source = readFileSync(file, 'utf-8');
  const targets: string[] = [];

  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const [, typeKeyword, clause, specifier] = match;
    if (typeKeyword) continue;

    // `import { type A, type B } from '...'` também é totalmente apagado.
    const named = clause.match(/\{([\s\S]*)\}/);
    if (named) {
      const specifiers = named[1].split(',').map((s) => s.trim()).filter(Boolean);
      if (specifiers.length > 0 && specifiers.every((s) => s.startsWith('type '))) continue;
    }

    targets.push(resolve(dirname(file), specifier));
  }

  return targets;
}

function layerOf(file: string): Layer | null {
  const segment = relative(SRC, file).split(/[\\/]/)[0];
  return (LAYERS as readonly string[]).includes(segment) ? (segment as Layer) : null;
}

function buildGraph(): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const file of sourceFiles(SRC)) {
    graph.set(file.replace(/\.tsx?$/, ''), runtimeImports(file));
  }
  return graph;
}

describe('arquitetura de módulos', () => {
  it('dependências apontam para dentro (navigation → screens → hooks → services)', () => {
    const violations: string[] = [];

    for (const [file, targets] of buildGraph()) {
      const from = layerOf(file);
      if (!from) continue;

      for (const target of targets) {
        const to = layerOf(target);
        if (!to || to === from) continue;
        if (LAYERS.indexOf(to) < LAYERS.indexOf(from)) {
          violations.push(`${relative(SRC, file)} -> ${relative(SRC, target)} (${from} depende de ${to})`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('services/ não importa hooks, telas nem navegação', () => {
    // É o que mantém `services/` puro e testável sem React — a convenção
    // central do projeto, hoje verificada em vez de apenas documentada.
    const offenders: string[] = [];

    for (const [file, targets] of buildGraph()) {
      if (layerOf(file) !== 'services') continue;
      for (const target of targets) {
        if (layerOf(target) !== null && layerOf(target) !== 'services') {
          offenders.push(`${relative(SRC, file)} -> ${relative(SRC, target)}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('o grafo de runtime é acíclico', () => {
    const graph = buildGraph();
    const cycles: string[] = [];
    const state = new Map<string, 'visiting' | 'done'>();

    function visit(node: string, stack: string[]) {
      state.set(node, 'visiting');
      for (const target of graph.get(node) ?? []) {
        if (!graph.has(target)) continue;
        if (state.get(target) === 'visiting') {
          const start = stack.indexOf(target);
          cycles.push([...stack.slice(start), target].map((f) => relative(SRC, f)).join(' -> '));
        } else if (!state.has(target)) {
          visit(target, [...stack, target]);
        }
      }
      state.set(node, 'done');
    }

    for (const node of graph.keys()) {
      if (!state.has(node)) visit(node, [node]);
    }

    expect([...new Set(cycles)]).toEqual([]);
  });
});
