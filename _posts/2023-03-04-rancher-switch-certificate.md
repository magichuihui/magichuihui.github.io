---
layout: post
title: Switch from Private CA to let's encrypt for Rancher
excerpt: rancher with let's encrypt
date: 2023-03-04
tags: [kubernetes, rancher]
comments: true
---

# Updating from a Private CA Certificate to a Common Certificate

We can change from a private certificate to `Let's encrypt` certificate. The steps involved are outlined below.

## 1. Create/update the certificate secret resource

We will use kubenetes-replicator to get replicas of the secret

```bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: tls-rancher-ingress
  namespace: cattle-system
  annotations:
    replicator.v1.mittwald.de/replicate-from: default/navatics-dev
data: {}
```

## 2. Delete the CA certificate secret resource

We will delete the `tls-ca` secret in the `cattle-system` namespace as it is no longer needed. We can also optionally save a copy of the `tls-ca` secret if desired.

To save the existing secret.

```bash
kubectl -n cattle-system get secret tls-ca -o yaml > tls-ca.yaml
```

To delete the existing `tls-ca` secret.

```bash
kubectl -n cattle-system delete secret tls-ca
```

## 3. Reconfigure the Rancher deployment

```bash
helm upgrade rancher rancher-stable/rancher -n cattle-system \
    --set hostname=rancher.navatics.dev \
    --set ingress.tls.source=secret \
    --set privateCA=false
```