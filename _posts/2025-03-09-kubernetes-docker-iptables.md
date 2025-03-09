---
layout: post
title: Fix iptables rules on a host with both docker and kubernetes
excerpt: Docker container can't access network when you have kubernetes installed 
date: 2025-03-09
tags: [kubernetes, docker]
comments: true
---

I have a Linux host with Kubernetes and docker install on it, the kubernets cluster works fine. But when I create a container with docker manually, it can not access external network. 

This is because the iptables rules are managed by kubernetes now, so there is no forwarding rule for docker container.

Assume that the network interface is eth0, and network address for docker is `172.17.0.0/16`, here is the solution

```bash
iptables -A FORWARD -i docker0 -o eth0 -j ACCEPT
iptables -t nat -A POSTROUTING -s 172.17.0.0/16 ! -o docker0 -j MASQUERADE
```