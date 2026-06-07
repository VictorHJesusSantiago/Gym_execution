import argparse
from collections import deque

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Gym movement monitor using computer vision."
    )
    parser.add_argument(
        "--source",
        default=0,
        help="Camera source index or video path (default: 0).",
    )
    parser.add_argument(
        "--history",
        type=int,
        default=30,
        help="Number of frames used for smoothing movement score.",
    )
    return parser.parse_args()


def get_source(raw_source: int | str):
    try:
        return int(raw_source)
    except (TypeError, ValueError):
        return raw_source


def movement_level(score: float) -> str:
    if score > 20:
        return "HIGH"
    if score > 8:
        return "MEDIUM"
    return "LOW"


def main() -> int:
    args = parse_args()

    try:
        import cv2
        import numpy as np
    except ModuleNotFoundError:
        print("Error: missing dependencies. Run: pip install -r requirements.txt")
        return 1

    source = get_source(args.source)

    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        print("Error: could not open camera/video source.")
        return 1

    previous_gray = None
    scores = deque(maxlen=max(1, args.history))

    print("Press 'q' to quit.")
    while True:
        success, frame = cap.read()
        if not success:
            break

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (7, 7), 0)

        if previous_gray is not None:
            diff = cv2.absdiff(gray, previous_gray)
            score = float(np.mean(diff))
            scores.append(score)
            avg_score = float(np.mean(scores))
            level = movement_level(avg_score)

            cv2.putText(
                frame,
                f"Movement: {level} ({avg_score:.1f})",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 255, 0),
                2,
                cv2.LINE_AA,
            )

        previous_gray = gray
        cv2.imshow("Gym Movement Monitor", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
