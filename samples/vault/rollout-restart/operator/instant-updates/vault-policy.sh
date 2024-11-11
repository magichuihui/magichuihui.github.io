#!/bin/bash

export VAULT_ADDR=http://127.0.0.1:8200

cat <<EOT > /tmp/instant-updates.hcl
path "kvv2/*" {
  capabilities = ["read", "subscribe"]
  subscribe_event_types = ["*"]
}

path "sys/events/subscribe/kv*" {
  capabilities = ["read"]
}
EOT
vault policy write instant-updates /tmp/instant-updates.hcl

vault write auth/kubernetes/role/instant-updates \
    bound_service_account_names=default \
    bound_service_account_namespaces=tenant-1 \
    policies=instant-updates \
    ttl=1h