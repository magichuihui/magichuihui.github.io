---
layout: post
title: How to restart pod after vault secrets get rotated
excerpt: Rolling restart deployments after you rotate the vault secrets
date: 2024-11-09
tags: [kubernetes, vault]
comments: true
---

## 1. Background

When you store secrets in Vault Server, you can retrieve and refresh these secrets directly from the Vault API. But what happens if you can't or don't want to integrate the vault library in your applications. After going through this page, you will be able to restart your applications in servaral ways after the secrets from Vault get updated. The discussion will start with three aspects: vault-agent-injector, Vault Secrets Operator and [Reloader](https://github.com/stakater/Reloader).

All demos located in [samples/vault/rollout-restart](samples/vault/rollout-restart).

## 2. Vault agent injector


### 2.1 Create a demo application

This post uses a demo application that retrieve secrets from an external vault server. And also if you want these secrets get refreshed, both vault agent init container and sidecar are required to be injected to your pod.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vault-test
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: vault-test
  template:
    metadata:
      labels:
        app.kubernetes.io/name: vault-test
      annotations:
        vault.hashicorp.com/agent-inject: 'true'
        vault.hashicorp.com/auth-path: "auth/kubernetes"
        vault.hashicorp.com/role: 'devweb-app'
        vault.hashicorp.com/agent-inject-secret-credentials.txt: 'kvv2/secret'
        vault.hashicorp.com/secret-volume-path-credentials.txt: '/tmp'
        vault.hashicorp.com/secret-volume-path-delete-pod.sh: "/opt"
        vault.hashicorp.com/template-static-secret-render-interval: "5m"
    spec:
      serviceAccountName: internal-app
      containers:
      - name: alpine
        image: alpine
        command: ["sh", "-c", "while true; do sleep 20; cat /tmp/credentials.txt; done"]
        resources:
          requests:
            cpu: 100m
            memory: 100Mi
          limits:
            cpu: 100m
            memory: 100Mi
```

Now the secrets in containers can be refreshed within 5 minutes which is set by annotation `vault.hashicorp.com/template-static-secret-render-interval`.

### 2.2 Restart application when secrets rotate

What happens when you update or rotate the vault secrets, even if the credentials file can get updated in pods but your application still don't notice that change. Therefore, you need an approach to trigger the application to reload these new credentials.

To achieve this, you can use the annotation `vault.hashicorp.com/agent-inject-command` provided by Vault Agent, which executes a command each time the secrets template gets re-rendered. It is important to note that you need to skip this command when rendering the secrets template first time in vault agent init container. Here is the code:

```yaml
        vault.hashicorp.com/agent-cache-enable: "true"
        vault.hashicorp.com/agent-image: magichuihui/vault:1.17.2
        vault.hashicorp.com/agent-inject-secret-credentials.txt: 'kvv2/secret'
        vault.hashicorp.com/secret-volume-path-credentials.txt: '/tmp'
        vault.hashicorp.com/secret-volume-path-delete-pod.sh: "/opt"
        vault.hashicorp.com/agent-inject-command-credentials.txt: |
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
        vault.hashicorp.com/template-static-secret-render-interval: "5m"
```

You can use this command which will delete the current pod by calling the kubernetes API directly, of course there are other ways to restart pod, such as patching Deployment with annotations(*this is what VSO will do*), executing `kill -TERM` or `kubectl rollout restart` and so on.

**PS**: The Service Account `internal-app` will need the privilege of deleting pods here.

## 3. Vault Secrets Operator

When you use Vault Secrets Operator(VSO), VSO can trigger the restarting natively when secrets get updated. By Setting `rolloutRestartTargets` for `VaultStaticSecret`, the deployment will be restart within 1m(`refreshAfter: 1m`) if any changes of secrets.

```yaml
---
apiVersion: secrets.hashicorp.com/v1beta1
kind: VaultStaticSecret
metadata:
  namespace: tenant-1
  name: vaultstaticsecret-sample
spec:
  vaultAuthRef: vaultauth-sample
  mount: kvv2
  type: kv-v2
  path: secret2
  refreshAfter: 1m
  destination:
    name: secret2
    overwrite: true
    create: true
  rolloutRestartTargets:
  - kind: Deployment
    name: vault-test
```

## 4. Reloader

[Reloader](https://github.com/stakater/Reloader) is a Kubernetes controller to watch changes in ConfigMap and Secrets and do rolling upgrades on Pods. It's a more common way not only used for Vault Secrets.

There are several reload strategies implemented by Reloader, here is a demo of setting annotation on Deployment to watch changes from specified Kubernetes Secrets.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vault-test
  namespace: tenant-1
  annotations:
    secret.reloader.stakater.com/reload: "secret2"
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: vault-test
  template:
    metadata:
      labels:
        app.kubernetes.io/name: vault-test
    spec:
      containers:
      - name: nginx
        image: nginx
        volumeMounts:
        - name: secrets
          mountPath: "/etc/secrets"
          readOnly: true
        resources:
          limits:
            cpu: 100m
            memory: 100Mi          
      volumes:
      - name: secrets
        secret:
          secretName: secret2
          optional: false
```

The restart interval depends on when the secrets change.