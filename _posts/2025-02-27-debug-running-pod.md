---
layout: post
title: How to use kubectl debug for a running pod
excerpt: Debug a running pod
date: 2025-02-27
tags: [kubernetes]
comments: true
---

It's able to launch a debugging container for Kubernetes pod with `kubectl debug`, to get a terminal for debugging a running pod, since kubectl v1.31.

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
  - image: nginxinc/nginx-unprivileged:1.27
    imagePullPolicy: IfNotPresent
    name: nginx
    ports:
    - containerPort: 80
      protocol: TCP
    resources:
      limits:
        cpu: 100m
        memory: 100Mi
      requests:
        cpu: 100m
        memory: 100Mi
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop:
        - ALL
      runAsNonRoot: true
      runAsUser: 1000
    volumeMounts:
    - mountPath: /data
      name: test
  securityContext:
    seccompProfile:
      type: RuntimeDefault
    runAsNonRoot: true
    runAsUser: 1000
  volumes:
  - emptyDir: {}
    name: test
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
    drop:
    - ALL
  allowPrivilegeEscalation: false
  runAsNonRoot: true
```

## kubectl debug

Using `kuebctl debug` to attach an ephemeral container to the running nginx pod.

```bash
kubectl debug -it --image=centos:8 --target=nginx --custom=custom-profile.yaml nginx-debug-pod
```

Verify those custom attributes in the terminal.

```shell
bash-4.4$ id
uid=65533 gid=0(root) groups=0(root)

bash-4.4$ ps aux
USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
1000           1  0.0  0.0  11452  7288 ?        Ss   11:28   0:00 nginx: master process nginx -g daemon off;
1000          28  0.0  0.0  11912  2584 ?        S    11:28   0:00 nginx: worker process
1000          29  0.0  0.0  11912  2448 ?        S    11:28   0:00 nginx: worker process
1000          30  0.0  0.0  11912  2584 ?        S    11:28   0:00 nginx: worker process
1000          31  0.0  0.0  11912  2452 ?        S    11:28   0:00 nginx: worker process
65533         32  0.0  0.0  35104  4016 pts/0    Ss   12:25   0:00 /bin/bash
65533         42  0.0  0.0  47588  3796 pts/0    R+   12:27   0:00 ps aux

bash-4.4$ env | grep MY_VAR
MY_VAR1=hello
MY_VAR2=world
```

## Mount Volumes to your ephemeral container.

Sometime you might need to mount the Volume to your ephemeral container for debugging purpose. For that kind of usage, you can always call the API of api-server directly to attach an ephemeral container with volumeMounts to your pods.

```bash
$ kubectl proxy
$ curl http://localhost:8001/api/v1/namespaces/default/pods/nginx-debug-pod/ephemeralcontainers \
  -X PATCH \
  -H 'Content-Type: application/strategic-merge-patch+json' \
  -d '
{
    "spec":
    {
        "ephemeralContainers":
        [
            {
                "name": "debugger",
                "command": ["sh"],
                "image": "centos:8",
                "targetContainerName": "nginx",
                "env": [
                  {"name": "MY_VAR1", "value": "hello"},
                  {"name": "MY_VAR2", "value": "world"}
                ],
                "securityContext": {
                  "runAsUser": 65533,
                  "readOnlyRootFilesystem": true,
                  "allowPrivilegeEscalation": false,
                  "runAsNonRoot": true,
                  "capabilities": {
                    "drop": ["ALL"]
                  }
                },
                "stdin": true,
                "tty": true,
                "volumeMounts": [{
                    "mountPath": "/data",
                    "name": "test",
                    "readOnly": true
                }]
            }
        ]
    }
}'
$ kubectl -n default attach nginx-debug-pod -c debugger -ti
```