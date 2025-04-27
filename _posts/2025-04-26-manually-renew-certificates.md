---
layout: post
title: How to manually renew certificates of cert-manager
excerpt: Using kubectl patch to renew certs
date: 2025-04-26
tags: [kubernetes]
comments: true
---

Sometime you will need to renew your certificates which are created by cert-manager. This page describe three ways to renew certs manually.

## 1. cmctl

You can manually trigger a reissuance for your certs, by the tools `cmctl` from cert-manager. First, install it according to the official document [[1](https://cert-manager.io/docs/reference/cmctl/#manual-installation)]

```bash
cmctl renew <your cert> -n <namespace>
```

## 2. Patch `renewBefore`

By patching the `renewBefore` field of the certs to 1440h(2 month) with `kubectl patch`, can also trigger a renew.

```bash
kubectl patch certificate <your cert> --type json -p '[{"op": "replace", "path": "/spec/renewBefore", "value": "1440h"}]'
```

After the Cert get renewed, you need to remove the `renewBefore` field.

```bash
kubectl patch certificate <your cert> --type json -p '[{"op": "remove", "path": "/spec/renewBefore"}]'
```

## 3. Use `curl` to call apiserver

You can also use `curl` to patch the status of the cert, to add a new condition with type `Issuing`, Just like the `cmctl renew` does.

If you want to renew your certs in a pod, you must make sure the service account has the permission to patch certificates. Or you can just use the kubernetes-admin user in the kubeconfig.

```bash
NAMESPACE=your-namespace
CERT_NAME=cert-name
CLIENT_CERT=cert.crt
CLIENT_KEY=key.crt
CA_CERT=ca.crt

APISERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')

# Get cert and key
kubectl config view --minify --raw -o jsonpath='{.users[0].user.client-certificate-data}' | base64 -d > $CLIENT_CERT
kubectl config view --minify --raw -o jsonpath='{.users[0].user.client-key-data}' | base64 -d > $CLIENT_KEY
# Get CA
kubectl config view --minify --raw -o jsonpath='{.clusters[0].cluster.certificate-authority-data}' | base64 -d > $CA_CERT

# Set the last transition time to the current time
LAST_TRANSITION_TIME=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
# Fetch generation from the certificate
OBSERVED_GENERATION=$(curl -s \
  --cert "$CLIENT_CERT" \
  --key "$CLIENT_KEY" \
  --cacert "$CA_CERT" \
  "$APISERVER/apis/cert-manager.io/v1/namespaces/$NAMESPACE/certificates/$CERT_NAME" | \
  jq -r '.metadata.generation')

# Patch status of the certificate by adding an Issuing condition.
curl -X PATCH "$APISERVER/apis/cert-manager.io/v1/namespaces/$NAMESPACE/certificates/$CERT_NAME/status" \
  --cert "$CLIENT_CERT" \
  --key "$CLIENT_KEY" \
  --cacert "$CA_CERT" \
  -H "Content-Type: application/json-patch+json" \
  -d @- <<EOF
[
{
  "op": "add",
  "path": "/status/conditions/-",
  "value": {
    "type": "Issuing",
    "status": "True",
    "reason": "ManualTrigger",
    "message": "Certificate renewal manually triggered",
    "observedGeneration": $OBSERVED_GENERATION,
    "lastTransitionTime": "$LAST_TRANSITION_TIME"
  }
}
]
EOF
  
```

This might be the better way if you don't want to install `cmctl`.

## References

[[1](https://cert-manager.io/docs/reference/cmctl/#manual-installation)] The cert-manager Command Line Tool
