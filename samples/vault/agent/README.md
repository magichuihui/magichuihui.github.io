# Integrate a Kubernetes cluster with an external Vault

## Prerequisites

* [kubernetes](https://kubernetes.io/docs/tasks/tools/install-kubectl/)
* [helm](https://github.com/helm/helm#install)
* [Vault](https://developer.hashicorp.com/vault/tutorials/getting-started/getting-started-install)

## Start Vault

Use this script to create a external vault server on a linux hosts.

```bash

vault server -dev -dev-root-token-id password -dev-listen-address 0.0.0.0:8200 > vault.log 2>&1 &

export VAULT_ADDR=http://0.0.0.0:8200

vault login password

vault kv put secret/devwebapp/config username='giraffe' password='salsa'
```

## Install the vault helm chart

1. Add Vault helm repo

```bash
helm repo add hashicorp https://helm.releases.hashicorp.com
```

2. Install the latest version of the Vault agent running in external mode.

```bash
helm install vault hashicorp/vault \
    --create-namespace --namespace vault
    --set "global.externalVaultAddr=${VAULT_ADDR}"
```

3. Create a long-lived token for vault serviceaccount.

```bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: vault-token-g955r
  namespace: vault
  annotations:
    kubernetes.io/service-account.name: vault
type: kubernetes.io/service-account-token
EOF
```

## Configure kubernetes auth method

1. Create ServiceAccount in default namespace

```bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: internal-app
  namespace: default
EOF

cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: internal-app2
  namespace: default
EOF
```

2. Create new kubernetes auth method

```bash
export VAULT_ADDR=http://0.0.0.0:8200
vault auth enable kubernetes

# token name of vault serviceaccount
VAULT_SECRET_NAME=$(kubectl get secrets -n vault --output=json | jq -r '.items[].metadata | select(.name|startswith("vault-token-")).name')

# token of vault serviceaccount
TOKEN_REVIEW_JWT=$(kubectl get secret $VAULT_SECRET_NAME -n vault --output='go-template={{ .data.token }}' | base64 --decode)

# ca cert of kubernetes cluster
KUBE_CA_CERT=$(kubectl config view --raw --minify --flatten --output='jsonpath={.clusters[].cluster.certificate-authority-data}' | base64 --decode)

# URL of kubernetes cluster
KUBE_HOST=$(kubectl config view --raw --minify --flatten --output='jsonpath={.clusters[].cluster.server}')

# Configure the Kubernetes authentication method to use the service account token and kubernetes host, etc.
vault write auth/kubernetes/config \
     token_reviewer_jwt="$TOKEN_REVIEW_JWT" \
     kubernetes_host="$KUBE_HOST" \
     kubernetes_ca_cert="$KUBE_CA_CERT" \
     issuer="https://kubernetes.default.svc.cluster.local"

# Create a vault policy
vault policy write devwebapp - <<EOF
path "secret/data/devwebapp/config" {
  capabilities = ["read"]
}
EOF

# Create two kubernetes authentication role.
vault write auth/kubernetes/role/devweb-app \
     bound_service_account_names=internal-app \
     bound_service_account_namespaces=default \
     policies=devwebapp \
     ttl=24h

vault write auth/kubernetes/role/devweb-app2 \
     bound_service_account_names=internal-app2 \
     bound_service_account_namespaces=default \
     policies=devwebapp \
     ttl=24h
```