---
layout: post
title: How to reclaim disk space when files are deleted
excerpt: Optimize ceph storage class
date: 2022-10-21
tags: [kubernetes, ceph]
comments: true
---

## Why the ceph pool will always be full eventually

We can use the rook-ceph-tools, which has the necessary ceph cli tools,  to collect information about ceph. The following results show the minio space usage is about 70G.

```bash
$ rbd du -p replicapool
NAME                                          PROVISIONED  USED   
csi-vol-1f1717c0-fe99-11ec-b393-16a9aab30463        1 GiB   36 MiB
csi-vol-27f70280-22b2-11ed-a202-665978ef4674        8 GiB  140 MiB
csi-vol-45d89930-c399-11ec-b393-16a9aab30463        1 GiB  972 MiB
csi-vol-4aa9d915-c39a-11ec-b393-16a9aab30463       10 GiB  488 MiB
csi-vol-552c57ee-c39a-11ec-b393-16a9aab30463       10 GiB  360 MiB
csi-vol-5f33e5e8-c39a-11ec-b393-16a9aab30463       10 GiB  9.5 GiB
csi-vol-67b3f9ba-c39a-11ec-b393-16a9aab30463        2 GiB   32 MiB
csi-vol-6fbf2eca-c3d8-11ec-b393-16a9aab30463       10 GiB   68 MiB
csi-vol-a331d935-f10c-11ec-b393-16a9aab30463        1 GiB  104 MiB
csi-vol-bf5bdd5e-c3a7-11ec-b393-16a9aab30463        1 GiB  144 MiB
csi-vol-bf980ad3-c3a7-11ec-b393-16a9aab30463       10 GiB  1.3 GiB
csi-vol-c4599de5-c3a7-11ec-b393-16a9aab30463       80 GiB   75 GiB
csi-vol-c4615281-c3a7-11ec-b393-16a9aab30463       80 GiB   75 GiB
csi-vol-c466cc23-c3a7-11ec-b393-16a9aab30463       80 GiB   56 GiB
csi-vol-c4687d4c-c3a7-11ec-b393-16a9aab30463       80 GiB   55 GiB
csi-vol-ec72ffc8-fd0d-11ec-b393-16a9aab30463       20 GiB  304 MiB
csi-vol-ee9b90b8-c3d6-11ec-b393-16a9aab30463        1 GiB   72 MiB
<TOTAL>                                           405 GiB  274 GiB
```

But in the kubernetes cluster, pv usage is 15GB, which is far from 70G.

```bash
$ kubectl df-pv -n navatics-harbor-ns

Pod Name                                              Size       Used
postgresql-navatics-harbor-ns-harbor-cluster-0        9Gi        327Mi
rfr-harbor-cluster-redis-0                            973Mi      364Ki
minio-harbor-cluster-zone-harbor-1                    78Gi       15Gi
minio-harbor-cluster-zone-harbor-0                    78Gi       15Gi
minio-harbor-cluster-zone-harbor-1                    78Gi       15Gi
minio-harbor-cluster-zone-harbor-0                    78Gi       15Gi
```

This is because the space is not freed by the operation system when files are deleted. So we have to do it manually.

```bash
# Find out which containers use these PVs. And enter the containers' shell to 
# reclaim the disk usage

docker exec -it -u root --privileged 9c2630c917e9 /bin/bash
$ fstrim -v /export0/
$ fstrim -v /export1/
```

After we have done these steps, the ceph cluster returns to HEALTH_OK again.

Maybe we should change the configuration of the ceph storageclass, instead of freeing disk manually..

## How do we avoid this happening again

This can be accomplished by adding discard to mountOptions in the storageclass

```bash
allowVolumeExpansion: true
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
    storageclass.kubesphere.io/allow-clone: "true"
    storageclass.kubesphere.io/allow-snapshot: "true"
  name: rook-ceph-block
parameters:
  clusterID: rook-ceph
  csi.storage.k8s.io/controller-expand-secret-name: rook-csi-rbd-provisioner
  csi.storage.k8s.io/controller-expand-secret-namespace: rook-ceph
  csi.storage.k8s.io/fstype: ext4
  csi.storage.k8s.io/node-stage-secret-name: rook-csi-rbd-node
  csi.storage.k8s.io/node-stage-secret-namespace: rook-ceph
  csi.storage.k8s.io/provisioner-secret-name: rook-csi-rbd-provisioner
  csi.storage.k8s.io/provisioner-secret-namespace: rook-ceph
  imageFeatures: layering
  imageFormat: "2"
  pool: replicapool
provisioner: rook-ceph.rbd.csi.ceph.com
reclaimPolicy: Delete
volumeBindingMode: Immediate
mountOptions:
- discard
```