#!/bin/bash
set -euo pipefail
exec > >(tee /var/log/athe-bootstrap.log) 2>&1

echo "== Installing Docker =="
dnf install -y docker git
systemctl enable --now docker
usermod -aG docker ec2-user

echo "== Installing Docker Compose plugin =="
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

echo "== Fetching app code =="
# Replace with your real repo once you push this project to GitHub.
mkdir -p /opt/athe
cd /opt/athe
if [ ! -d .git ]; then
  git clone https://github.com/Srinatha-T-D/athe-platform.git . || echo "No repo configured yet - upload code manually via scp instead."
fi

cat > /opt/athe/.env <<EOF
AWS_REGION=${aws_region}
UPLOADS_BUCKET=${uploads_bucket}
JWT_SECRET=$(openssl rand -hex 32)
CORS_ORIGIN=*
NODE_ENV=production
# Baked into the storefront/admin/staff builds at build time (Vite inlines
# VITE_-prefixed vars into the client bundle) - without this the frontends
# never call the real API and silently show local sample data instead of
# real products/designs/inventory photos.
VITE_API_BASE_URL=${api_base_url}
EOF

echo "== Starting stack =="
cd /opt/athe
if [ -f docker-compose.prod.yml ]; then
  docker compose -f docker-compose.prod.yml --env-file .env up -d --build
else
  echo "docker-compose.prod.yml not found yet - deploy code first, then run:"
  echo "  cd /opt/athe && docker compose -f docker-compose.prod.yml --env-file .env up -d --build"
fi

echo "== Bootstrap complete =="
