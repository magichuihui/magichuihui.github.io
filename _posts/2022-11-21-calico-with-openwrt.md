---
layout: post
title: Calico BGP with openwrt
excerpt: Kubernetes & OpenWRT & Calico BGP
date: 2022-11-21
tags: [kubernetes, calico, openwrt]
comments: true
---

In this article we will build a Kubernetes Cluster that using Calico as network plugin, which distributes routes with an openwrt router. And using metallb as loadbalance provider.

So we could access the IPs of pods and service in the cluster from devices under the openwrt router.


# Use kubespray to deploy the kubernetes cluster

We will deploy a single node cluster via [kubespray][1]

## Prepare ansible inventory

```bash
# Copy ``inventory/sample`` as ``inventory/mycluster``
cp -rfp inventory/sample inventory/mycluster

# Update Ansible inventory file with inventory builder
declare -a IPS=(192.168.1.2)
CONFIG_FILE=inventory/mycluster/hosts.yaml python3 contrib/inventory_builder/inventory.py ${IPS[@]}

```

Then add variable `local_as` to hosts.yaml
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

## Customize calico's configuration

we need to enable the peering with the openwrt router, by setting `peer_with_router` to true, and `local_as` that we set above.

```yaml
# group_vars/k8s_cluster/k8s-net-calico.yml
peer_with_router: true
nat_outgoing: false

peers:
  # openwrt's ip and AS number
  - router_id: "192.168.1.1"
    as: "65001"
    scope: "global"

# use calico to assign lb's ip
calico_advertise_service_loadbalancer_ips: "{{ metallb_ip_range }}"

# nodes' AS number
global_as_num: "65009"

calico_network_backend: "bird"

calico_ipip_mode: 'Never'

calico_vxlan_mode: 'Never'
```

## Enable metallb plugin

 we can disable metallb **speaker**, as the calico controller is in charge of assigning the IPs to the services now.

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

## Deploy the cluster

```bash
ansible-playbook -i inventory/mycluster/hosts.yaml --become \
 --become-user=root cluster.yml
```

# Enable BGP on openwrt

This should be done before we deploy the kubernetes cluster.

## Install quagga

```bash
opkg update
opkg install quagga quagga-zebra quagga-bgpd quagga-watchquagga quagga-vtysh
```

## BGP configuration on openwrt

After we connect to openwrt via ssh, we can use `vtysh` to enter the console of **quagga**

```
OpenWrt# configure terminal
OpenWrt(config)# router bgp 65001
OpenWrt(config-router)# neighbor 192.168.1.2 remote-as 65009
OpenWrt(config-router)# neighbor 192.168.1.2 description "my_node" 
```

## Checkout out the bgp router table

When the cluster is ready, we can check out the router table on openwrt.

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

# References

* [kubespary][1]

[1]: https://github.com/kubernetes-sigs/kubespray