---
layout: post
title: 在Ingress里使用let's encrypt证书
excerpt: 使用cert-manager和kubernetes-replicator管理证书
date: 2022-09-17
tags: [kubernetes, ceph]
comments: true
---

使用cert-manager创建免费的证书，然后kubernetes-replicator将证书同步到所有命名空间。后面我们还会使用kubernetes-replicator来同步configmap与secret

## 一、安装cert-manager

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.9.1/cert-manager.yaml
```

## 二、安装kubernetes-repplicator

```bash
kubectl apply -f https://raw.githubusercontent.com/mittwald/kubernetes-replicator/master/deploy/rbac.yaml

kubectl apply -f https://raw.githubusercontent.com/mittwald/kubernetes-replicator/master/deploy/deployment.yaml
```

## 三、安装aliDNS的webhook

这里需要根据使用的DNS来安装相应的webhook，如cloudflare、route53等

```bash
kubectl apply -f https://raw.githubusercontent.com/pragkent/alidns-webhook/master/deploy/bundle.yaml
```

## 四、配置webhook密钥

通过阿里云RAM创建一个账号，并授权DNSFullAccess权限,并创建如下secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: alidns-secret
  namespace: cert-manager
stringData:
  access-key: <accessID>
  secret-key: <secretKey>
```

## 五、创建ClusterIssuer

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    email: developers@example.com
    server: https://acme-v02.api.letsencrypt.org/directory
    privateKeySecretRef:
      name: letsencrypt-prod-account-key
    solvers:
    - dns01:
        webhook:
          # 这个不要改
          groupName: acme.yourcompany.com
          solverName: alidns
          config:
            region: ""
            accessKeySecretRef:
              name: alidns-secret
              key: access-key
            secretKeySecretRef:
              name: alidns-secret
              key: secret-key
```

## 六、创建证书并同步到其他命名空间

在所有命名空间生成example-com证书，在ingress或者ingressroute里设置secretName: example-com使用

```bash
cat >> example.com.yaml <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: example-com
  namespace: cert-manager
spec:
  secretName: example-com
  commonName: example.com
  dnsNames:
  - example.com
  - "*.example.com"
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  secretTemplate:
    annotations:
      replicator.v1.mittwald.de/replicate-to: "*"
EOF
 
kubectl apply -f example.com.yaml
```

## 七、ingress里直接使用证书

我们既可以在ingress里使用上面生成的证书 `example-com`，也可以在ingress通过添加注解直接使用cert-manager生成证书（如下）

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  annotations:
    # 通过cert-manager直接生成证书
    cert-manager.io/cluster-issuer: letsencrypt-prod
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
    traefik.ingress.kubernetes.io/service.serversscheme: https
  name: rancher
  namespace: cattle-system
spec:
  rules:
  - host: rancher.example.com
    http:
      paths:
      - backend:
          serviceName: rancher
          servicePort: 443
        path: /
        pathType: Prefix
  tls:
  - hosts:
    - rancher.example.com
    secretName: rancher-letsencrypt
```
