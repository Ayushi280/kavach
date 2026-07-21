# Kavach backend - GPU-ready container
# =====================================
# Packages the ENTIRE backend (all .py files + the MuRIL model + deps) into one
# image, so deploying to AWS = ship this one thing, not 10+ files by hand.
#
# Base: NVIDIA CUDA runtime image. This provides the CUDA + cuDNN libraries that
# faster-whisper (CTranslate2) and PyTorch need to use the GPU. On the EC2 host
# you run it with `--gpus all` (needs nvidia-container-toolkit on the host).
#
# Build (on the EC2 instance, or build+push from anywhere):
#   docker build -t kavach-backend .
# Run:
#   docker run --gpus all -p 8000:8000 --env-file .env kavach-backend

FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

# system deps: python, ffmpeg (pydub/librosa need it), git
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 python3-pip python3.10-dev \
    ffmpeg git \
    && rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/bin/python3.10 /usr/bin/python

WORKDIR /app

# install python deps first (layer caching - deps rarely change)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# copy the whole backend: all .py files, the MuRIL model folder, everything.
# (see .dockerignore for what's excluded, e.g. the venv and audio test files)
COPY . .

# HuggingFace models (Whisper, IndicConformer, deepfake) download on first use
# and cache in the image's /root/.cache. IndicConformer is gated - pass an
# HF_TOKEN at runtime via --env-file so it can authenticate.
ENV HF_HUB_DISABLE_SYMLINKS_WARNING=1

EXPOSE 8000

# start the API. --host 0.0.0.0 so it's reachable from outside the container.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]