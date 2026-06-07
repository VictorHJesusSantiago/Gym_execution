"""Formato de dados da sequência de pose de referência.

Espelha deliberadamente os tipos `Landmark`/`PoseFrame` definidos em
`app/src/services/poseTypes.ts`, para que o app consuma o JSON gerado
aqui sem nenhuma camada de tradução. Os 33 landmarks seguem o índice
padrão do MediaPipe Pose (mesma referência usada em LANDMARK_INDEX no app).

Exemplo de um frame serializado:
    {
      "timestampMs": 100,
      "landmarks": [{"x": 0.51, "y": 0.49, "visibility": 0.97}, ...]
    }
"""
from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Landmark:
    x: float
    y: float
    visibility: float


@dataclass(frozen=True)
class PoseFrame:
    timestamp_ms: int
    landmarks: list[Landmark]

    def to_json_dict(self) -> dict:
        return {
            "timestampMs": self.timestamp_ms,
            "landmarks": [asdict(landmark) for landmark in self.landmarks],
        }


def frames_to_json_dict(exercise_id: str, frames: list[PoseFrame]) -> dict:
    """Envelope do arquivo de sequência publicado no storage de mídia
    (ver `reference_model_uri` em app/models/exercise.py)."""
    return {
        "exerciseId": exercise_id,
        "landmarkFormat": "mediapipe-pose-33",
        "frames": [frame.to_json_dict() for frame in frames],
    }
