---
layout: post
title: "OpenWrt Network Services: mihomo, nftables, Tailscale & WOL"
excerpt: Setup clash proxy on openwrt
date: 2026-04-26
tags: [openwrt]
comments: true
---

Recently, I upgraded my home network with a new OpenWrt router and integrated several powerful services: mihomo as a proxy, nftables for traffic redirection, Tailscale for secure remote access, and WOL (Wake-on-LAN) to boot my PC remotely. This post documents my setup and key configuration points for anyone interested in a similar solution.

## 1. Proxy with mihomo & nftables

mihomo is a flexible proxy tool based on Clash. My configuration files for mihomo and nftables are as below:


**mihomo main config snippet:**

```yaml
port: 7890
tproxy-port: 7895
allow-lan: true
mode: Rule
routing-mark: 255
dns:
    enable: true
    listen: 0.0.0.0:5353
    ipv6: false
    enhanced-mode: redir-host
    nameserver:
    - 114.114.114.114
    - 8.8.8.8
    - tls://223.5.5.5:853
    - https://doh.pub/dns-query
    - https://dns.alidns.com/dns-query#h3=true
    - https://mozilla.cloudflare-dns.com/dns-query#DNS&h3=true
    - dhcp://en0
    - quic://dns.adguard.com:784
```

**nftables rules snippet:**

Store the following nft rules into `/etc/clash/11-clash.nft`.

```nft
table inet mihomo {
    set reserved_v4 {
        type ipv4_addr
        flags interval
        elements = { 
            0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8,
            169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, 
            224.0.0.0/4, 240.0.0.0/4
        }
    }

    chain clash_prerouting {
        meta mark & 0x0000ff00 != 0 return 
        meta mark 0x000000ff return
        
        ip daddr @reserved_v4 return
        
        tcp dport 179 return

        meta l4proto { tcp, udp } meta mark set 0x00000001 tproxy to :7895
    }

    chain clash_output {
        meta mark & 0x0000ff00 != 0 return
        meta mark 0x000000ff return
        
        ip daddr @reserved_v4 return
        tcp dport 179 return

        meta l4proto { tcp, udp } meta mark set 0x00000001
    }

    chain PREROUTING {
        type filter hook prerouting priority -140; policy accept;
        jump clash_prerouting
    }

    chain OUTPUT {
        type route hook output priority -140; policy accept;
        jump clash_output
    }
}
```

Execute the below command inside the router, as put it in startup scripts.

```bash
ip rule add fwmark 1 lookup 100
ip route add local default dev lo table 100

nft -f /etc/clash/11-clash.nft
```

## 2. Tailscale for Remote Access

Tailscale creates a secure virtual network between all your devices using WireGuard. Just install Tailscale on OpenWrt and log in to your account.[[1](https://openwrt.org/docs/guide-user/services/vpn/tailscale/start)]

Common commands:

```sh
opkg update && opkg install tailscale
tailscale up --advertise-routes=192.168.1.0/24 --accept-dns=false
# Check assigned internal IP
tailscale ip -4
```

## 3. WOL (Wake-on-LAN)

With OpenWrt's WOL tool, you can wake up your home PC remotely. After configuring the MAC address, use the following commands:

```sh
# Install WOL tool
opkg install etherwake
# Send wake packet
etherwake -i br-lan <MAC_ADDRESS>
```