"""Testes de compatibilidade do formato de sequência de pose gerado pelo
pipeline com o que o app espera (`PoseFrame`/`Landmark` em
app/src/services/poseTypes.ts).

Não dependem de mediapipe/opencv — só de `pose_sequence_format`, então
rodam com o pytest já listado em requirements-pipeline.txt.

Rodar com:
    cd backend/pipeline
    pytest test_pose_sequence_format.py
"""
from pose_sequence_format import Landmark, PoseFrame, frames_to_json_dict


def make_frame(timestamp_ms: int) -> PoseFrame:
    landmarks = [Landmark(x=0.1 * i, y=0.2 * i, visibility=0.9) for i in range(33)]
    return PoseFrame(timestamp_ms=timestamp_ms, landmarks=landmarks)


def test_frame_serializes_with_camel_case_keys_expected_by_the_app():
    frame = make_frame(100)

    serialized = frame.to_json_dict()

    # O app (TypeScript) espera `timestampMs` e `landmarks` (camelCase),
    # não os nomes em snake_case usados internamente no Python.
    assert serialized.keys() == {"timestampMs", "landmarks"}
    assert serialized["timestampMs"] == 100
    assert len(serialized["landmarks"]) == 33
    assert serialized["landmarks"][0] == {"x": 0.0, "y": 0.0, "visibility": 0.9}


def test_envelope_contains_exercise_id_and_landmark_format():
    frames = [make_frame(0), make_frame(100)]

    payload = frames_to_json_dict("squat", frames)

    assert payload["exerciseId"] == "squat"
    assert payload["landmarkFormat"] == "mediapipe-pose-33"
    assert len(payload["frames"]) == 2
    assert payload["frames"][0]["timestampMs"] == 0
    assert payload["frames"][1]["timestampMs"] == 100


def test_each_landmark_has_the_three_fields_the_app_relies_on():
    frame = make_frame(0)

    serialized = frame.to_json_dict()

    for landmark in serialized["landmarks"]:
        assert landmark.keys() == {"x", "y", "visibility"}
        assert isinstance(landmark["x"], float)
        assert isinstance(landmark["y"], float)
        assert isinstance(landmark["visibility"], float)
