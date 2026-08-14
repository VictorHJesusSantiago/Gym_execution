"""Fitness functions do grafo de módulos (ADP + SDP — Domínio 5/8).

Regra de dependência e ausência de ciclos eram só convenção escrita no README:
nada impedia um `services/` importar um `routers/` numa tarde apressada, e o
ciclo só apareceria como `ImportError` circular meses depois, longe da causa.

Verificação por análise ESTÁTICA (`ast`), não por import de verdade: importar os
módulos para inspecioná-los criaria o próprio ciclo que queremos detectar, e
exigiria banco/Redis de pé.
"""

import ast
from pathlib import Path

_APP_ROOT = Path(__file__).resolve().parent.parent / "app"

_LAYERS = ("routers", "services", "schemas", "core", "models")


def _module_name(path: Path) -> str:
    """`app/core/deps.py` -> `app.core.deps`; `app/core/__init__.py` -> `app.core`."""
    relative = path.relative_to(_APP_ROOT.parent).with_suffix("")
    parts = list(relative.parts)
    if parts[-1] == "__init__":
        parts.pop()
    return ".".join(parts)


def _resolve_relative(module: str, node: ast.ImportFrom) -> str | None:
    """Converte `from ..core.config import x` (dentro de app.routers.auth) em
    `app.core.config`."""
    if node.level == 0:
        return node.module if node.module and node.module.startswith("app") else None

    package_parts = module.split(".")[:-1]
    base = package_parts[: len(package_parts) - (node.level - 1)]
    if node.module:
        base = base + node.module.split(".")
    return ".".join(base) if base else None


def _internal_imports() -> dict[str, set[str]]:
    """Grafo `módulo -> módulos internos que ele importa`."""
    graph: dict[str, set[str]] = {}

    for path in sorted(_APP_ROOT.rglob("*.py")):
        module = _module_name(path)
        targets: set[str] = set()

        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if isinstance(node, ast.ImportFrom):
                resolved = _resolve_relative(module, node)
                if resolved and resolved.startswith("app"):
                    targets.add(resolved)
            elif isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name.startswith("app"):
                        targets.add(alias.name)

        graph[module] = targets

    return graph


def _layer_of(module: str) -> str | None:
    parts = module.split(".")
    return parts[1] if len(parts) > 1 and parts[1] in _LAYERS else None


def test_dependencies_point_inward():
    """`routers` -> `services` -> `schemas`/`core` -> `models`, nunca ao contrário.

    Uma seta para fora significaria, por exemplo, um modelo sabendo de HTTP —
    e a partir daí trocar o framework web deixa de ser possível sem tocar no
    domínio.
    """
    violations = []

    for module, targets in _internal_imports().items():
        source_layer = _layer_of(module)
        if source_layer is None:
            continue

        for target in targets:
            target_layer = _layer_of(target)
            if target_layer is None or target_layer == source_layer:
                continue
            if _LAYERS.index(target_layer) < _LAYERS.index(source_layer):
                violations.append(f"{module} -> {target} ({source_layer} depende de {target_layer})")

    assert not violations, "dependências apontando para fora:\n  " + "\n  ".join(sorted(violations))


def test_module_graph_has_no_cycles():
    """O grafo precisa ser um DAG (Acyclic Dependencies Principle)."""
    graph = _internal_imports()
    cycles: list[str] = []

    WHITE, GREY, BLACK = 0, 1, 2
    colour = dict.fromkeys(graph, WHITE)

    def visit(module: str, stack: list[str]) -> None:
        colour[module] = GREY
        for target in sorted(graph.get(module, ())):
            if target not in colour:
                continue
            if colour[target] == GREY:
                start = stack.index(target)
                cycles.append(" -> ".join([*stack[start:], target]))
            elif colour[target] == WHITE:
                visit(target, [*stack, target])
        colour[module] = BLACK

    for module in sorted(graph):
        if colour[module] == WHITE:
            visit(module, [module])

    assert not cycles, "ciclos de importação:\n  " + "\n  ".join(sorted(set(cycles)))


def test_models_depend_on_nothing_internal_but_models():
    """O núcleo do domínio tem que ser folha do grafo.

    Um `models/` que importe `core/` amarra as entidades a configuração,
    conexão de banco e Redis — e leva tudo isso junto para dentro de qualquer
    teste, migration ou script que só queria uma entidade.
    """
    offenders = {
        module: sorted(t for t in targets if _layer_of(t) not in (None, "models"))
        for module, targets in _internal_imports().items()
        if _layer_of(module) == "models"
    }
    offenders = {module: targets for module, targets in offenders.items() if targets}

    assert not offenders, f"models/ importando outras camadas: {offenders}"
