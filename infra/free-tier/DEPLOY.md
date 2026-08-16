# ATHE — Free-Tier AWS Deployment Runbook

This deploys the whole platform (storefront, admin, staff, API, Postgres, Prometheus,
Grafana) onto a **single AWS free-tier EC2 instance** using Docker Compose. No EKS,
no RDS, no ALB, no NAT Gateway — so it stays inside the 12-month free tier
(750 hrs/month `t3.micro`, 30GB EBS, 1 Elastic IP, 5GB S3).

I can't run these commands for you (no AWS network access from my sandbox), but
this should take about 10–15 minutes end to end.

## Prerequisites (5 min, one-time)

1. **AWS account** with billing set up (free tier still needs a card on file).
2. **AWS CLI** installed and configured: `aws configure` (needs an IAM user with
   programmatic access — create one in IAM Console with `AdministratorAccess` for
   now, or a scoped policy later).
3. **Terraform** installed (`brew install terraform` / see terraform.io).
4. **An EC2 key pair** for SSH: AWS Console → EC2 → Key Pairs → Create key pair
   (download the `.pem` file, `chmod 400` it).
5. **Your public IP**: `curl https://checkip.amazonaws.com` — you'll lock SSH to this.
6. Push this project to a **GitHub repo** (the EC2 box pulls code from there).

## Step 1 — Push code to GitHub

```bash
cd athe-platform
git init && git add . && git commit -m "ATHE platform"
git remote add origin https://github.com/<you>/athe-platform.git
git push -u origin main
```

Then edit `infra/free-tier/user-data.sh.tpl` and replace `<YOUR_GITHUB_REPO_URL>`
with that URL.

## Step 2 — Provision AWS infra with Terraform

```bash
cd infra/free-tier
terraform init
terraform apply \
  -var="key_pair_name=<your-key-pair-name>" \
  -var="ssh_cidr=<your-ip>/32" \
  -var="api_base_url=https://api.yourdomain.com"
```

`api_base_url` is the URL the storefront/admin/staff apps call for the API - it
gets baked into their build (see `VITE_API_BASE_URL` below) and must match the
`api.*` host in `infra/free-tier/Caddyfile`. If you skip it, it defaults to
`https://api.athe.space` - fine only if that's actually your domain.

Type `yes` to confirm. This creates:
- 1× `t3.micro` EC2 instance (Amazon Linux 2023)
- 1× Elastic IP (free while attached to a running instance)
- 1× S3 bucket for design uploads
- 1× IAM role (S3 access only, no static keys)
- 1× security group (22 from your IP only, 80/443 open)

Terraform prints the public IP and a ready-made `ssh_command` when it finishes.

## Step 3 — Wait for the box to bootstrap (~3 min)

The EC2 user-data script installs Docker, clones your repo, and starts
`docker-compose.prod.yml` automatically on first boot. Check progress:

```bash
ssh -i <your-key>.pem ec2-user@<public-ip> "tail -f /var/log/athe-bootstrap.log"
```

If you didn't set the repo URL before `apply`, SSH in and run manually:

```bash
ssh -i <your-key>.pem ec2-user@<public-ip>
sudo su -
cd /opt/athe
git clone https://github.com/<you>/athe-platform.git .
# .env was already written by user-data; docker compose reads it automatically
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

## Step 4 — Visit your site

Terraform's `urls` output gives you:

| App        | URL                          |
|------------|-------------------------------|
| Storefront | `http://<public-ip>`          |
| Admin      | `http://<public-ip>:8081`     |
| Staff      | `http://<public-ip>:8082`     |
| API        | `http://<public-ip>:4000`     |
| Grafana    | `http://<public-ip>:3000`     |
| Prometheus | `http://<public-ip>:9090`     |

Grafana login: `admin` / whatever you set as `GRAFANA_ADMIN_PASSWORD` in `.env`
(defaults to `changeme` — **change this immediately**, see Step 5). The ATHE
dashboard auto-loads under the "ATHE" folder.

## Step 5 — Lock things down (do this before real traffic)

```bash
ssh -i <your-key>.pem ec2-user@<public-ip>
cd /opt/athe
# Set a real Grafana password and re-deploy that one service:
sed -i 's/GRAFANA_ADMIN_PASSWORD=.*/GRAFANA_ADMIN_PASSWORD=<a-strong-password>/' .env
docker compose -f docker-compose.prod.yml --env-file .env up -d grafana
```

Also worth doing once you're past the "does it work" stage:
- Point a real domain at the Elastic IP and put **Caddy or nginx + Let's Encrypt**
  in front for free HTTPS (or use **AWS Certificate Manager**, still free, if you
  later move to an ALB).
- Restrict the security group further once you know your real client IPs.
- Set up a nightly `pg_dump` cron job to back up Postgres to the S3 bucket
  (there's no managed RDS backups in this free-tier setup — the DB lives in a
  container volume on the instance).

## Troubleshooting: storefront/admin shows stale sample data (e.g. uploaded inventory photos don't appear)

The frontends read `VITE_API_BASE_URL` at **build time**, not runtime - if it's
missing, `npm run build` ships a bundle that never calls the real API and just
falls back to hardcoded sample products/designs, so nothing you add in Admin
(including inventory photos) ever shows up on the storefront.

If your box was provisioned before this variable existed, or you changed
`api_base_url`, update it and rebuild:

```bash
ssh -i <your-key>.pem ec2-user@<public-ip>
cd /opt/athe
grep -q '^VITE_API_BASE_URL=' .env \
  && sed -i 's#^VITE_API_BASE_URL=.*#VITE_API_BASE_URL=https://api.yourdomain.com#' .env \
  || echo 'VITE_API_BASE_URL=https://api.yourdomain.com' >> .env
docker compose -f docker-compose.prod.yml --env-file .env build storefront admin staff
docker compose -f docker-compose.prod.yml --env-file .env up -d storefront admin staff
```

## Scaling beyond free tier

When you outgrow one box: the `infra/terraform/` (EKS) and `infra/k8s/` directories
in this project are the natural next step — same application code, same Docker
images, just orchestrated across a real cluster with autoscaling, managed RDS, and
an ALB instead of one instance running Compose.

## Cost check

Everything above is $0/month for the first 12 months on a new AWS account, as long
as you stay within: 750 EC2 hours/month (1 instance running 24/7 = 730 hrs, fits),
30GB EBS, 5GB S3, 1 Elastic IP attached to a running instance. Set a **AWS Budgets**
alert at $1 (Billing Console → Budgets) so you get emailed the moment anything
drifts outside free tier.
