---
layout: post
title: How to manually renew certificates of cert-manager
excerpt: Using kubectl patch to renew certs
date: 2025-04-26
tags: [kubernetes]
comments: true
---

Sometime you will need to renew your certificates which are created by cert-manager. This page describe two ways to renew certs manually.

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

## References

[[1](https://cert-manager.io/docs/reference/cmctl/#manual-installation)] The cert-manager Command Line Tool