# Docker Setup for Vaultex

## Quick Start with Docker

### 1. Build the images

```bash
docker compose build
```

### 2. Start all services

```bash
docker compose up
```

The services will start at:

- **Frontend**: `http://localhost:5173`
- **Backend**: `http://localhost:3000` or `http://localhost:4000`

### 3. Stop services

```bash
docker compose down
```

## Running Individual Services

### Frontend only

```bash
docker compose up frontend
```

### Backend only

```bash
docker compose up backend
```

## Building Images Manually

### Frontend image

```bash
cd frontend && docker build -t vaultex-frontend . && cd ..
docker run -it --rm -p 5173:5173 vaultex-frontend
```

### Backend image

```bash
cd backend && docker build -t vaultex-backend . && cd ..
docker run -it --rm -p 3000:3000 vaultex-backend
```

## Troubleshooting

- Ensure Docker Desktop is running
- Check port availability (5173, 3000, 4000)
- Run `docker ps` to see active containers
- Run `docker logs <container-id>` for debugging
