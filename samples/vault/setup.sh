#!/bin/bash

vault server -dev -log-level=debug -dev-root-token-id password -dev-listen-address 0.0.0.0:8200 > vault.log 2>&1 &

echo "sleep 10"
sleep 10

export VAULT_ADDR=http://0.0.0.0:8200

vault login password

vault kv put secret/devwebapp/config username='giraffe' password='salsa'

vault secrets disable kvv2/
vault secrets enable -path=kvv2 kv-v2
vault kv put kvv2/secret username="db-readonly-username" password="db-secret-password"
vault kv put kvv2/secret2 username="user2" password="password" host="192.168.1.2:3306"

vault secrets disable kvv1/
vault secrets enable -path=kvv1 -version=1 kv
vault kv put kvv1/secret username="v1-user" password="v1-password"
vault kv put kvv1/secret2 username="user1" password="password" host="127.0.0.1:3306"


vault secrets disable pki
vault secrets enable pki
vault write pki/root/generate/internal \
    common_name=amyinfo.com \
    ttl=768h
vault write pki/config/urls \
    issuing_certificates="http://192.168.1.2:8200/v1/pki/ca" \
    crl_distribution_points="http://192.168.1.2:8200/v1/pki/crl"
vault write pki/roles/default \
    allowed_domains=amyinfo.com \
    allowed_domains=localhost \
    allow_subdomains=true \
    max_ttl=72h

cat <<EOT > /tmp/policy.hcl
path "kvv2/*" {
  capabilities = ["read"]
}
path "kvv1/*" {
  capabilities = ["read"]
}
path "pki/*" {
  capabilities = ["read", "create", "update"]
}
EOT
vault policy write demo /tmp/policy.hcl

# setup the necessary auth backend
    # token_review_jwt="eyJhbGciOiJSUzI1NiIsImtpZCI6IlNibVZpNzdQejBnZ0daNDFfQUZHWmtDRzI5WDl6dkpZMVlQVUpHSmlIVmcifQ.eyJpc3MiOiJrdWJlcm5ldGVzL3NlcnZpY2VhY2NvdW50Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9uYW1lc3BhY2UiOiJkZWZhdWx0Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9zZWNyZXQubmFtZSI6InZhdWx0LXRva2VuLWFiY2RlMSIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VydmljZS1hY2NvdW50Lm5hbWUiOiJ0b2tlbi1yZXZpZXdlciIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VydmljZS1hY2NvdW50LnVpZCI6IjkxMWM2ZGVjLWRkYmUtNDlmNi1iY2ZiLTQ1ZTU1ZGJiZDgwMiIsInN1YiI6InN5c3RlbTpzZXJ2aWNlYWNjb3VudDpkZWZhdWx0OnRva2VuLXJldmlld2VyIn0.CXUacAnGuTI2Nu2yXxDRUwuYgOHJZ9NUoIN-UsDOurd6QlmeQAzu-PYVOLlJe9ZhpZldfQqC7vphDZRJ7EOoyPCp5en5CAEAiZ_C-mYP4ADqrk0YWc-S0W4gBRdZ7qUl89QZZ5Wg2JkKDwAoKBfj3RSMey_DVGHakyJ9yP0nkAZXQks-eAfiMDDHJ6yfdwiVRwlNdHaw2sJQ0LtRPpPQ09UntH6cqtRk1CjtTw3MOzgsh1QCwc1lC803ug0iHokgZRnCWVoz_4aN94PwMTfkTqox5k7Exs5XuOvMfbl9C7RKNu4twL6yxmkfCd9bLsgeuF6GGxh2RNistgzcNt0GQw" \

vault auth disable kubernetes
vault auth enable kubernetes
vault write auth/kubernetes/config \
    kubernetes_host=https://127.0.0.1:6443 \
    token_review_jwt="eyJhbGciOiJSUzI1NiIsImtpZCI6IlNibVZpNzdQejBnZ0daNDFfQUZHWmtDRzI5WDl6dkpZMVlQVUpHSmlIVmcifQ.eyJpc3MiOiJrdWJlcm5ldGVzL3NlcnZpY2VhY2NvdW50Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9uYW1lc3BhY2UiOiJkZWZhdWx0Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9zZWNyZXQubmFtZSI6InZhdWx0LXRva2VuLWFiY2RlMSIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VydmljZS1hY2NvdW50Lm5hbWUiOiJ0b2tlbi1yZXZpZXdlciIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VydmljZS1hY2NvdW50LnVpZCI6Ijc0ZjMxMDdkLTYxYTAtNDQzNC05OWJiLTAxZTUzNDBlMTBkMSIsInN1YiI6InN5c3RlbTpzZXJ2aWNlYWNjb3VudDpkZWZhdWx0OnRva2VuLXJldmlld2VyIn0.Np7J3Ws5uGOYIbg6TELu8RSpIJB9FY3r6syJVn5IEdcCcmm3CbHMZVjLc4s_2HeCMG5tkOvQdzNpoib1ldOkYSJRiGn1c5yvSYEzbd4R00UaEmY-WlY67i0OjHicc1uLDfmouxnrmaJSveoYK3UkyiycSW_ylqK3KxRgRLmhQplTYxGxtiJ3xOwSSYyDzvdRVi5morZjBsSbF0Bo0EDlGIyBcCiTVRfZpAPJnVOuVe95KY_BOo2_iBvV_GhSOYjVCVnNXpZbT_E-7wbTWKcPMlfHbgNNPnF5RscGF_A1d6q_1C-tUgPHRAPSyNDv_wewzClfrbdHs-xwi08vgNJqNQ" \
    issuer="https://kubernetes.default.svc.cluster.local" \
    kubernetes_ca_cert="-----BEGIN CERTIFICATE-----
MIIDBTCCAe2gAwIBAgIIOZOgY2eeDWcwDQYJKoZIhvcNAQELBQAwFTETMBEGA1UE
AxMKa3ViZXJuZXRlczAeFw0yNDA1MjgwNzI1MjVaFw0zNDA1MjYwNzMwMjVaMBUx
EzARBgNVBAMTCmt1YmVybmV0ZXMwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEK
AoIBAQC92ut22ksEklXm6q2xn5Vq2b1ZZZb3S1cSd4XKeTI3cVtw1CQbra7K9HZr
WgNiU9iGDCeNRP2AK0MoH1+cAklSELuJBaFVPtQIuKvJGlpLOn9M7J1OF90pzEfC
CNDs1AiBjbCWUSVnqzkHV5nuqH86p9btrSSBktbIQf357v5Wwg/284t7Y9oDkGp7
r/JFHDAJj2U1VsVXTzw16IcfpncXEYjPoaV7/OYRuqSXz7uRT6zIQoXzKD2LuR/m
bjqZgB2gP6qSNP6tm75O9VHsBv9ggdnCsT3alDjk1R6oHEPLH/lTsABqSLXW4grf
+TZW6CfdMSbmMAbzGS94T9CywWSPAgMBAAGjWTBXMA4GA1UdDwEB/wQEAwICpDAP
BgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBRn4eJSuxTPP1z8yVjkErqw4cSgxjAV
BgNVHREEDjAMggprdWJlcm5ldGVzMA0GCSqGSIb3DQEBCwUAA4IBAQBi4rWGQjHK
6NllYafJkWHZCEbI1fHAFHMTXXwS7vLAouxTDc3mSzHbwl0a0RtXRfLTUgWL065e
BgHs9oxHWnFBt5cpIjY0ez9J1KX+zvNVpFIOhM69mAiNnD/j659S5Ky01V/HHnyT
Ug0piRPeZYkXXyKHPgzMupCJ39RBuACv9p6bBx02y+QfERpE/ZwktHPxVR5opnxK
ft13YwcRFp5bnK/Xt8QA9VP1CC3ESd4uzB1f8jh7nPZxHc6KIBBeOzvWGkl3SSRi
LeyOhzBf+nnGDMf4I0k69qwssB1/nOpxSVK2FdnNssbTJv0EhGAeA6XPaIao39pe
r5B2NaahmMDz
-----END CERTIFICATE-----
"
vault write auth/kubernetes/role/demo \
    bound_service_account_names=default,eso \
    bound_service_account_namespaces=tenant-1,tenant-2 \
    policies=demo \
    ttl=1h

vault write auth/kubernetes/role/external-secrets \
    bound_service_account_names=external-secrets \
    bound_service_account_namespaces=external-secrets \
    policies=demo \
    ttl=1h

for ns in tenant-{1,2} ; do
    kubectl delete namespace --wait --timeout=30s "${ns}" &> /dev/null || true
    kubectl create namespace "${ns}"
done

vault audit enable file file_path=./vault-audit.log