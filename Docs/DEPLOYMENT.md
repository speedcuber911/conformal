# Deployment

This repo deploys two production surfaces from the same source tree. They must remain separate at the build and container level.

## Live Architecture

```text
Route53
  conformal.live                 -> Amplify-managed CloudFront
  dcmshriram.conformal.live       -> 13.206.15.163

AWS Amplify Hosting
  app dlwwm3b70gv88, branch main
    -> conformal.live

EC2 host
  cut-nginx
    server_name dcmshriram.conformal.live
      -> http://partner-dcmshriram:3000

  partner-dcmshriram
    Next.js standalone production build
    SITE_VARIANT=dcmshriram

  partner-dcmshriram-backend
    FastAPI ECEO sidecar for the DCM demo
```

The nginx edge is the existing Dockerized `cut-nginx` container on the `cutcompanion_default` network. It terminates TLS for the DCM demo using the Let's Encrypt certificates mounted into that container. The public Conformal site is no longer served from this EC2/nginx path during normal operation.

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

`.github/workflows/deploy.yml` runs on pushes to `main`, pull requests to `main`, and manual dispatch.

Validation:

1. Install dependencies with pnpm.
2. Run TypeScript and lint checks.
3. Build `SITE_VARIANT=conformal` for the public site.
4. Build `SITE_VARIANT=dcmshriram` for the demo.
5. Validate the Docker Compose files.

Deployment:

1. Amplify automatically rebuilds and deploys `conformal.live` from the pushed `main` commit.
2. GitHub Actions verifies the DCM runtime env exists in `/etc/leap.env`.
3. GitHub Actions syncs source to `/home/ubuntu/partner-apps/dcmshriram`.
4. GitHub Actions runs `scripts/deploy-ec2.sh`.
5. GitHub Actions verifies the public DCM health check.

Required GitHub secrets:

- `EC2_HOST`
- `EC2_USER`
- `EC2_SSH_KEY`

## Manual Deploy

Conformal landing deploys through Amplify. For a manual rebuild from local AWS CLI:

```bash
aws amplify start-job --app-id dlwwm3b70gv88 --branch-name main --job-type RELEASE --region ap-south-1
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
  docker exec cut-nginx wget -qO- http://partner-dcmshriram:3000/api/health &&
  docker exec partner-dcmshriram wget -qO- http://partner-dcmshriram-backend:8000/health
'
```

Expected services:

- `conformal.live/api/health`: `{"ok":true,"service":"conformal"}`
- `dcmshriram.conformal.live/api/health`: `{"ok":true,"service":"dcmshriram"}`
- backend health: `{"status":"ok", ...}`
