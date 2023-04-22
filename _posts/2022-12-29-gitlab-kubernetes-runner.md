---
layout: post
title: Gitlab kubernetes runner
excerpt: gitlab ci/cd with kubernetes runner
date: 2022-12-29
tags: [gitlab, kubernetes]
comments: true
---

# Using runner to deploy apps to kubernetes

In the deploy stage of pipeline, kubernetes runner will launch a pod with kubectlcli which can be used to update images of deployment. 

Here is the sample project, and part of .gitlab-ci.yaml

```yaml
deploy:
  stage: production
  tags:
    - kubectl
  when: manual
  allow_failure: false
  image: bitnami/kubectl
  variables:
    DEPLOYMENT: dear-bot-test-project
    CONTAINER: dear-bot-test-project 
    NAMESPACE: devops
  script:
    - kubectl config get-contexts
    - kubectl --context=local set image deployment/$DEPLOYMENT \
        $CONTAINER=$TARGET_IMAGE:$CI_PIPELINE_ID -n $NAMESPACE
```

# Installing GitLab Runner using the Helm Chart

Add the GitLab Helm repository:

```bash
helm repo add gitlab https://charts.gitlab.io
```

Then run the following to install the runner:

```bash
kubectl create ns devops

# For Helm 3
helm install --namespace devops gitlab-runner -f values.yaml gitlab/gitlab-runner
```

## Configuring GitLab Runner via values.yaml

Create a values.yaml file for your GitLab Runner configuration. The final version of our values.yaml is at the end of this article.

## Enable RBAC

To have the chart create the service account for you, set rbac.create to true:

```yaml
rbac: 
  create: true
```

## Using an image from a private registry for runner

first create a docker registry secret for runner

```bash
kubectl create secret docker-registry registry-example \
  --namespace devops \
  --docker-server="https://<REGISTRY_SERVER>" \
  --docker-username="<REGISTRY_USERNAME>" \
  --docker-password="<REGISTRY_PASSWORD>"
```

configure runners.imagePullSecrets in values.yaml

```yaml
runners:
  imagePullSecrets:
    - registry-example
```

## Providing a custom certificate for accessing GitLab

our GitLab used a self-signed certificate, so we have to provide the CA for gitlab runners.

```yaml
apiVersion: v1
data:
  code.example.dev.crt: <ca-for-example-dev>
kind: Secret
metadata:
  name: gitlab-domain-cert
  namespace: devops
```

then we need to provide the secret’s name to the GitLab Runner chart.
Add the following to your `values.yaml`:

```yaml
certsSecretName: gitlab-domain-cert
```

## Store registration tokens in secrets

To register a new runner, we have to specify `runnerRegistrationToken` in `values.yml`.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: gitlab-runner-secret
  namespace: devops
type: Opaque
data:
  runner-registration-token: "ZFdWS19XOFZxMWpIbkhrejV1eU0K" # base64 encoded
  runner-token: ""
```

the values.yaml

```yaml
runners:
  secret: gitlab-runner-secret
```
## Mount kubeconfig as secret volume

we need to inject the kubeconfig files to runners for kubectl

```bash
# create secrets kubeconfigs using the file kubeconfigs
kubectl create secret generic kubeconfigs \
  --namespace devops \
  --from-file=<path-to-kubeconfigs>
```

```yaml
runners:
  config: |
    [[runners]]
      [runners.kubernetes]
        namespace = "{{.Release.Namespace}}"
        image = "ubuntu:16.04"
        [[runners.kubernetes.volumes.secret]]
          name = "kubeconfigs"
          mount_path = "/.kube"
          read_only = false
          [runners.kubernetes.volumes.secret.items]
            "kubeconfigs" = "config"
```

# Final values.yaml

```yaml
image:
  registry: registry.gitlab.com
  image: gitlab-org/gitlab-runner
  # tag: alpine-v11.6.0
imagePullPolicy: IfNotPresent
imagePullSecrets:
  - registry-example
gitlabUrl: https://code.example.dev
certsSecretName: gitlab-domain-cert
rbac:
  create: true
  rules:
  - resources: ["configmaps", "pods", "pods/attach", "secrets", "services"]
    verbs: ["get", "list", "watch", "create", "patch", "update", "delete"]
  - apiGroups: [""]
    resources: ["pods/exec"]
    verbs: ["create", "patch", "delete"]
  clusterWideAccess: false
  podSecurityPolicy:
    enabled: false
    resourceNames:
    - gitlab-runner
metrics:
  enabled: true
  portName: metrics
  port: 9252
  serviceMonitor:
    enabled: false
service:
  enabled: true
  type: ClusterIP
runners:
  imagePullSecrets:
    - registry-example
  config: |
    [[runners]]
      [runners.kubernetes]
        namespace = "{{.Release.Namespace}}"
        image = "ubuntu:16.04"
        [[runners.kubernetes.volumes.secret]]
          name = "kubeconfigs"
          mount_path = "/.kube"
          read_only = false
          [runners.kubernetes.volumes.secret.items]
            "kubeconfigs" = "config"
  tags: "kubectl"
  name: "kubernetes"
  runUntagged: false
  secret: gitlab-runner-secret
```
