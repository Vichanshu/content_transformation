FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
# Docling needs PyTorch. Install CPU-only wheels first so pip does not resolve
# the CUDA/NVIDIA-enabled PyPI build and consume several extra gigabytes.
RUN pip install --no-cache-dir \
      --index-url https://download.pytorch.org/whl/cpu \
      torch==2.8.0+cpu torchvision==0.23.0+cpu \
    && pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
