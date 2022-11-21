---
layout: post
title: 通过ingress-nginx反向代理外部域名
excerpt: use ingress as reverse proxy for freeipa
date: 2022-11-14
tags: [kubernetes, LDAP]
comments: true
---

Sometimes there are applications that can't or won't migrate to kubernetes, but we still want to manage their domains in kubernetes.

Now I will use ingress-nginx to proxy FreeIPA's external domain `main.ipa.example.com`, which use a private SSL certificate.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/server-snippet: |
      if ($request_uri ~* "^/$") { rewrite .* /ipa/ui;}
      location ^~ "/ipa" {
        proxy_pass https://main.ipa.example.com;
        proxy_cookie_domain main.ipa.example.com ipa.example.dev;
        proxy_set_header Referer https://main.ipa.example.com/ipa/ui;
        proxy_ssl_name main.ipa.example.com;
        proxy_ssl_server_name on;
      }
  labels:
    app.example.dev/ingress: freeipa
  name: freeipa
  namespace: devops
spec:
  ingressClassName: nginx
  rules:
  - host: ipa.example.dev
  tls:
  - hosts:
    - ipa.example.dev
    secretName: example-dev
```