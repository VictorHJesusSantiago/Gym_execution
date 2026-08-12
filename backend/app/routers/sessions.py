import redis as redis_lib
from fastapi import APIRouter, Depends, Header, Query, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.redis import get_redis
from ..models.training_session import TrainingSession
from ..models.user import User
from ..schemas.session import SessionStats, TrainingSessionCreate, TrainingSessionPublic
from ..services import session_service

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=TrainingSessionPublic, status_code=status.HTTP_201_CREATED)
def record_session(
    payload: TrainingSessionCreate,
    db: Session = Depends(get_db),
    redis: redis_lib.Redis = Depends(get_redis),
    current_user: User = Depends(get_current_user),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> TrainingSession:
    """Registra o resultado de uma série.

    `Idempotency-Key` (opcional, mas o app sempre envia): reenviar a mesma chave
    devolve a sessão já criada em vez de criar outra. O app grava resultados em
    fila local quando está offline e drena depois — se a resposta se perdesse
    após o commit no servidor (rede caindo no meio, timeout de 15s do
    apiClient), a mesma série era gravada de novo a cada tentativa e o histórico
    ganhava duplicatas que o usuário não tinha como remover.
    """
    return session_service.record_session(
        db, current_user.id, payload, redis=redis, idempotency_key=idempotency_key
    )


@router.get("/stats", response_model=SessionStats)
def get_my_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionStats:
    """Agrega estatísticas em uma query SQL — substitui o padrão de buscar
    todas as sessões no cliente (M4). Caminho literal /stats tem precedência
    sobre /{session_id} no roteamento do FastAPI."""
    return session_service.get_user_session_stats(db, current_user.id)


@router.get("", response_model=list[TrainingSessionPublic])
def list_my_sessions(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TrainingSession]:
    return session_service.list_user_sessions(db, current_user.id, limit=limit, offset=offset)
