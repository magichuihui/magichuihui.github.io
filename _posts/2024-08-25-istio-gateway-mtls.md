---
layout: post
title: Istio gateway with mtls
date: 2024-08-25
tags: [kubernetes]
comments: true
---

This page will introduce how to use mtls with istio gateway.

## 1. Deploy a nginx application

First, deploy a simple Nginx pod and its Service:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx
  labels:
    app: nginx
spec:
  ports:
  - port: 80
    targetPort: 80
  selector:
    app: nginx
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.23
        ports:
        - containerPort: 80
```

Save this file to `nginx.yaml` and apply it to kubernetes cluster.

```bash
kubectl apply -f nginx.yaml
```

## 2. Create Istio Gateway and VirtualService

Next, we create Istio Gateway and VirtualService to expose the Nginx service, while enabling mTLS.

```yaml
apiVersion: networking.istio.io/v1
kind: Gateway
metadata:
  name: mtls-sample
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: MUTUAL
      credentialName: nginx-mtls
    hosts:
    - "nginx-sample.amyinfo.com"
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: nginx-sample
spec:
  hosts:
  - "nginx-sample.amyinfo.com"
  gateways:
  - mtls-sample
  http:
  - route:
    - destination:
        host: nginx
        port:
          number: 80
```

Apply this YAML file to cluster.

```bash
kubectl apply -f nginx-gateway.yaml
```

## 3. Create Kubernetes Secret

To enable mTLS, we need to create a Kubernetes Secret that contains the certificates and keys for both the server and the client.
First, generate a self-signed CA, server certificate and key, Client certificate and key using openssl :

```bash
openssl req -x509 -newkey rsa:4096 -keyout ca-key.pem -out ca-cert.pem -days 365 -nodes -subj "/CN=amyinfo.com"

# Generate server certificate and key
openssl req -newkey rsa:4096 -keyout server-key.pem -out server-req.pem -nodes -subj "/CN=nginx-sample.amytin.com"
openssl x509 -req -in server-req.pem -CA ca-cert.pem -CAkey ca-key.pem -set_serial 01 -out server-cert.pem -days 365

# Generate client certificate and key
openssl req -newkey rsa:4096 -keyout client-key.pem -out client-req.pem -nodes -subj "/CN=client"
openssl x509 -req -in client-req.pem -CA ca-cert.pem -CAkey ca-key.pem -set_serial 01 -out client-cert.pem -days 365
```

Then create the server certificate and key as Kubernetes Secret:

```bash
kubectl create -n istio-system secret generic nginx-mtls \
  --from-file=tls.key=server-key.pem \
  --from-file=tls.crt=server-cert.pem \
  --from-file=ca.crt=ca-cert.pem
```

## 4. Test with curl

Pass the Client certificate and key to curl to test mTLS:

```bash
curl --cacert ca-cert.pem \
    --cert client-cert.pem \
    --key client-key.pem https://nginx-sample.amyinfo.com
```

## 5. Q & A

### 5.1 iptables problem on Fedora

> Command error output: xtables parameter problem: iptables-restore: unable to initialize table 'nat'
Error occurred at line: 1
>
> Try `iptables-restore -h' or 'iptables-restore --help' for more information.

Istio use iptables to intercept traffic by adding nat rules. So all Linux hosts should enable `netfilter` linux kernel modules by running the below command.

```bash
 modprobe br_netfilter; 
 modprobe nf_nat; 
 modprobe xt_REDIRECT; 
 modprobe xt_owner;
 modprobe iptable_nat; 
 modprobe iptable_mangle; 
 modprobe iptable_filter;
 ```

 Or make it persistent.

 ```bash
cat >> /etc/modules-load.d/istio-iptables.conf <<"EOF"
br_netfilter
nf_nat
xt_REDIRECT
xt_owner
iptable_nat
iptable_mangle
iptable_filter
EOF
```