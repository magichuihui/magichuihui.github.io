---
layout: post
title: MetalLB BGP Sessions Failing After Router Reboot? Here's How I Fixed It
excerpt: Debugging mysterious BGP connection drops in a Kubernetes home lab and using nftables plus ebgpMultiHop to make it resilient
date: 2026-04-26
tags: [kubernetes]
comments: true
---

# Solving the MetalLB BGP Ghost: Why My Router Reboot Breaks the Peer

When running **MetalLB** on Kubernetes with a Home Lab setup (like **OpenWrt**), I expected a robust network. However, I faced a frustrating issue: the BGP session dies after a router reboot and refuses to reconnect unless the MetalLB Speaker Pod is deleted.

After deep-diving into packet flows, `nftables`, and FRR (the engine inside MetalLB) logs, I found the culprit.

## The Symptoms
1.  **Stuck in Active:** MetalLB shows `BGP state = Active`, meaning it's trying to connect but failing.
2.  **BFD is Up:** Surprisingly, BFD (UDP) is working fine, but BGP (TCP) is not.
3.  **The "No Path" Error:** MetalLB logs show `No path to specified Neighbor`.

## The Root Causes

### 1. The Firewall & Tailscale Interference
Modern OpenWrt uses `fw4` (nftables). I use **Tailscale** and **Mihomo (Clash)**, and they frequently refresh `nat` and `mangle` tables. During a reboot, if the BGP TCP handshake (Port 179) gets caught in a connection tracking (conntrack) race condition or gets tagged by a proxy rule, the connection hangs in a "zombie" state.

### 2. The Kernel vs. FRR Route Conflict
MetalLB’s FRR engine is strict. It looks at the Linux Kernel routing table. If it sees the route to the router as a `Kernel` route instead of a `Connected` route, it might refuse to start the BGP session for "security" reasons, thinking the neighbor isn't actually direct.

## The Solution

To fix this, I needed to bypass the strict "Directly Connected" check in MetalLB and protect the BGP traffic from the firewall.

### 1. OpenWrt: The "Untracked" Protection
I created a high-priority `raw` table to ensure BGP and BFD traffic are never touched by the proxy or conntrack.

```nft
table inet custom_bgp {
    chain raw_pre {
        type filter hook prerouting priority raw; policy accept;
        tcp dport 179 notrack
        tcp sport 179 notrack
        udp dport 3784 notrack  # BFD
    }
    chain filter_input {
        type filter hook input priority filter; policy accept;
        tcp dport 179 accept
        udp dport 3784 accept
    }
}
```

### 2. MetalLB: The `ebgpMultiHop` Hack
By setting `ebgpMultiHop: true`, we tell MetalLB: *"Stop checking if the neighbor is directly connected. Just send the packets."* This bypasses the FRR internal route validation that usually causes the `No path to Neighbor` error.

## Final Working Configuration

### Router: Bird 3.x Config
On the router, we keep it simple. We let the router be **Passive** so it doesn't get confused by multiple connection attempts during the reboot phase.

```bird
protocol bfd {
    interface "br-lan";
}

protocol bgp waukeen {
    local 192.168.1.1 as 65001;
    neighbor 192.168.1.2 as 65009;
    
    bfd on;
    graceful restart on;
    passive on; # Wait for the Speaker to initiate
    ipv4 {
        import all;
        export none;
    };
}
```

### Kubernetes: MetalLB CRD
The magic happens here with `ebgpMultiHop: true`.

```yaml
apiVersion: metallb.io/v1beta2
kind: BGPPeer
metadata:
  name: openwrt
  namespace: metallb-system
spec:
  myASN: 65009
  peerASN: 65001
  peerAddress: 192.168.1.1
  holdTime: 15s
  keepaliveTime: 5s
  bfdProfile: bfdprofile
  ebgpMultiHop: true # The "Secret Sauce"
---
apiVersion: metallb.io/v1beta1
kind: BFDProfile
metadata:
  name: bfdprofile
  namespace: metallb-system
spec:
  receiveInterval: 380
  transmitInterval: 270
```

## Conclusion
If your MetalLB BGP sessions are brittle, don't just delete pods. Check your **Directly Connected** route status and protect your BGP port with `notrack`. Setting `ebgpMultiHop` was the simplest way to make the connection resilient against kernel routing table inconsistencies in my setup.