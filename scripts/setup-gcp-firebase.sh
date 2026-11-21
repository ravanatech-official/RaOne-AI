#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-ravanatek}"
REGION="${2:-asia-southeast1}"
HOSTING_SITE="${3:-raone-ai}"
BUCKET_REGION="${4:-$REGION}"
CLOUD_RUN_SERVICE="raone-ai-backend"
RUNTIME_SA_NAME="raone-backend-sa"
DEPLOYER_SA_NAME="raone-github-deployer"
RUNTIME_SA="${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
DEPLOYER_SA="${DEPLOYER_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
RAONE_AI_BUCKET="${PROJECT_ID}-raone-ai-storage"
SUVA_SEVA_BUCKET="${PROJECT_ID}-raone-suva-seva-storage"
RAVANATEK_BUCKET="${PROJECT_ID}.firebasestorage.app"

echo "==> Configuring project ${PROJECT_ID} (Cloud Run: ${REGION}, Buckets: ${BUCKET_REGION})..."
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

echo "==> Creating separated per-site GCS buckets in ${BUCKET_REGION} (no per-bucket base fee)..."
for BUCKET_NAME in "${RAONE_AI_BUCKET}" "${SUVA_SEVA_BUCKET}"; do
  if gcloud storage buckets describe "gs://${BUCKET_NAME}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    echo "   - Bucket gs://${BUCKET_NAME} already exists."
  else
    gcloud storage buckets create "gs://${BUCKET_NAME}" \
      --project="${PROJECT_ID}" \
      --location="${BUCKET_REGION}" \
      --default-storage-class=STANDARD \
      --uniform-bucket-level-access \
      --public-access-prevention
    echo "   - Created gs://${BUCKET_NAME}"
  fi
done

echo "==> Creating GitHub Actions deployer service account (${DEPLOYER_SA})..."
gcloud iam service-accounts create "${DEPLOYER_SA_NAME}" \
  --display-name="RaOne AI GitHub CI/CD Deployer" \
  --project="${PROJECT_ID}" || true

for ROLE in \
  roles/run.admin \
  roles/cloudbuild.builds.editor \
  roles/artifactregistry.admin \
  roles/logging.viewer \
  roles/storage.admin \
  roles/firebasehosting.admin \
  roles/firebaserules.admin \
  roles/iam.serviceAccountUser \
  roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${DEPLOYER_SA}" \
    --role="${ROLE}"
done

echo "==> Ensuring Artifact Registry repository (cloud-run-source-deploy) exists in ${REGION}..."
if gcloud artifacts repositories describe cloud-run-source-deploy \
  --location="${REGION}" \
  --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "   - Artifact Registry repository cloud-run-source-deploy already exists."
else
  gcloud artifacts repositories create cloud-run-source-deploy \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Cloud Run source deploy repository" \
    --project="${PROJECT_ID}"
  echo "   - Created Artifact Registry repository cloud-run-source-deploy."
fi

echo ""
echo "✅ Setup complete!"
echo "Separated GCS Buckets for your 3 sites:"
echo "  - ravanatek.web.app      -> ${RAVANATEK_BUCKET} (existing Firebase default bucket)"
echo "  - raone-ai.web.app       -> ${RAONE_AI_BUCKET}"
echo "  - raone-suva-seva.web.app -> ${SUVA_SEVA_BUCKET}"
echo ""
echo "Next steps:"
echo "1. Generate a JSON key for GitHub Actions secret GCP_SA_KEY (keep this file private, do NOT commit it):"
echo "   gcloud iam service-accounts keys create ~/raone-github-deployer.json --iam-account=${DEPLOYER_SA}"
echo "2. In GitHub -> Settings -> Secrets and variables -> Actions -> Secrets:"
echo "   - Add GCP_SA_KEY (contents of ~/raone-github-deployer.json)"
echo "   - Add GEMINI_API_KEY (your Gemini API key)"
echo "   - Add TENANT_ENCRYPTION_SECRET (output of: openssl rand -hex 32)"
echo "3. In GitHub -> Settings -> Secrets and variables -> Actions -> Variables:"
echo "   - Add CLOUD_RUN_SERVICE_ACCOUNT=${RUNTIME_SA}"
echo "   - Add GCS_BUCKET_NAME=${RAONE_AI_BUCKET}"
echo "4. Push to main/master and GitHub Actions will auto-deploy Cloud Run (${CLOUD_RUN_SERVICE}) + Firebase Hosting (${HOSTING_SITE}.web.app) + Firestore Rules!"
