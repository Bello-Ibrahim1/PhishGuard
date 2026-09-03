# PhishGuard backend (sentinel/) — production image for Railway, Render, Fly.io, Cloud Run, etc.
FROM python:3.11-slim

WORKDIR /app

# System deps for scikit-learn / numpy wheels
RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY sentinel/requirements.txt sentinel/requirements.txt
RUN pip install --no-cache-dir -r sentinel/requirements.txt

# Only what the API needs at runtime (keeps the image smaller than copying datasets/ml scripts)
COPY sentinel/ sentinel/
COPY ml/models/ ml/models/

ENV PORT=8000
EXPOSE 8000

# $PORT is set by the host (Railway/Render); default 8000 for local `docker run`
CMD ["sh", "-c", "uvicorn sentinel.main:app --host 0.0.0.0 --port ${PORT}"]
