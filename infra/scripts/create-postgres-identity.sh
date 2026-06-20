#!/usr/bin/env bash
# Run once after Bicep provisioning to grant the backend managed identity
# access to PostgreSQL. Requires an active Entra session with psql available.
#
# Usage:
#   ./infra/scripts/create-postgres-identity.sh staging allarounder-stg-pg-xxxxx
#
# Prerequisites:
#   - az login (logged in as the Entra PostgreSQL admin)
#   - psql installed
#   - The backend managed identity already created by Bicep

set -euo pipefail

ENV="${1:?Usage: $0 <env> <pg-server-name>}"
PG_SERVER="${2:?Usage: $0 <env> <pg-server-name>}"
RESOURCE_GROUP="allarounder-${ENV}"
BACKEND_IDENTITY_NAME="allarounder-${ENV}-backend-id"
DATABASE="allarounder"

echo "==> Fetching backend managed identity client ID..."
IDENTITY_CLIENT_ID=$(az identity show \
  --name "$BACKEND_IDENTITY_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "clientId" -o tsv)

echo "    Client ID: ${IDENTITY_CLIENT_ID}"

echo "==> Getting Entra access token for PostgreSQL..."
PG_TOKEN=$(az account get-access-token \
  --resource-type oss-rdbms \
  --query "accessToken" -o tsv)

PG_HOST="${PG_SERVER}.postgres.database.azure.com"
ENTRA_ADMIN=$(az account show --query "user.name" -o tsv)

echo "==> Creating PostgreSQL role for managed identity..."
PGPASSWORD="$PG_TOKEN" psql \
  --host="$PG_HOST" \
  --username="$ENTRA_ADMIN" \
  --dbname="$DATABASE" \
  --set=sslmode=require \
  <<SQL
-- Create the managed identity as a PostgreSQL role via Entra extension
SELECT * FROM pgaad_admin.create_aad_user(
  '${BACKEND_IDENTITY_NAME}',
  '${IDENTITY_CLIENT_ID}'
);

-- Grant access to the database
GRANT ALL PRIVILEGES ON DATABASE "${DATABASE}" TO "${BACKEND_IDENTITY_NAME}";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${BACKEND_IDENTITY_NAME}";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${BACKEND_IDENTITY_NAME}";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO "${BACKEND_IDENTITY_NAME}";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO "${BACKEND_IDENTITY_NAME}";
SQL

echo "==> Done. Backend identity '${BACKEND_IDENTITY_NAME}' can now connect to PostgreSQL."
echo ""
echo "    The DATABASE_URL for the backend Container App should be:"
echo "    postgresql+psycopg://${BACKEND_IDENTITY_NAME}@${PG_HOST}/${DATABASE}?sslmode=require"
