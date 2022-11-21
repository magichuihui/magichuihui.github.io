---
layout: post
title: Calico BGP with openwrt
excerpt: Kubernetes & OpenWRT & Calico BGP
date: 2022-11-21
tags: [kubernetes, calico, openwrt]
comments: true
---

Build a Kubernetes Cluster that using Calico as network plugin, which distributed routes with an openwrt router.

## kubespray

```yaml
# hosts.yaml
all:
  hosts:
    my_node:
      ansible_host: 192.168.1.2
      ip: 192.168.1.2
      access_ip: 192.168.1.2
      local_as: 65009
```

```yaml
# group_vars/k8s_cluster/k8s-net-calico.yml
peer_with_router: true

peers:
  - router_id: "192.168.1.1"
    as: "65001"
    # sourceaddress: "none"
    scope: "global"

calico_advertise_service_loadbalancer_ips: "{{ metallb_ip_range }}"

global_as_num: "65009"

calico_network_backend: "bird"

calico_ipip_mode: 'Never'

calico_vxlan_mode: 'Never'
```

```yaml
# group_vars/k8s_cluster/addons.yml
metallb_enabled: true
metallb_speaker_enabled: false 
metallb_avoid_buggy_ips: true
metallb_ip_range:
  - "192.168.253.0/24"
metallb_protocol: "bgp"
metallb_peers:
  - peer_address: 192.168.1.1
    peer_asn: 65001
    my_asn: 65009
metallb_controller_tolerations:
  - key: "node-role.kubernetes.io/master"
    operator: "Equal"
    value: ""
    effect: "NoSchedule"
  - key: "node-role.kubernetes.io/control-plane"
    operator: "Equal"
    value: ""
    effect: "NoSchedule"
```

## openwrt

```conf
router bgp 65001
 bgp router-id 192.168.1.1
 neighbor 192.168.1.2 remote-as 65009
 neighbor 192.168.1.2 description "my_node"
```

```bash
OpenWrt# show ip route 
Codes: K - kernel route, C - connected, S - static, R - RIP,
       O - OSPF, I - IS-IS, B - BGP, P - PIM, A - Babel, N - NHRP,
       > - selected route, * - FIB route

K>* 0.0.0.0/0 via 192.168.0.1, eth0.2, src 192.168.0.84
B>* 10.233.81.0/26 [20/0] via 192.168.1.2, br-lan, 00:44:09
C>* 100.64.0.31/32 is directly connected, tailscale0
C>* 127.0.0.0/8 is directly connected, lo
C>* 192.168.0.0/24 is directly connected, eth0.2
C>* 192.168.1.0/24 is directly connected, br-lan
B>* 192.168.253.0/24 [20/0] via 192.168.1.2, br-lan, 00:44:09
```

