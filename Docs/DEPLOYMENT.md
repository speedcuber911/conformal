# Deployment

This repo deploys two production surfaces from the same source tree. They must remain separate at the build and container level.

## Live Architecture

```text
Route53
  conformal.live                 -> 13.206.15.163
  dcmshriram.conformal.live       -> 13.206.15.163

EC2 host
  cut-nginx
    server_name conformal.live
      -> http://conformal-live:3000

    server_name dcmshriram.conformal.live
      -> http://partner-dcmshriram:3000

  conformal-live
    Next.js standalone production build
    SITE_VARIANT=conformal

  partner-dcmshriram
    Next.js standalone production build
    SITE_VARIANT=dcmshriram

  partner-dcmshriram-backend
    FastAPI ECEO sidecar for the DCM demo
```

The nginx edge is the existing Dockerized `cut-nginx` container on the `cutcompanion_default` network. It terminates TLS using the Let's Encrypt certificates mounted into that container.

## Build Variants

The root route is variant controlled at build time:

- `SITE_VARIANT=conformal` renders the Conformal landing and journal at `/`.
- `SITE_VARIANT=dcmshriram` renders the Project Leap cockpit at `/`.

The Dockerfile accepts `SITE_VARIANT` as a build arg, sets it in the builder and runner stages, copies `.next/standalone`, and starts with:

```bash
node server.js
```

Do not run `pnpm dev`, `next dev`, or `next start` in production.

## GitHub Actions

`.github/workflows/deploy.yml` runs on pushes to `main` and on manual dispatch.

Validation:

1. Install dependencies with pnpm.
2. Run `pnpm lint`.
3. Build `SITE_VARIANT=conformal`.
4. Build `SITE_VARIANT=dcmshriram`.
5. Validate both Docker Compose files.

Deployment:

1. Sync source to `/home/ubuntu/partner-apps/conformal`.
2. Run `scripts/deploy-conformal-ec2.sh`.
3. Verify the DCM runtime env exists in `/etc/leap.env`.
4. Sync source to `/home/ubuntu/partner-apps/dcmshriram`.
5. Run `scripts/deploy-ec2.sh`.
6. Verify public and internal health checks for both domains.

Required GitHub secrets:

- `EC2_HOST`
- `EC2_USER`
- `EC2_SSH_KEY`

## Manual Deploy

Conformal landing:

```bash
rsync -az --delete --exclude '.git' --exclude '.next' --exclude 'node_modules' ./ \
  ubuntu@13.206.15.163:/home/ubuntu/partner-apps/conformal/
ssh ubuntu@13.206.15.163 'cd /home/ubuntu/partner-apps/conformal && bash scripts/deploy-conformal-ec2.sh'
```

DCM demo:

```bash
rsync -az --delete --exclude '.git' --exclude '.next' --exclude 'node_modules' ./ \
  ubuntu@13.206.15.163:/home/ubuntu/partner-apps/dcmshriram/
ssh ubuntu@13.206.15.163 'cd /home/ubuntu/partner-apps/dcmshriram && bash scripts/deploy-ec2.sh'
```

## Verification

```bash
curl -kfsS https://conformal.live/api/health
curl -kfsS https://dcmshriram.conformal.live/api/health

ssh ubuntu@13.206.15.163 '
  docker exec cut-nginx nginx -t &&
  docker exec cut-nginx wget -qO- http://conformal-live:3000/api/health &&
  docker exec cut-nginx wget -qO- http://partner-dcmshriram:3000/api/health &&
  docker exec partner-dcmshriram wget -qO- http://partner-dcmshriram-backend:8000/health
'
```

Expected services:

- `conformal.live/api/health`: `{"ok":true,"service":"conformal"}`
- `dcmshriram.conformal.live/api/health`: `{"ok":true,"service":"dcmshriram"}`
- backend health: `{"status":"ok", ...}`
