FROM python:3.12-bookworm

# Install ffmpeg for audio conversion
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y \
    git \
    curl \
    vim \
    sudo \
    build-essential \
    libpq-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*


# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy dependency files first for caching
COPY pyproject.toml ./

COPY README.md ./

# Install dependencies
RUN uv sync --no-dev

# Copy application code
COPY . .

# Create uploads and data directories
RUN mkdir -p uploads data
RUN mkdir -p /uploads
VOLUME /uploads

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
