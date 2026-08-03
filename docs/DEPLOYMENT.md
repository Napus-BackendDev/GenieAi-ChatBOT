# Production deployment

This baseline runs three containers: nginx serves the built React SPA, proxies
`/api` and `/static` to FastAPI, and Redis remains private on the Compose
network. FastAPI runs one Uvicorn process without reload because embedded
ChromaDB is stored on a single writable volume.

## Configure

```powershell
Copy-Item backend/.env.example backend/.env
```

Replace all required values in `backend/.env`. Generate different random values
of at least 32 characters for `JWT_SECRET` and `WEBCHAT_JWT_SECRET`, configure
MongoDB Atlas, and set the public HTTPS origin/hostname in `CORS_ORIGINS` and
`TRUSTED_HOSTS`. Production startup fails closed when these values are unsafe.
Do not commit this file. No secret is used during either image build.

TLS should terminate at the hosting platform or an external reverse proxy in
front of port `8080`. Set `APP_PORT` in the shell or Compose `.env` only when a
different host port is required.

Keep `SESSION_COOKIE_SAMESITE=lax` and expose the SPA and API through one public
origin. For Vercel + Render, proxy `/api` and `/static` through the Vercel/custom
domain; the browser must not call the Render hostname directly. Keep
`CORS_ORIGINS` limited to the exact SPA HTTPS origin because authenticated
requests include cookies.

## Start and verify

```powershell
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
Invoke-WebRequest http://localhost:8080/healthz
docker compose -f docker-compose.prod.yml exec backend python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health/ready', timeout=3).status)"
```

The first request verifies nginx. The second verifies FastAPI inside its private
network boundary. Container health must be `healthy` before accepting traffic.

View logs without exposing environment values:

```powershell
docker compose -f docker-compose.prod.yml logs --tail 100 frontend backend redis
```

## Operations

- Persist and back up `backend_data` and `redis_data`. The backend data volume
  contains embedded ChromaDB and uploaded/extracted images; versioned assets
  such as `static/widget.js` remain in the container image.
- Do not scale the backend above one replica while ChromaDB remains embedded.
- For Upstash, set `REDIS_URL` to its `rediss://` URL. The bundled Redis can then
  be removed from the deployment if the platform manages Compose overrides.
- Apply image and dependency updates through CI, then rebuild and recreate the
  services.
- Configure each LINE tenant webhook as
  `https://your-domain.example/api/webhooks/line/{tenant_id}`. The tenantless
  legacy route is disabled in production.
