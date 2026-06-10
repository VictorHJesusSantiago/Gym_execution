<div align="center">

# 🏋️‍♂️ Gym Execution

### AI-powered, on-device workout form analysis — your phone is the only "judge" you need.

[![English](https://img.shields.io/badge/🌐_Language-English-2563EB?style=for-the-badge)](README.md)
[![Português](https://img.shields.io/badge/🌐_Idioma-Português-10B981?style=for-the-badge)](README.pt-BR.md)
[![Español](https://img.shields.io/badge/🌐_Idioma-Español-F59E0B?style=for-the-badge)](README.es.md)

<br/>

![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=FFD43B)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![TensorFlow Lite](https://img.shields.io/badge/TensorFlow_Lite-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)
![MediaPipe](https://img.shields.io/badge/MediaPipe-0097A7?style=for-the-badge&logo=google&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/CI%2FCD-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)

</div>

---

A hybrid (mobile + web) gym app that **records the user performing an
exercise with the phone camera** and returns a **correctness score**
(general + exercise-specific), comparing the captured movement against
reference patterns — **all processed on-device**. Raw video never leaves
the phone; only the final score is sent to the backend.

## 📑 Table of Contents

- [📐 Business Rules](#-business-rules)
- [✅ Functional Requirements](#-functional-requirements)
- [⚙️ Non-Functional Requirements](#️-non-functional-requirements)
- [🏗️ Architecture](#️-architecture)
  - [Component Diagram](#component-diagram)
  - [Execution Flow (Sequence Diagram)](#execution-flow-sequence-diagram)
  - [Data Model (ER Diagram)](#data-model-er-diagram)
- [🧰 Tech Stack](#-tech-stack)
- [📂 Repository Structure](#-repository-structure)
- [🚀 Getting Started](#-getting-started)
- [🔌 API Endpoints](#-api-endpoints)
- [🧪 Testing & CI/CD](#-testing--cicd)
- [🚢 Deploy](#-deploy)
- [🔒 Security & Supply Chain](#-security--supply-chain)

## 📐 Business Rules

- 🔑 A user must **register and log in** (JWT) to access any feature
  beyond authentication.
- 🏃 Each **execution** (a "set") is performed for **exactly one
  exercise**, picked from a shared **catalog** (seeded centrally, not
  per-user).
- 📊 Every execution produces a **single score (0–100)**, computed by
  comparing the captured pose sequence against that exercise's
  **reference pose sequence** (joint angles + Dynamic Time Warping).
- 🔐 **Privacy by design**: raw camera frames/video are **never**
  uploaded — only the computed score and metadata (exercise, timestamp)
  are persisted in the user's history.
- 📜 A user can only see **their own** training history
  (`GET /sessions` is scoped to the authenticated user).
- 🎬 Reference pose sequences are produced **offline**, by an admin
  pipeline that processes a professional's reference video and publishes
  the result to `exercises.reference_model_uri` via an
  admin-protected endpoint (`X-Admin-Api-Key`).
- 🚦 Auth endpoints (`/auth/register`, `/auth/login`) are **rate-limited**
  to mitigate brute-force/credential-stuffing.
- ⚙️ User preferences (camera quality, sound feedback, dark mode) are
  **device-local only** — never synced to the backend.

## ✅ Functional Requirements

| # | Requirement |
|---|---|
| FR1 | User registration and login (email + password → JWT) |
| FR2 | Browse the **exercise catalog** (name, muscle group, description) |
| FR3 | Capture an exercise execution via **camera** and detect body pose **on-device** |
| FR4 | Compute a **% score** comparing the execution to the exercise's reference sequence |
| FR5 | Show the result immediately at the end of the set |
| FR6 | Persist the result to the user's **paginated history** |
| FR7 | View/edit **profile** (name, email) and aggregated stats (sessions completed, average score) |
| FR8 | Configure **local preferences**: camera quality, feedback sound, dark mode |
| FR9 | Admin: publish a **reference pose sequence** for an exercise |
| FR10 | Logout / session management via secure token storage |

## ⚙️ Non-Functional Requirements

| # | Category | Requirement |
|---|---|---|
| NFR1 | **Performance** | Smooth on devices with **2GB RAM (~2015+)**: quantized (INT8) on-device models, ~10 fps sampling (`SAMPLE_INTERVAL_MS`), reduced capture resolution |
| NFR2 | **Privacy** | No raw video/image leaves the device; only numeric scores are transmitted |
| NFR3 | **Security** | JWT in secure storage (`expo-secure-store`), password hashing, rate limiting on auth, admin endpoints behind `X-Admin-Api-Key` |
| NFR4 | **Portability** | Single codebase (React Native + Expo) targeting **Android, iOS and Web** |
| NFR5 | **Availability/Offline-first CV** | Pose detection works without network connectivity (model bundled/cached on-device) |
| NFR6 | **Maintainability** | End-to-end typing (TypeScript + Pydantic), unit-tested core algorithms (`pytest`, `Jest`) |
| NFR7 | **Scalability** | Stateless FastAPI + PostgreSQL/Redis, containerized, ready for managed hosting |
| NFR8 | **Supply-chain security** | Pinned dependency versions, official registries only, lockfile-based installs (`npm ci`, `pip --require-hashes`) |
| NFR9 | **CI/CD** | Automated test suites + Docker image build + web export on every push to `main` |

## 🏗️ Architecture

### Component Diagram

```mermaid
%%{init: {'theme':'base', 'themeVariables': {'primaryColor':'#2563EB','primaryTextColor':'#fff','primaryBorderColor':'#1E40AF','lineColor':'#94A3B8','secondaryColor':'#10B981','tertiaryColor':'#F59E0B'}}}%%
graph TD
    classDef app fill:#2563EB,color:#fff,stroke:#1E3A8A,stroke-width:2px;
    classDef api fill:#10B981,color:#fff,stroke:#065F46,stroke-width:2px;
    classDef data fill:#F59E0B,color:#fff,stroke:#92400E,stroke-width:2px;
    classDef storage fill:#8B5CF6,color:#fff,stroke:#4C1D95,stroke-width:2px;
    classDef ci fill:#475569,color:#fff,stroke:#1E293B,stroke-width:2px;

    A["📱 App<br/>React Native + Expo<br/>Camera + on-device CV<br/>(MediaPipe / MoveNet TFLite)"]:::app
    B["⚡ Backend API<br/>FastAPI<br/>Auth · Exercises · Sessions"]:::api
    C[("🐘 PostgreSQL<br/>users, exercises,<br/>training_sessions")]:::data
    D[("🔴 Redis<br/>cache")]:::data
    E["☁️ Media Storage<br/>S3 / MinIO + CDN<br/>reference pose sequences"]:::storage
    F["🎬 Offline Pipeline<br/>extract_pose_sequence.py<br/>publish_reference.py"]:::storage
    G["🤖 CI/CD<br/>GitHub Actions<br/>tests · Docker image · web export"]:::ci

    A -- "HTTPS REST/JSON\n(score only)" --> B
    B --> C
    B --> D
    B -- "reference_model_uri" --> E
    A -- "download & cache\nreference model" --> E
    F -- "publish (admin API)" --> B
    F --> E
    G -. "build & push" .-> B
    G -. "export web" .-> A
```

### Execution Flow (Sequence Diagram)

```mermaid
%%{init: {'theme':'base', 'themeVariables': {'primaryColor':'#2563EB','primaryTextColor':'#fff','primaryBorderColor':'#1E40AF','actorBkg':'#10B981','actorTextColor':'#fff','signalColor':'#475569','signalTextColor':'#0f172a'}}}%%
sequenceDiagram
    actor U as 🏃 User
    participant App as 📱 App
    participant CV as 🧠 On-device CV
    participant API as ⚡ FastAPI

    U->>App: Select exercise
    App->>API: GET /exercises/{id}
    API-->>App: Exercise + reference_model_uri
    App->>App: Download/cache reference sequence
    U->>App: Tap "Start"
    App->>CV: load() — load quantized model
    loop ~10 fps while recording
        App->>CV: detect(frame)
        CV-->>App: PoseFrame (33 landmarks)
    end
    U->>App: Tap "Finish set"
    App->>App: scoreExecution(frames, reference)<br/>joint angles + DTW
    App-->>U: Show % score
    App->>API: POST /sessions { exerciseId, score, executedAt }
    API-->>App: 201 Created
```

### Data Model (ER Diagram)

```mermaid
%%{init: {'theme':'base', 'themeVariables': {'primaryColor':'#2563EB','primaryTextColor':'#fff','primaryBorderColor':'#1E40AF','lineColor':'#94A3B8'}}}%%
erDiagram
    USER ||--o{ TRAINING_SESSION : performs
    EXERCISE ||--o{ TRAINING_SESSION : "is target of"

    USER {
        string id PK
        string name
        string email UK
        string password_hash
    }
    EXERCISE {
        string id PK
        string name
        string muscle_group
        string description
        string reference_model_uri "nullable"
    }
    TRAINING_SESSION {
        string id PK
        string user_id FK
        string exercise_id FK
        int score "0-100"
        datetime executed_at
    }
```

## 🧰 Tech Stack

| Layer | Technology | Why |
|---|---|---|
| 📱 Hybrid app | **React Native + Expo (SDK 51)**, TypeScript | Single codebase for Android/iOS/Web, great camera support |
| 🧠 On-device CV (web) | **`@mediapipe/tasks-vision`** (WASM) | Google's official Pose Landmarker, runs in the browser |
| 🧠 On-device CV (mobile) | **MoveNet Lightning INT8** via **`react-native-fast-tflite`** | ~3MB quantized model, fast on low-end devices |
| 🖼️ Image preprocessing (mobile) | **`expo-camera`**, **`expo-image-manipulator`**, **`jpeg-js`** | Capture, crop/resize, decode to RGB tensor |
| ⚡ Backend / API | **Python 3.12 + FastAPI** | Fast, typed (Pydantic), industry standard |
| 🗄️ Database | **PostgreSQL 16** | Relational, robust, standard for user/training data |
| 🚀 Cache | **Redis 7** | Low-latency repeated lookups |
| 📦 Media storage | **S3-compatible (AWS S3 / MinIO) + CDN** | Reference videos & cached pose sequences |
| 🐳 Containerization | **Docker** (multi-stage, non-root) | Reproducible deploys |
| 🤖 CI/CD | **GitHub Actions** | Tests, Docker image publish (ghcr.io), web export |
| 📲 Mobile build/distribution | **EAS (Expo Application Services)** | Native builds (`expo-dev-client` required for TFLite) |
| 🧪 Testing | **Pytest** (backend) / **Jest** (frontend) | Industry standard |
| 🛠️ DB migrations | **Alembic** | Versioned schema changes |
| 🛡️ Rate limiting | **slowapi** | Protects auth endpoints |

> ⚠️ **Supply-chain caution**: install only from official registries
> (PyPI/npm), verify exact package names (avoid typosquatting), review
> generated lockfiles, and prefer pinned versions in production. See
> [Security & Supply Chain](#-security--supply-chain).

## 📂 Repository Structure

| Directory | What | Docs |
|---|---|---|
| [`app/`](app/) | React Native + Expo app (mobile + web): screens, camera capture, pose scoring | [app/README.md](app/README.md) |
| [`backend/`](backend/) | FastAPI API: auth, exercise catalog, session history | [backend/README.md](backend/README.md) |
| [`backend/pipeline/`](backend/pipeline/) | Offline pipeline: reference video → pose sequence → publish | [backend/pipeline/README.md](backend/pipeline/README.md) |
| [`.github/workflows/`](.github/workflows/) | CI/CD pipelines (tests, image build, web export) | — |

## 🚀 Getting Started

```bash
# 1) Backend (API)
cd backend
cp .env.example .env            # fill in local values
python -m venv .venv && . .venv/Scripts/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# 2) App (in another terminal)
cd app
cp .env.example .env            # point EXPO_PUBLIC_API_BASE_URL to the API above
npm ci
npx expo start
```

Optional local infrastructure (Postgres + Redis) via Docker:

```bash
docker compose up -d
```

## 🔌 API Endpoints

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/auth/register` | Register a new user | — |
| `POST` | `/auth/login` | Login, returns JWT | — |
| `GET` | `/exercises` | List the exercise catalog | 🔑 |
| `GET` | `/exercises/{id}` | Get exercise details | 🔑 |
| `PUT` | `/exercises/{id}/reference-model` | Publish a reference pose sequence URI | 🛡️ Admin |
| `GET` | `/sessions` | List the user's training sessions (paginated) | 🔑 |
| `POST` | `/sessions` | Record a training session result | 🔑 |
| `GET` | `/users/me` | Get current user profile | 🔑 |
| `PUT` | `/users/me` | Update current user profile | 🔑 |

## 🧪 Testing & CI/CD

```bash
# Backend
cd backend && pytest

# App
cd app && npm test
```

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs both suites on
every push/PR to `main`, builds & publishes the API Docker image to
`ghcr.io`, exports the web app, and (on schedule/manual trigger) runs an
integration suite against a real PostgreSQL service.

## 🚢 Deploy

- **Backend**: containerized via [`backend/Dockerfile`](backend/Dockerfile)
  (multi-stage, non-root, runs `alembic upgrade head` on start). Designed
  for a managed Postgres/Redis host (Railway, Render, Fly.io) — provider
  not yet chosen (`deploy-backend` job is a placeholder).
- **App (mobile)**: native builds via **EAS** (`app/eas.json`), requires
  `expo-dev-client` due to native CV modules.
- **App (web)**: static export via `npx expo export --platform web`,
  ready for any static host (Cloudflare Pages, Netlify, Vercel, S3+CDN).

Full details in the [app](app/README.md) and [backend](backend/README.md)
READMEs.

## 🔒 Security & Supply Chain

- ⚠️ As seen with malicious npm/PyPI packages: before installing any
  dependency, verify the **exact name** matches the official package (no
  typosquatting), review the generated lockfile, and prefer
  lockfile-respecting installers (`npm ci`,
  `pip install -r requirements.txt --require-hashes`).
- 🔐 `.env` files are **never** committed — see `.env.example` in
  `app/` and `backend/`, and [`.gitignore`](.gitignore).
- 🔑 Production `JWT_SECRET_KEY`/`ADMIN_API_KEY` must be generated fresh
  (`python -c "import secrets; print(secrets.token_urlsafe(64))"`) and
  stored as deployment/CI secrets — never reused from development.
- 📦 ML models (`.tflite`/`.task`) are downloaded only from official
  sources (TensorFlow Hub, Google AI Edge / MediaPipe), with checksums
  verified when available.
