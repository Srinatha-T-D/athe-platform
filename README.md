# ATHE Platform

Custom-press streetwear studio: storefront, staff fulfillment app, and admin dashboard,
backed by a real API, deployed on AWS EKS, observed with Prometheus + Grafana, shipped
through GitHub Actions.

```
athe-platform/
├── frontend/
│   ├── storefront/   customer-facing shop (React + Vite)
│   ├── admin/         owner dashboard: sales, inventory, designs, delivery zones
│   └── staff/          fulfillment queue for print/pack/dispatch staff
├── backend/            Express + Prisma + PostgreSQL API
├── infra/
│   ├── terraform/       AWS: VPC, EKS, RDS, S3, IAM/IRSA, ECR
│   ├── k8s/               Kubernetes manifests for EKS
│   └── monitoring/         Prometheus rules + Grafana dashboard
├── .github/workflows/    CI/CD (app deploy + separate Terraform pipeline)
└── docker-compose.yml    local dev: Postgres + backend
```

## 0. Fastest path: free-tier single-box deploy

If you want this live on AWS with minimal cost, use `infra/free-tier/` instead of
the EKS setup below — it runs the whole stack (app + Postgres + Prometheus +
Grafana) on one free-tier EC2 instance via Docker Compose. Full instructions:
**`infra/free-tier/DEPLOY.md`**.

## 1. Local development

```bash
# backend + db
cp backend/.env.example backend/.env
docker compose up -d postgres
cd backend && npm install && npx prisma migrate dev && npm run dev

# any frontend app
cd frontend/storefront && cp .env.example .env && npm install && npm run dev
```

## 2. One-time AWS setup

1. Create the Terraform state bucket + DynamoDB lock table referenced in
   `infra/terraform/main.tf` (`athe-terraform-state`, `athe-terraform-locks`).
2. Update `infra/terraform/iam.tf` with your GitHub org/repo in the OIDC trust condition.
3. Request/import an ACM certificate for `*.athe.example.com` and drop its ARN into
   `infra/k8s/ingress.yaml` and `infra/monitoring/prometheus-values.yaml`.
4. `cd infra/terraform && terraform init && terraform apply` (or let the `terraform.yml`
   GitHub Actions workflow do it, with manual approval).

This provisions: VPC (3 AZs), EKS cluster + managed node group, ECR repos for all 4
images, RDS Postgres (credentials in Secrets Manager), S3 buckets (design uploads +
audit logs), and IAM roles — including an OIDC role for GitHub Actions so **no AWS
access keys are stored in CI**.

## 3. First deploy to the cluster

```bash
aws eks update-kubeconfig --name athe-prod --region ap-south-1

kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/secrets.example.yaml   # fill in real values first, don't commit them
kubectl apply -f infra/k8s/backend.yaml
kubectl apply -f infra/k8s/frontends.yaml
kubectl apply -f infra/k8s/ingress.yaml
kubectl apply -f infra/k8s/hpa.yaml
kubectl apply -f infra/k8s/servicemonitor.yaml
```

Update the `<ECR_REPO_URL>` placeholders in `backend.yaml` / `frontends.yaml` with the
`ecr_repository_urls` Terraform output before applying, or let CI do the image
substitution on every deploy.

## 4. Monitoring (Prometheus + Grafana)

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace -f infra/monitoring/prometheus-values.yaml

kubectl create configmap athe-grafana-dashboards \
  -n monitoring --from-file=infra/monitoring/grafana-dashboard-athe.json
kubectl apply -f infra/monitoring/alert-rules.yaml
```

The backend exposes business + system metrics at `/metrics` (orders, revenue, login
failures, HTTP latency/error rate); `infra/k8s/servicemonitor.yaml` wires it into
Prometheus, and the Grafana dashboard visualizes it. Alert rules cover revenue drop,
login-failure spikes (security), 5xx rate, pod availability, and latency.

## 5. CI/CD

- `.github/workflows/ci-cd.yml` — on push to `main`: test → build & push Docker images
  to ECR → run Prisma migrations → roll out to EKS. Uses AWS OIDC, no static keys.
- `.github/workflows/terraform.yml` — plans on every PR touching `infra/terraform/`,
  applies on `main` behind a GitHub Environment manual-approval gate.

Required repo secrets: `AWS_GITHUB_ACTIONS_ROLE_ARN`, `ECR_REGISTRY`.

## 6. What's tracked

- **Inventory**: stock per garment/color, low-stock threshold, adjustable from Admin.
- **Sales & revenue**: per-order totals, daily/monthly rollups via `/api/orders/stats/summary`.
- **Security**: JWT-gated admin/staff routes, failed-login counter, Secrets Manager
  for DB credentials (never in git), audit-log S3 bucket, IRSA (no long-lived AWS
  keys on pods), OIDC for CI (no long-lived AWS keys in GitHub).

## Notes / next steps

- Swap the placeholder `example.com` domains and `<ACM_CERT_ARN>` / `<GITHUB_ORG>` /
  `<SLACK_WEBHOOK_URL>` tokens for real values before applying.
- Add a seed script (`backend/prisma/seed.js`) to load the current mock catalog/designs
  into Postgres — the frontends are wired to read `VITE_API_BASE_URL`, so once the API
  is live they can be switched from local mock arrays to real `fetch` calls.
- Consider AWS WAF on the ALB and GuardDuty for the security-monitoring piece beyond
  app-level metrics.

