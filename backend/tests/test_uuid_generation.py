"""Garantias do gerador de identificadores (`generate_uuid`).

O ganho do UUIDv7 — inserções no fim do índice em vez de espalhadas — depende
inteiramente de os valores serem monotônicos. Um erro de deslocamento de bits
produziria ids que ainda *parecem* UUIDs válidos e passariam despercebidos até
alguém investigar bloat de índice em produção.
"""

import time
import uuid
from concurrent.futures import ThreadPoolExecutor

from app.models.base import generate_uuid


def test_generated_id_is_a_valid_uuid_version_7():
    parsed = uuid.UUID(generate_uuid())

    assert parsed.version == 7
    assert parsed.variant == uuid.RFC_4122


def test_ids_are_time_ordered():
    """A propriedade que justifica a troca: ordem lexicográfica == ordem
    cronológica, então o B-tree cresce pela ponta."""
    first = generate_uuid()
    time.sleep(0.005)
    second = generate_uuid()

    assert first < second


def test_timestamp_matches_the_current_clock():
    before_ms = int(time.time() * 1000)
    generated = uuid.UUID(generate_uuid())
    after_ms = int(time.time() * 1000)

    embedded_ms = generated.int >> 80

    assert before_ms <= embedded_ms <= after_ms


def test_ids_are_unique_under_concurrency():
    """Dentro do mesmo milissegundo o tempo não diferencia nada — a unicidade
    depende dos 74 bits aleatórios."""
    with ThreadPoolExecutor(max_workers=8) as pool:
        ids = list(pool.map(lambda _: generate_uuid(), range(2_000)))

    assert len(set(ids)) == len(ids)
