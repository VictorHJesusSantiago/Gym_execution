"""Extrai a sequência de pose de um vídeo de referência usando MediaPipe Pose.

Processo OFFLINE (roda no servidor/CI, não no celular do usuário — ver
ARCHITECTURE.md seção 5: o app só faz inferência leve em tempo real).

Uso:
    python extract_pose_sequence.py --video squat_reference.mp4 \
        --exercise-id squat --out squat_reference.json

Pré-requisito: instalar `requirements-pipeline.txt` (revisão de
supply-chain antes de instalar — ver README.md do pipeline).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from pose_sequence_format import Landmark, PoseFrame, frames_to_json_dict

# Importação tardia e opcional: este módulo deve poder ser lido/testado
# (ex.: `frames_to_json_dict`) mesmo sem mediapipe/opencv instalados.
try:
    import cv2
    import mediapipe as mp
except ImportError:  # pragma: no cover - guidance for local setup
    cv2 = None
    mp = None


SAMPLE_INTERVAL_MS = 100  # mesma taxa de amostragem usada no app (ExecutionScreen)


def extract_frames_from_video(video_path: Path) -> list[PoseFrame]:
    if cv2 is None or mp is None:
        raise RuntimeError(
            "Dependências do pipeline não instaladas. "
            "Instale com `pip install -r requirements-pipeline.txt` "
            "(revise as versões/hashes antes — ver README.md)."
        )

    pose_model = mp.solutions.pose.Pose(static_image_mode=False, model_complexity=1)
    capture = cv2.VideoCapture(str(video_path))

    frames: list[PoseFrame] = []
    next_sample_ms = 0

    try:
        while capture.isOpened():
            success, frame_bgr = capture.read()
            if not success:
                break

            timestamp_ms = int(capture.get(cv2.CAP_PROP_POS_MSEC))
            if timestamp_ms < next_sample_ms:
                continue

            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            result = pose_model.process(frame_rgb)

            if result.pose_landmarks is not None:
                landmarks = [
                    Landmark(x=lm.x, y=lm.y, visibility=lm.visibility)
                    for lm in result.pose_landmarks.landmark
                ]
                frames.append(PoseFrame(timestamp_ms=timestamp_ms, landmarks=landmarks))

            next_sample_ms = timestamp_ms + SAMPLE_INTERVAL_MS
    finally:
        capture.release()
        pose_model.close()

    return frames


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", required=True, type=Path, help="Caminho do vídeo de referência")
    parser.add_argument("--exercise-id", required=True, help="ID do exercício (ex.: squat)")
    parser.add_argument("--out", required=True, type=Path, help="Caminho do JSON de saída")
    args = parser.parse_args()

    if not args.video.exists():
        sys.exit(f"Vídeo não encontrado: {args.video}")

    frames = extract_frames_from_video(args.video)
    if not frames:
        sys.exit("Nenhuma pose detectada no vídeo — verifique enquadramento/iluminação.")

    payload = frames_to_json_dict(args.exercise_id, frames)
    args.out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"OK: {len(frames)} frames extraídos -> {args.out}")


if __name__ == "__main__":
    main()
