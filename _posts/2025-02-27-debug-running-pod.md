---
layout: post
title: How to use kubectl debug for a running pod
excerpt: Debug a running pod
date: 2025-02-27
tags: [kubernetes]
comments: true
---

It's able to launch a debugging container for Kubernetes pod with `kubectl debug`, to get a terminal for debugging a running pod.

With `kubectl debug`, an ephemeral container will be attached to the running pod and not restart the pod, sharing the same pid and network namespace with that pod.

## Create a pod

First, create a pod for testing:

```yaml
apiVersion: v1
kind: Pod
metadata:
  labels:
    app: nginx
  name: nginx-debug-pod
spec:
  containers:
  - image: nginx:1.23
    imagePullPolicy: IfNotPresent
    name: nginx
    ports:
    - containerPort: 80
      protocol: TCP
    resources: 
      limits:
        cpu: 100m
        memory: 128Mi
      requests:
        cpu: 100m
        memory: 128Mi
  securityContext:
    seccompProfile:
      type: RuntimeDefault
```

## Create a custom profile

By providing a custom profile to `kubectl debug`, partial container spec could be changed for the ephemeral container, such as environment variables, `securityContext`, etc.

```yaml
env:
- name: MY_VAR1
  value: hello
- name: MY_VAR2
  value: world
securityContext:
  runAsUser: 65533
  readOnlyRootFilesystem: true
  capabilities:
    add:
    - NET_ADMIN
    - SYS_TIME
```

## kubectl debug

Using `kuebctl debug` to attach an ephemeral container to the running nginx pod.

```bash
kubectl debug -it --image=centos:8 --profile=sysadmin --target=nginx --custom=custom-profile.yaml nginx-debug-pod
```

Verify those custom attributes in the terminal.

```shell
bash-4.4$ id
uid=65533 gid=0(root) groups=0(root)

bash-4.4$ ps aux
USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root           1  0.1  0.0   8936  5828 ?        Ss   14:27   0:00 nginx: master process nginx -g daemon 
101           29  0.0  0.0   9324  2872 ?        S    14:27   0:00 nginx: worker process
101           30  0.0  0.0   9324  2872 ?        S    14:27   0:00 nginx: worker process
101           31  0.0  0.0   9324  2872 ?        S    14:27   0:00 nginx: worker process
101           32  0.0  0.0   9324  2872 ?        S    14:27   0:00 nginx: worker process
65533         33  0.0  0.0  35104  4324 pts/0    Ss   14:27   0:00 /bin/bash
65533         40  0.0  0.0  47588  3868 pts/0    R+   14:28   0:00 ps aux

bash-4.4$ env | grep MY_VAR
MY_VAR1=hello
MY_VAR2=world
```