---
layout: post
title: ceph提供subdomain风格的s3
excerpt: ceph s3
date: 2022-09-30
tags: [kubernetes, ceph]
comments: true
---

为提供更加兼容s3的对象存储，即 <bucket-name>.s3.example.com

## 增加DNS记录

```conf
*.s3    CNAME s3.example.com
```

## 设置rgw

```bash
[rook@rook-ceph-tools-f579cb58c-jh96v tmp]$ radosgw-admin zonegroup get > zonegroup.json
[rook@rook-ceph-tools-f579cb58c-jh96v tmp]$ vi zonegroup.json
...
    "hostnames": ["rook-ceph-rgw-my-store.rook-ceph.svc", "s3.example.com"],
    "hostnames_s3website": ["..."],
...

[rook@rook-ceph-tools-f579cb58c-jh96v tmp]$ radosgw-admin zonegroup set --infile zonegroup.json
[rook@rook-ceph-tools-f579cb58c-jh96v tmp]$ radosgw-admin period update --commit
```