# VoxCoach

English speech tutor powered by AI.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose

## Setup

1. Create the backend environment file:

   ```bash
   cp Backend/voxcoach/.env.example Backend/voxcoach/.env
   ```

   Then fill in your API keys in `Backend/voxcoach/.env`:

   ```
   GEMINI_API_KEY=your-gemini-api-key
   GROQ_API_KEY=your-groq-api-key
   JWT_SECRET_KEY=change-this-to-a-long-random-string-in-production
   ```

2. Build and start both services:

   ```bash
   docker compose up --build
   ```

   To rebuild from scratch (no cache):

   ```bash
   docker compose build --no-cache && docker compose up
   ```

3. Access the app:

   - **Frontend:** http://localhost:5173
   - **Backend API:** http://localhost:8000
   - **API Health Check:** http://localhost:8000/api/health

To stop the services:

```bash
docker compose down
```

## Running Without Docker

### Backend

Requires Python 3.12+ and [uv](https://docs.astral.sh/uv/).

```bash
cd Backend/voxcoach
uv sync
uv run uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend

Requires Node.js 22+.

```bash
cd Frontend
npm install
npm run dev
```

## Project Structure

```
VoxCoach/
├── Backend/voxcoach/   # FastAPI backend
│   ├── app/            # Application package (routers, services, models)
│   ├── main.py         # App entrypoint
│   └── Dockerfile
├── Frontend/           # React (Vite) frontend
│   └── Dockerfile
└── docker-compose.yml
```
