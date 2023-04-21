---
layout: post
title: Cannot mount ceph PVC
excerpt: Multi-Attach error for ceph pvc
date: 2023-04-21
tags: [ceph, kubernetes]
comments: true
---


内网kubernetes节点故障，产生的因pvc无法attach导致pod一直没法正常启动的问题，记录一下解决的过程。

# 问题描述

deployment中指定使用了某一个pvc，在某些出现节点故障的情况下，出现deployment对应的pod被调度到了另外一个node节点，但pod在另外的node由于无法正常attach pv volume一直没法正常运行。

```shell
$ kubectl describe pod xxxx

Warning  FailedAttachVolume  43m   attachdetach-controller  Multi-Attach error for volume "pvc-0a5eb91b-3720-11e8-8d2b-000c29f8a512" Volume is already exclusively attached to one node and can't be attached to another
```

# 解决方法

## 1. 查看volume挂载的node节点

首先，查看PV对应的ceph rbd，下面的结果显示 **rbd image: csi-vol-bc41eb87-5412-11ed-ac86-ba3e04768c9d**，
**rbd pool: replicapool**

```shell
$ kubectl describe pv pvc-1f99d40b-bbf8-47b7-ac10-878edfa905a3
Name:            pvc-1f99d40b-bbf8-47b7-ac10-878edfa905a3
Source:
    Driver:            rook-ceph.rbd.csi.ceph.com
    VolumeAttributes:      clusterID=rook-ceph
                           csi.storage.k8s.io/pv/name=pvc-1f99d40b-bbf8-47b7-ac10-878edfa905a3
                           csi.storage.k8s.io/pvc/name=harbor-registry
                           csi.storage.k8s.io/pvc/namespace=harbor
                           imageFeatures=layering
                           imageFormat=2
                           imageName=csi-vol-bc41eb87-5412-11ed-ac86-ba3e04768c9d
                           journalPool=replicapool
                           pool=replicapool
                           storage.kubernetes.io/csiProvisionerIdentity=1666341546488-8081-rook-ceph.rbd.csi.ceph.com
```

接下来使用rook-ceph-tools容器里的ceph工具查看，rbd image具体挂载到了哪个节点上

```shell
$ rbd info csi-vol-bc41eb87-5412-11ed-ac86-ba3e04768c9d -p replicapool
rbd image 'csi-vol-bc41eb87-5412-11ed-ac86-ba3e04768c9d':
        size 150 GiB in 38400 objects
        order 22 (4 MiB objects)
        snapshot_count: 0
        id: e03c7b497744a3
        block_name_prefix: rbd_data.e03c7b497744a3
...

# 这里将上面的block_name_prefix属性值里的rbd_data替换为rbd_header
$ rados listwatchers -p replicapool rbd_header.e03c7b497744a3
watcher=10.244.6.0:0/3953292784 client.19964760 cookie=18446462598732840963
```

最终根据IP地址找到pv所在的节点**k8s-node-6**

## 2. 卸载PVC

登录节点**k8s-node-6**上的容器csi-rbdplugin

```shell
$ docker exec -it k8s_csi-rbdplugin_csi-rbdplugin-px5dp_rook-ceph_a1a69a28-4249-4b79-ae76-39c33a2afa7e_7 /bin/sh
 
## 找到pv的挂载点
$ df -h | grep pvc-1f99d40b-bbf8-47b7-ac10-878edfa905a3
/dev/rbd2       148G   63G   85G  43% /var/lib/kubelet/pods/3413abba-7f81-4e62-8946-ee76b515ec89/volumes/kubernetes.io~csi/pvc-1f99d40b-bbf8-47b7-ac10-878edfa905a3/mount

$ rbd unmap /dev/rbd4
```
卸载以后pod就可以正常启动了
