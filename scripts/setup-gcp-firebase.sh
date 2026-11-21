#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-ravanatek}"
REGION="${2:-asia-southeast1}"
HOSTING_SITE="${3:-raone-ai}"
CLOUD_RUN_SERVICE="raone-ai-backend"
RUNTIME_SA_NAME="raone-backend-sa"
DEPLOYER_SA_NAME="raone-github-deployer"
RUNTIME_SA="${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
DEPLOYER_SA="${DEPLOYER_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "==> Configuring project ${PROJECT_ID} (${REGION})..."
gcloud config set project "${PROJECT_ID}"

echo "==> Enabling required Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  firebase.googleapis.com \
  firebasehosting.googleapis.com \
  firebaseinstallations.googleapis.com \
  iam.googleapis.com \
  --project="${PROJECT_ID}"

echo "==> Creating Cloud Run runtime service account (${RUNTIME_SA})..."
gcloud iam service-accounts create "${RUNTIME_SA_NAME}" \
  --display-name="RaOne AI Cloud Run Runtime" \
  --project="${PROJECT_ID}" || true

echo "==> Granting least-privilege IAM roles to runtime SA..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/storage.objectUser"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/logging.logWriter"

echo "==> Creating GitHub Actions deployer service account (${DEPLOYER_SA})..."
gcloud iam service-accounts create "${DEPLOYER_SA_NAME}" \
  --display-name="RaOne AI GitHub CI/CD Deployer" \
  --project="${PROJECT_ID}" || true

for ROLE in \
  roles/run.admin \
  roles/cloudbuild.builds.editor \
  roles/artifactregistry.writer \
  roles/storage.admin \
  roles/firebasehosting.admin \
  roles/firebaserules.admin \
  roles/iam.serviceAccountUser \
  roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${DEPLOYER_SA}" \
    --role="${ROLE}"
done

echo ""
echo "✅ Setup complete!"
echo "Next steps:"
echo "1. Generate a JSON key for GitHub Actions secret GCP_SA_KEY (keep this file private, do NOT commit it):"
echo "   gcloud iam service-accounts keys create ~/raone-github-deployer.json --iam-account=${DEPLOYER_SA}"
echo "2. In GitHub -> Settings -> Secrets and variables -> Actions -> Secrets:"
echo "   - Add GCP_SA_KEY (contents of ~/raone-github-deployer.json)"
echo "   - Add GEMINI_API_KEY (your Gemini API key)"
echo "   - Add TENANT_ENCRYPTION_SECRET (output of: openssl rand -hex 32)"
echo "3. In GitHub -> Settings -> Secrets and variables -> Actions -> Variables (optional):"
echo "   - Add CLOUD_RUN_SERVICE_ACCOUNT=${RUNTIME_SA}"
echo "   - Add GCS_BUCKET_NAME=${PROJECT_ID}.firebasestorage.app"
echo "4. Push to main/master and GitHub Actions will auto-deploy Cloud Run (${CLOUD_RUN_SERVICE}) + Firebase Hosting (${HOSTING_SITE}.web.app) + Firestore Rules!"
