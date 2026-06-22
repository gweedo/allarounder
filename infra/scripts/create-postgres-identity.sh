#!/usr/bin/env bash
# Run once after Bicep provisioning to grant the backend managed identity
# access to PostgreSQL. Requires an active Entra session with psql available.
#
# Usage:
#   ./infra/scripts/create-postgres-identity.sh staging allarounder-stg-pg-xxxxx
#
# Prerequisites:
#   - az login (logged in as an Entra admin on the PostgreSQL server)
#   - psql installed
#   - The backend managed identity already created by Bicep
#
# Notes:
#   - pgaadauth_create_principal_with_oid only exists in the 'postgres' db on
#     Azure Flexible Server — role creation must target that database.
#   - Grant statements must target the 'allarounder' application database.
#   - ENTRA_ADMIN must be the full Entra UPN, not the MSA email (#EXT# format
#     for external/personal accounts).

set -euo pipefail

ENV="${1:?Usage: $0 <env> <pg-server-name>}"
PG_SERVER="${2:?Usage: $0 <env> <pg-server-name>}"
RESOURCE_GROUP="allarounder-${ENV}"
BACKEND_IDENTITY_NAME="allarounder-${ENV}-backend-id"
DATABASE="allarounder"
FIREWALL_RULE_NAME="temp-local-setup-$(date +%s)"

echo "==> Detecting public IP and opening temporary firewall rule..."
MY_IP=$(curl -sf https://api.ipify.org)
echo "    Public IP: ${MY_IP}"
az postgres flexible-server firewall-rule create \
  --server-name "$PG_SERVER" \
  --resource-group "$RESOURCE_GROUP" \
  --name "$FIREWALL_RULE_NAME" \
  --start-ip-address "$MY_IP" \
  --end-ip-address "$MY_IP" \
  --output none

# Remove the firewall rule on exit, whether the script succeeds or fails
cleanup() {
  echo "==> Removing temporary firewall rule..."
  az postgres flexible-server firewall-rule delete \
    --server-name "$PG_SERVER" \
    --resource-group "$RESOURCE_GROUP" \
    --name "$FIREWALL_RULE_NAME" \
    --yes \
    --output none
  echo "    Firewall rule removed."
}
trap cleanup EXIT

echo "==> Fetching backend managed identity IDs..."
IDENTITY_CLIENT_ID=$(az identity show \
  --name "$BACKEND_IDENTITY_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "clientId" -o tsv)
IDENTITY_OBJECT_ID=$(az identity show \
  --name "$BACKEND_IDENTITY_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "principalId" -o tsv)

echo "    Client ID : ${IDENTITY_CLIENT_ID}"
echo "    Object ID : ${IDENTITY_OBJECT_ID}"

echo "==> Getting Entra access token for PostgreSQL..."
PG_TOKEN=$(az account get-access-token \
  --resource-type oss-rdbms \
  --query "accessToken" -o tsv)

PG_HOST="${PG_SERVER}.postgres.database.azure.com"
# Use the Entra UPN (not the MSA email) — external/MSA accounts have a #EXT# UPN
ENTRA_ADMIN=$(az ad signed-in-user show --query userPrincipalName -o tsv)

PSQL_BASE="PGPASSWORD=$PG_TOKEN PGSSLMODE=require psql --host=$PG_HOST --username=$ENTRA_ADMIN"

echo "==> Step 1/2: Creating PostgreSQL role for managed identity (must run against 'postgres' db)..."
PGPASSWORD="$PG_TOKEN" PGSSLMODE=require psql \
  --host="$PG_HOST" \
  --username="$ENTRA_ADMIN" \
  --dbname="postgres" \
  -c "DO \$\$ BEGIN PERFORM pg_catalog.pgaadauth_create_principal_with_oid('${BACKEND_IDENTITY_NAME}'::text, '${IDENTITY_OBJECT_ID}'::text, 'service'::text, false, false); EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'Role already exists, skipping.'; END \$\$;"

echo "==> Step 2/2: Granting privileges on the '${DATABASE}' database..."
PGPASSWORD="$PG_TOKEN" PGSSLMODE=require psql \
  --host="$PG_HOST" \
  --username="$ENTRA_ADMIN" \
  --dbname="$DATABASE" \
  <<SQL
GRANT ALL PRIVILEGES ON DATABASE "${DATABASE}" TO "${BACKEND_IDENTITY_NAME}";
-- PostgreSQL 15+ no longer grants CREATE on public schema to all users by default.
-- Explicit schema privileges are required so Alembic can create tables.
GRANT USAGE, CREATE ON SCHEMA public TO "${BACKEND_IDENTITY_NAME}";
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
