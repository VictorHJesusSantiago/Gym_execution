import os
import time
import uuid
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def generate_uuid() -> str:
    """UUID versão 7: 48 bits de timestamp em milissegundos seguidos de bits
    aleatórios (RFC 9562).

    Era `uuid4()`, totalmente aleatório. Como este valor é a CHAVE PRIMÁRIA de
    `users` e `training_sessions`, cada inserção caía num ponto imprevisível do
    índice B-tree, espalhando escritas por todas as páginas, fragmentando o
    índice e inchando a tabela — o custo cresce junto com o volume, então o
    sintoma só aparece quando doer. UUIDv7 é monotônico no tempo: inserções
    novas vão para o fim do índice, como uma chave sequencial, mantendo a
    imprevisibilidade externa (nada de id adivinhável, ao contrário de um
    `serial`).

    Implementado à mão porque `uuid.uuid7()` só existe a partir do Python 3.14 e
    o projeto roda em 3.12 (ver CI); trocar por `uuid.uuid7()` quando a base
    subir de versão.
    """
    timestamp_ms = int(time.time() * 1000)
    random_bits = int.from_bytes(os.urandom(10), "big")

    # 48 bits de tempo | versão (7) | 12 bits aleatórios | variante (0b10) | 62 bits aleatórios
    value = timestamp_ms << 80
    value |= 0x7 << 76
    value |= ((random_bits >> 68) & 0xFFF) << 64
    value |= 0b10 << 62
    value |= random_bits & ((1 << 62) - 1)

    return str(uuid.UUID(int=value))


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=True,
    )
