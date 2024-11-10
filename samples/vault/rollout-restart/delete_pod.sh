#!/bin/bash

# If this is in vault-agent-init container then return
cat /home/vault/config.json | grep '"exit_after_auth":true'
[[ "$?" == "0" ]] && exit 0

# Get the pod name and namespace
POD_NAME=$(hostname)
NAMESPACE=$(cat /var/run/secrets/kubernetes.io/serviceaccount/namespace)

# Delete the pod by calling the Kubernetes API
curl -X DELETE \
  -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
  -H "Content-Type: application/json" \
  https://$KUBERNETES_SERVICE_HOST/api/v1/namespaces/$NAMESPACE/pods/$POD_NAME \
  --cacert /var/run/secrets/kubernetes.io/serviceaccount/ca.crt

# wget --header="Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
#      --header="Content-Type: application/json" \
#      --header="X-HTTP-Method-Override: DELETE" \
#      --header="X-HTTP-Method: DELETE" \
#      --post-file=/dev/null \
#      --no-check-certificate \
#      https://$KUBERNETES_SERVICE_HOST/api/v1/namespaces/$NAMESPACE/pods/$POD_NAME

