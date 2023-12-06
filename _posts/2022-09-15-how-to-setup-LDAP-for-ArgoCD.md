---
layout: post
title: How to Setup LDAP for ArgoCD
excerpt: Using dex and ldap for argocd
date: 2022-09-15
tags: [kubernetes, devops]
comments: true
---

We will use Dex to delegate authentication to an external LDAP provider.

## 1. Patch the configmap `argocd-cm` with LDAP settings

```bash
cat <<'EOF' | kubectl -n argocd patch cm argocd-cm --patch-file=/dev/stdin
apiVersion: v1
data:
  url: https://argocd.example.dev
  dex.config: |
    connectors:
    - type: ldap
      name: freeipa
      id: ldap
      config:
        host: "master.ipa.example.com:389"
        insecureNoSSL: true
        insecureSkipVerify: true
        bindDN: "$dex.ldap.bindDN"
        bindPW: "$dex.ldap.bindPW"
        usernamePrompt: Username
        userSearch:
          baseDN: "cn=users,cn=accounts,dc=ipa,dc=example,dc=com"
          filter: ""
          username: uid
          idAttr: uid
          emailAttr: mail
          nameAttr: displayName
        groupSearch:
          baseDN: "cn=groups,cn=accounts,dc=ipa,dc=example,dc=com"
          filter: "(objectClass=groupOfNames)"
          userAttr: DN
          groupAttr: member
          nameAttr: cn
EOF


# check the cm `argocd-cm`
kubectl get cm argocd-cm -n argocd -o yaml
```

> *NOTE: Variables dex.ldap.bindDN and dex.ldap.bindPW are defined in argocd-secret below.*

## 2. Patch the secret `argocd-secret`

```bash
cat <<'EOF' | kubectl -n argocd patch secret argocd-secret --patch-file=/dev/stdin
apiVersion: v1
kind: Secret
metadata:
  name: argocd-secret
  namespace: argocd
stringData:
  dex.ldap.bindDN: <uid=xxxxx,cn=users,cn=accounts,dc=ipa,dc=example,dc=com>
  dex.ldap.bindPW: <PASSWORD>
EOF
```

## 3. Restart the dex-server and argocd-server once the configmap and secret patched.

```bash
kubectl delete pod -l app.kubernetes.io/name: argocd-dex-server -n argocd
kubectl delete pod -l app.kubernetes.io/name: argocd-server -n argocd
```

## 4. Access the UI by clicking `LOG IN VIA FREEIPA`

![argocd](/images/argocd.png)

## 5. Configure RBAC for LDAP

ArgoCD has two pre-defined roles below.

- role: readonly - read-only access to all resources

- role: admin - unrestricted access to all resources

We will create groups `ops & dev` on LDAP, ops for admin and dev for readonly.

Now patch the cm `argocd-rbac-cm`.

```bash
cat <<"EOF" | kubectl -n argocd apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-rbac-cm
  namespace: argocd
data:
  policy.default: role:none
  scopes: '[groups, email]'
  policy.csv: |
    p, role:none, *, *, */*, deny
    g, dev, role:readonly
    g, ops, role:admin
EOF
```
