## Install reloader & demo secret

```bash
kubectl apply -f reloader.yaml

kubectl rollout status -f reloader.yaml

kubectl apply -f rbac.yaml -f vault-objects.yaml -f deployment.yaml
```

