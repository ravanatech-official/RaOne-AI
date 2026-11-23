#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-ravanatek}"
REGION="${2:-asia-southeast1}"
HOSTING_SITE="${3:-raone-ai}"
BUCKET_REGION="${4:-$REGION}"
FIRESTORE_DB="raone-db"
CLOUD_RUN_SERVICE="raone-ai-backend"
RUNTIME_SA_NAME="raone-backend-sa"
DEPLOYER_SA_NAME="raone-github-deployer"
RUNTIME_SA="${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
DEPLOYER_SA="${DEPLOYER_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
RAONE_AI_BUCKET="${PROJECT_ID}-raone-ai-storage"
RAVANATEK_BUCKET="${PROJECT_ID}.firebasestorage.app"

echo "==> Configuring project ${PROJECT_ID} (Cloud Run & DB: ${REGION}, Bucket: ${BUCKET_REGION})..."
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

echo "==> Ensuring dedicated Standard Firestore database (${FIRESTORE_DB} in ${REGION}) exists..."
if gcloud firestore databases describe --database="${FIRESTORE_DB}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "   - Firestore database ${FIRESTORE_DB} already exists."
else
  gcloud firestore databases create \
    --database="${FIRESTORE_DB}" \
    --location="${REGION}" \
    --type=firestore-native \
    --project="${PROJECT_ID}"
  echo "   - Created Standard Native Firestore database ${FIRESTORE_DB} in ${REGION} (Free Tier eligible)."
fi

echo "==> Creating Cloud Run runtime service account (${RUNTIME_SA})..."
gcloud iam service-accounts create "${RUNTIME_SA_NAME}" \
  --display-name="RaOne AI Cloud Run Runtime" \
  --project="${PROJECT_ID}" || true

echo "==> Granting least-privilege IAM roles to runtime SA (isolated from other 2 sites)..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/datastore.user" \
  --condition="expression=resource.name.startsWith('projects/${PROJECT_ID}/databases/${FIRESTORE_DB}'),title=RaOneDbOnly,description=Restricts raone-backend-sa strictly to ${FIRESTORE_DB}"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/logging.logWriter"

echo "==> Creating dedicated GCS bucket gs://${RAONE_AI_BUCKET} in ${BUCKET_REGION} (sibling buckets untouched)..."
if gcloud storage buckets describe "gs://${RAONE_AI_BUCKET}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "   - Bucket gs://${RAONE_AI_BUCKET} already exists."
else
  gcloud storage buckets create "gs://${RAONE_AI_BUCKET}" \
    --project="${PROJECT_ID}" \
    --location="${BUCKET_REGION}" \
    --default-storage-class=STANDARD \
    --uniform-bucket-level-access \
    --public-access-prevention
  echo "   - Created gs://${RAONE_AI_BUCKET}"
fi

echo "==> Granting runtime SA bucket-scoped read/write access ONLY on gs://${RAONE_AI_BUCKET}..."
gcloud storage buckets add-iam-policy-binding "gs://${RAONE_AI_BUCKET}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/storage.objectUser" \
  --project="${PROJECT_ID}" >/dev/null

gcloud storage buckets add-iam-policy-binding "gs://${RAONE_AI_BUCKET}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/storage.legacyBucketReader" \
  --project="${PROJECT_ID}" >/dev/null

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
echo "✅ RaOne AI isolated infrastructure setup complete!"
echo "Isolated Resources in project ${PROJECT_ID}:"
echo "  - Hosting Site : https://${HOSTING_SITE}.web.app"
echo "  - Cloud Run    : ${CLOUD_RUN_SERVICE} (${REGION})"
echo "  - Firestore DB : ${FIRESTORE_DB} (Standard Native, ${REGION})"
echo "  - GCS Bucket   : gs://${RAONE_AI_BUCKET}"
echo "  (Sibling sites ravanatek.web.app & raone-suva-seva.web.app untouched)"
