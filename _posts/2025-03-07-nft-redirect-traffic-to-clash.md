---
layout: post
title: Use nft to redirect all traffic to clash
excerpt: nft on openwrt
date: 2025-03-07
tags: [openwrt, clash]
comments: true
---

As I already have the Clash installed on my openwrt router, and it has the ability to bypass GFW with its proxy rules, I decided to use nft to redirect all network traffic to Clash.

## 1. Enable redir port on Clash

First, Clash need to open a redir port, which all traffic will be redirected to. Add the below line to `/etc/clash/config.yaml`.

```yaml
redir-port: 7892
```

## 2. Use nft to redirect traffic

Store these nft scripts to `clash.nft`.

```yaml
table ip nat {
  chain clash {
    # return for private IPs
    ip daddr { 
      0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8, 169.254.0.0/16,
      172.16.0.0/12, 192.168.0.0/16, 224.0.0.0/4, 240.0.0.0/4 
    } return

    # return if dest port is 7892
    tcp dport 7892 return
    meta mark 0x1 return

    # redirect all other traffic to clash
    ip protocol tcp redirect to :7892
  }

  chain PREROUTING {
    type nat hook prerouting priority dstnat; policy accept;
    meta l4proto tcp jump clash
  }

}

table ip mangle {
  chain OUTPUT {
    type filter hook output priority mangle;
    ip daddr != 127.0.0.1 meta skuid clash mark set 0x1
  }
}
```

Then execute `nft -f clash.nft` to make all traffic redirect to clash.

## 3. Hijack all DNS traffic to router

I use `dnscrypt-proxy` and `dnsmasq` as DNS solution on openwrt, sometime we need to hijack the DNS traffic because some devices might not able to configure DNS. Add these lines to `/etc/config/firewall` and reboot.

```conf
# Redirect unencrypted DNS queries to dnscrypt-proxy
config redirect
    option name 'Divert-DNS, port 53'
    option src 'lan'
    option dest 'lan'
    option src_dport '53'
    option dest_port '53'
    option target 'DNAT'

# Block DNS-over-TLS over port 853
# Assuming you're not actually running a DoT stub resolver
config rule
    option name 'Reject-DoT, port 853'
    option src 'lan'
    option dest 'wan'
    option dest_port '853'
    option proto 'tcp'
    option target 'REJECT'

# Optional: Redirect queries for DNS servers running on non-standard ports. Can repeat for 9953, 1512, 54. Check https://github.com/parrotgeek1/ProxyDNS for examples.
# Warning: can break stuff, don't use this one if you run an mDNS server
config redirect
    option name 'Divert-DNS, port 5353'
    option src 'lan'
    option dest 'lan'
    option src_dport '5353'
    option dest_port '53'
    option target 'DNAT'
```