---
layout: post
title: Useful scripts for managing kubernetes
date: 2023-07-24
tags: [kubernetes]
comments: true
---

# Clean up unused resources

## Clean up replicasets

Remove replicasets from specified namespace.

```shell
$ kubectl get all -n default | grep replicaset.apps | \
    awk '{if ($2 + $3 + $4 == 0) print $1}' | \
    awk '{comm="kubectl delete "$1" -n default"; system(comm)}'
```

Remove useless replicasets from all namespaces.

```shell
$ kubectl get all -A | grep replicaset.apps | \
    awk '{if ($3 + $4 + $5 == 0) print $1,$2}' | \
    awk '{comm="kubectl delete "$2" -n "$1; system(comm)}'
```

## Clean up Evicted pods

```shell
$ kubectl get pods -A \
    -o=jsonpath="{range .items[*]}{ .metadata.name }{'\t'}{.metadata.namespace}{'\t'}{.status.reason}{'\n'}{end}" | \
    grep Evicted | awk '{system("kubectl delete pod "$1" -n "$2);}'
```

# Statistics

## All memory requests in cluster

```shell
$ kubectl get pods -A \
    -o jsonpath="{range .items[*]}{range .spec.containers[*]}{.name}{'\t'}{.resources.requests.memory}{'\n'}{end}{end}" | \
    awk 'BEGIN {total=0} {if($2) {if($2 ~ /Gi/) {mem=1000 * $2;} else {mem = 1 * $2}; total += mem; print $1,$2,mem, total}} END {print total}'
```

## All memory requests on node 172.16.0.13

```shell
$ kubectl get pods -A \
    -o jsonpath="{range .items[?(@.status.hostIP=='172.16.0.13')]}{range .spec.containers[*]}{.name}{'\t'}{.resources.requests.memory}{'\n'}{end}{end}" | \
    awk 'BEGIN {total=0} {if($2) {if($2 ~ /Gi/) {mem=1000 * $2;} else {mem = 1 * $2}; total += mem; print $1,$2,mem}}' | \
    sort -nrk 3 | awk 'BEGINE {total=0} {total+=$3; print} END {print total}'
```

## All cpu requests on node 172.16.0.13

```shell
$ kubectl get pods -A \
    -o jsonpath="{range .items[?(@.status.hostIP=='172.16.0.13')]}{range .spec.containers[*]}{.name}{'\t'}{.resources.requests.cpu}{'\n'}{end}{end}" | \
    awk 'BEGIN {total=0} {if($2) {if($2 !~ /m/) {cpu=1000 * $2;} else {cpu = 1 * $2}; total += cpu; print $1,$2,cpu}}'  | \
    sort -nrk 3 | awk 'BEGINE {total=0} {total+=$3; print} END {print total}'
```