import logging

from redis import Redis
from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..models.training_session import TrainingSession
from ..models.user import User
from ..schemas.auth import UserUpdate
from . import auth_service

logger = logging.getLogger(__name__)


def update_user_profile(db: Session, user: User, payload: UserUpdate) -> User:
    """PATCH semântico: só atualiza campos explicitamente enviados pelo cliente.
    `model_dump(exclude_unset=True)` garante que campos omitidos não sejam
    sobrescritos com None — diferente do PUT que exigia todos os campos."""
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def delete_user_account(db: Session, user: User, redis: Redis) -> None:
    """Apaga a conta e tudo que dela deriva (LGPD art. 18 / GDPR art. 17).

    Não havia caminho algum para exclusão, apesar de o cadastro guardar dado
    pessoal (e-mail, peso, altura, objetivo, nível) — o titular não tinha como
    exercer o direito à eliminação a não ser pedindo para alguém rodar SQL.

    Exclusão real, não `deleted_at`: soft delete manteria o dado pessoal no
    banco, que é exatamente o que a lei manda remover. O histórico de sessões
    vai junto — é dado de saúde vinculado à pessoa, não faz sentido preservá-lo
    órfão, e a FK `training_sessions.user_id` impediria a remoção de qualquer
    forma.

    As sessões são apagadas em UMA instrução (`DELETE ... WHERE user_id = ?`),
    não uma a uma: quem treina há meses tem centenas de linhas, e carregá-las
    para o Python só para apagar seria N+1 puro.
    """
    user_id = str(user.id)

    db.execute(delete(TrainingSession).where(TrainingSession.user_id == user_id))
    db.delete(user)
    db.commit()

    auth_service.revoke_all_sessions(user_id, redis)
    logger.info("user_account_deleted", extra={"user_id": user_id})
