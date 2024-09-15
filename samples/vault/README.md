# Integrate vault with Kubernetes

You can use three ways to integrate vault to your kubernetes clusters, vault-agent, vault secrets operator and external-secretes-operator.

## Launch a new Vault server

First you need a accessible Vault server, you can use the shell script to launch a new DEV vault server which will listen at `0.0.0.0:8200`, you should change the IP addresses in this script to fit your own server.

```bash
./setup.sh
```

## Authentication Method

If you want to use a Long-lived token for authenticating with kubernetes TokenReview API, you will need to provide the `token_review_jwt` property in the `setup.sh` script.

Create a secret that bind to a service account then you will get the long-lived token of that service account.

```bash
kubectl apply -f sa-token-reviewer.yaml
```

Then you need decode this token with base64.