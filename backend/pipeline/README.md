# Pipeline de ingestão de vídeos de referência

Processo **offline** (roda no servidor/CI — nunca no celular do usuário,
ver [ARCHITECTURE.md](../../ARCHITECTURE.md) seção 5) que transforma um
vídeo de um profissional executando um exercício em uma sequência de pose
publicada e consumida pelo app como padrão de comparação.

## Fluxo

```
vídeo de referência (.mp4)
        │
        ▼  extract_pose_sequence.py  (MediaPipe Pose, offline)
sequência de pose (.json — mesmo formato de PoseFrame do app)
        │
        ▼  publish_reference.py  (upload para storage S3-compatível)
URL pública e cacheável
        │
        ▼  (passo manual/futuro endpoint admin)
reference_model_uri do exercício, na tabela `exercises`
        │
        ▼
App baixa e cacheia localmente → usado em `getReferenceFrames`
(ver app/src/services/referenceLibrary.ts) para o cálculo do score
```

## Arquivos

- `pose_sequence_format.py` — define o formato JSON, espelhando
  deliberadamente `PoseFrame`/`Landmark` de `app/src/services/poseTypes.ts`
  (mesmo índice de 33 landmarks do MediaPipe Pose), para que o app consuma
  o arquivo sem tradução.
- `extract_pose_sequence.py` — lê o vídeo, roda a detecção de pose
  (MediaPipe) a cada ~100ms (mesma taxa de amostragem da `ExecutionScreen`
  no app) e grava o JSON da sequência.
- `publish_reference.py` — envia o JSON para o storage de mídia (S3) e
  imprime a URL a ser registrada em `reference_model_uri`.

## Instalação (faça você mesmo, com revisão antes de instalar)

> ⚠️ **Atenção a supply-chain attacks**: estas dependências (MediaPipe,
> OpenCV, boto3) são pesadas e têm grande superfície — confira os nomes
> exatos no PyPI oficial, use ambiente virtual isolado deste pipeline
> (separado do venv da API, já que são libs muito maiores) e rode
> `pip-audit` antes de usar em produção/CI.

```bash
cd backend/pipeline
python -m venv .venv-pipeline
. .venv-pipeline/Scripts/activate     # Windows (PowerShell: Activate.ps1)
pip install -r requirements-pipeline.txt
```

## Uso

```bash
python extract_pose_sequence.py --video squat_reference.mp4 \
    --exercise-id squat --out squat_reference.json

python publish_reference.py --exercise-id squat \
    --sequence-file squat_reference.json \
    --bucket gym-execution-reference-models
```

## Próximos passos do roadmap

- Endpoint administrativo (autenticado) para atualizar `reference_model_uri`
  automaticamente após a publicação, fechando o ciclo sem passo manual.
- Testes automatizados de `pose_sequence_format` (compatibilidade do JSON
  com o que `app/src/services/poseTypes.ts` espera).
