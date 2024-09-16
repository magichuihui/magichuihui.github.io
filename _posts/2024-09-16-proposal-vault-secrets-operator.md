---
layout: post
title: Adopt Vault Secrets Operator for Secret Management
excerpt: Vault agent, Vault Secrets Operator and External Secrets Operator
date: 2024-09-16
tags: [kubernetes]
comments: true
---

## Background

Our company needs to integrate Vault with GCP to manage secrets across all environments. Initially, Vault Agent was considered, but some limitations of vault agent make Vault Secrets Operator(VSO) or External Secrets Operator(ESO) may be a more efficient solution. Below is a comparison for adopting VSO over Vault Agent, ESO almost the same.

## Limitations of Vault Agent

- **Global Configuration Impact**: Integrating Vault Agent across environments requires modifying Pod configurations such as annotations and environment variables. In our current infrastructure setup, any changes made for the DEV environment could inadvertently affect other environments. While migrating to tools like Helm or Kustomize would mitigate this, the transition will take time. VSO can seamlessly integrate with our application without impacting the existing Pod configurations, as it retrieves secrets and transforms them into Kubernetes secrets.

- **Service Account Conflict**: Vault Agent requires assigning a Kubernetes Service Account to each Pod for authentication with Vault. However, many of our applications already use k8s service account for GCP project integration, and adding permissions for Vault would require expanding the privileges of these service accounts. This expansion violates the Principle of Least Privilege, increasing the security risks. VSO, on the other hand, manages the secrets at the Kubernetes level without needing to modify existing service account or assign additional privileges.

- **Connection Overhead**: Each Pod using Vault Agent establishes a direct connection with the Vault server. If multiple Pods retrieve and periodically refresh secrets, this can lead to a large number of connections between GKE and Vault, potentially causing network bottlenecks and increasing latency. VSO minimizes this overhead by syncing secrets with Kubernetes only in the operator pod, reducing the number of direct connections to Vault and simplifying the secret management process.

## Benefits of Vault Secrets Operator

- **Kubernetes Native Integration**: VSO integrates natively with Kubernetes by syncing secrets from Vault into Kubernetes secrets. This enables applications to access secrets using standard Kubernetes mechanisms, eliminating the need for sidecars or additional Pods.

- **Reduced Complexity**: VSO does not require any changes to existing Pod configurations or service accounts. It operates independently, fetching secrets and injecting them into Kubernetes, which simplifies the deployment and operational burden.

- **Security Alignment**: VSO adheres to the Principle of Least Privilege by allowing fine-grained control over Vault roles and access policies without impacting existing kubernetes service accounts. This reduces the security risks associated with over-privileged service accounts.

- **Improved Performance**: By reducing the need for each Pod to establish a direct connection with Vault, VSO lowers network and latency overhead. Secrets are periodically refreshed and maintained at the Kubernetes level, minimizing operational overhead and improving application performance.

## Disadvantage of Vault Secrets Operator

- **Secrets Visibility**: With VSO, secrets retrieved from Vault are stored as Kubernetes secrets. This means they can be accessed outside of the container, potentially being exposed in external systems like etcd. By contrast, Vault Agent keeps secrets more isolated, only exposing them inside the running container, minimizing the risk of broader access.

## Key differences between ESO and VSO

- ESO support GCP Secret Manager, AWS Secret Manager and Vault, also other backend systems.
- ESO is a third-party CNCF project, which is not ready for GA at presents, although it's API of GCP and vault is stable.

## Conclusion

Given the operational complexities, security concerns, and connection overhead with Vault Agent, i think adopting Vault Secrets Operator for secret management in GCP is worth to try. If we need to use both GCP Secret manager and Vault ESO will also be a good choice.