---
layout: post
title: "OpenWrt Network Services: mihomo TUN Mode"
excerpt: Migrate clash proxy from TProxy to TUN mode on OpenWrt
date: 2026-05-01
tags: [openwrt]
comments: true
---

Recently, I migrated my home OpenWrt router's proxy setup from Clash TProxy mode to TUN mode. mihomo (a flexible proxy tool based on Clash) now uses its built-in TUN support to handle LAN traffic interception, replacing the old TProxy + nftables setup. This post documents the updated configuration and migration steps

## Proxy with mihomo TUN Mode

The old TProxy setup required nftables rules and policy routing, while TUN mode simplifies traffic interception by letting mihomo manage the TUN interface and routing internally.

### Why Switch to TUN Mode?
- No external nftables rules needed (mihomo handles everything)
- Intercepts all traffic types (TCP/UDP/ICMP) automatically
- Fewer moving parts, easier maintenance

### Updated mihomo Config
Remove TProxy-specific settings and add the `tun` block:
```yaml
port: 7890
allow-lan: true
mode: Rule
# Removed TProxy settings: tproxy-port: 7895, routing-mark: 255

tun:
  enable: true
  stack: system
  auto-route: true
  auto-redirect: true
  device: tun0
  dns-hijack:
  - any:53

dns:
  enable: true
  listen: 0.0.0.0:5353
  ipv6: false
  enhanced-mode: redir-host
  nameserver:
    - 114.114.114.114
    - tls://223.5.5.5:853
    - https://doh.pub/dns-query
    - https://dns.alidns.com/dns-query#h3=true
```

### Clean Up Legacy TProxy Components
Remove old nftables rules and policy routing:
```bash
# Delete nftables rules
rm /etc/clash/11-clash.nft
nft delete table inet mihomo

# Remove policy routing rules
ip rule del fwmark 1 lookup 100
ip route del local default dev lo table 100
```

### Startup Configuration
Update your router's startup script to only start mihomo (no more nft or ip rule commands):
```bash
# Start mihomo (adjust path to your config)
mihomo -d /etc/clash/
```

mihomo will automatically create the `tun0` interface and set up routing rules.