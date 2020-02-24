---
layout: post
title: Trojan + https-dns-proxy 实现OpenWrt科学上网
date: 2020-02-23
tags: [OpenWrt, trojan]
comments: true
---

近期由于某些原因家里路由器上安装的Shadowsocks + ChinaDNS不能正常使用了，正好服务商开始提供Trojan服务，于是就想着把路由器上也安装Trojan。Trojan目前还没有官方OpenWrt安装包，只提供了源码 [openwrt-trojan](https://github.com/trojan-gfw/openwrt-trojan)，需要自行编译。

安装过程分为以下三步：

* 配置`Trojan`作为透明代理，类似于`ss-redir`的功能
* 设置`iptables`规则，使国内跟国外流量分流
* 通过`https-dns-proxy`解决DNS污染

## 环境

* Fedora 31 Workstation
* OpenWrt 19.07.1


## 编译并安装Trojan

我这里是在`Fedora 31`下进行编译的，FreeBSD下没有成功。具体方法可以参考官方文档[<sup>1</sup>](#refer-1)。

1. 安装依赖
    
    ```bash
dnf groupinstall "Development Tools"
dnf groupinstall "C Development Tools and Libraries"
dnf install python2
    ```

2. 下载源码

```bash
git clone https://git.openwrt.org/openwrt/openwrt.git
git clone https://github.com/trojan-gfw/openwrt-trojan.git
cd openwrt
# 选择路由器固件的分支
git checkout v19.07.1
mv ../openwrt-trojan/trojan ../openwrt-trojan/openssl1.1 package/
```

这里一定选择跟路由器固件版本相同的分支，否则可能会有安装包版本冲突

3. 编译，参考资料[<sup>2</sup>](#refer-2)

```bash
./scripts/feeds update -a
./scripts/feeds install -a

make menuconfig
```

这里的`Target System`的选择可以从OpenWrt的设备页面寻找，例如：[WNDR4300](https://openwrt.org/toh/hwdata/netgear/netgear_wndr4300_v1)。选中`Package the OpenWrt-based Toolchain`，然后在下面的package里找到并选择`trojan`（M才会编译成.ipk)。

```bash
make -j5 V=s 2>&1 | tee build.log | grep -i '[^_-"a-z]error[^_-.a-z]'
```

漫长地等待之后在`bin`目录里可以找到 `trojan-1.4.1xxxxx.ipk`，上传到路由器的 `/tmp` 目录供我们安装。
    
4. 安装Trojan

登录路由器安装`Trojan`

```bash
opkg update
opkg install /tmp/trojan-1.4.1xxxxx.ipk
```

因为我们是作为透明代理来使用，所以模式要选择 nat。如果选择client模式此时在路由器上已经可以作为socks5代理使用。

```bash
cat > /etc/trojan.json <<'EOF'
{
    "run_type": "nat",
    "local_addr": "127.0.0.1",
    "local_port": 1080,
    "remote_addr": "example.com",
    "remote_port": 443,
    "password": [
        "password1"
    ],
    "log_level": 1,
    "ssl": {
        "verify": true,
        "verify_hostname": true,
        "cert": "",
        "cipher": "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES256-SHA:ECDHE-ECDSA-AES128-SHA:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:DHE-RSA-AES128-SHA:DHE-RSA-AES256-SHA:AES128-SHA:AES256-SHA:DES-CBC3-SHA",
        "cipher_tls13": "TLS_AES_128_GCM_SHA256:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_256_GCM_SHA384",
        "sni": "",
        "alpn": [
            "h2",
            "http/1.1"
        ],
        "reuse_session": true,
        "session_ticket": false,
        "curves": ""
    },
    "tcp": {
        "no_delay": true,
        "keep_alive": true,
        "reuse_port": false,
        "fast_open": false,
        "fast_open_qlen": 20
    }
}
EOF
```

## 配置iptables

因我之前已经装了shadowsocks，iptables已经由`/usr/bin/ss-rules`设置好了，所以我直接在`/etc/init.d/trojan`里加上shadowsocks关于防火墙的设置。下面我们不使用ss-rules，而是直接设置iptables。iptables设置方法参考[<sup>3</sup>](#refer-3)，Chnroute参考[<sup>4</sup>](#refer-4)

新建一个文件 /usr/bin/trojan-up.sh，在trojan启动时设置防火墙。内容如下

```bash
#!/bin/sh

SOCKS_SERVER=x.x.x.x
# Setup the ipset
ipset -! restore <<-EOF
    create chnroute hash:net hashsize 64 
    $(for ip in $(cat /etc/chnroute.txt); do echo "add chnroute $ip"; done)
EOF

# nat SHADOWSOCKS
iptables -t nat -N SHADOWSOCKS
iptables -t mangle -N SHADOWSOCKS

# Allow connection to the server
iptables -t nat -A SHADOWSOCKS -d $SOCKS_SERVER -j RETURN

# Allow connection to reserved networks
iptables -t nat -A SHADOWSOCKS -d 0.0.0.0/8 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 10.0.0.0/8 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 127.0.0.0/8 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 100.64.0.0/10 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 192.0.0.0/24 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 192.0.2.0/24  -j RETURN
iptables -t nat -A SHADOWSOCKS -d 192.31.196.0/24 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 192.52.193.0/24 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 192.88.99.0/2 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 192.175.48.0/24 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 198.18.0.0/15 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 198.51.100.0/24 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 203.0.113.0/24 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 169.254.0.0/16 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 172.16.0.0/12 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 192.168.0.0/16 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 224.0.0.0/4 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 240.0.0.0/4 -j RETURN

# Allow connection to chinese IPs
iptables -t nat -A SHADOWSOCKS -p tcp -m set --match-set chnroute dst -j RETURN

# Redirect to Shadowsocks
iptables -t nat -A SHADOWSOCKS -p tcp -j REDIRECT --to-port 1080

iptables -t nat -A OUTPUT -p tcp -j SHADOWSOCKS

# Apply the rules                              
iptables -t nat -A PREROUTING -p tcp -j SHADOWSOCKS
iptables -t mangle -A PREROUTING -j SHADOWSOCKS
```

Trojan关闭时，清理iptables规则的文件 `/usr/bin/trojan-down.sh`

```bash
#!/bin/sh

iptables -t nat -D PREROUTING -p tcp -j SHADOWSOCKS
iptables -t mangle -D PREROUTING -j SHADOWSOCKS

iptables -t nat -D OUTPUT -p tcp -j SHADOWSOCKS
iptables -t nat -F SHADOWSOCKS
iptables -t nat -X SHADOWSOCKS
iptables -t mangle -F SHADOWSOCKS
iptables -t mangle -X SHADOWSOCKS
ipset destroy chnroute
```

然后在`Trojan`的启动文件`/etc/init.d/trojan`脚本加上这2个文件，这样iptables规则跟随trojan生灭。

## https-dns-proxy 解决DNS污染[<sup>5</sup>](#refer-5)

```bash
opkg update
opkg install luci-app-https-dns-proxy https-dns-proxy
```

安装完成默认已经配置好了，在Luci界面查看 `dnsmasq` 的 `DNS forwardings` 是否设置成功。

至此又可以科学上网啦。

## 参考

<div id="refer-1"></div>

- [1] [OpenWrt Build system – Installation](https://openwrt.org/docs/guide-developer/build-system/install-buildsystem)

<div id="refer-2"></div>

- [2] [编译环境 – 使用说明](https://openwrt.org/start?id=zh/docs/guide-developer/build-system/use-buildsystem)

<div id="refer-3"></div>

- [3] [iptables-linux](https://github.com/yangchuansheng/love-gfw/blob/master/docs/iptables-linux.md)

<div id="refer-4"></div>

- [4] [ChinaDNS for OpenWrt](https://github.com/aa65535/openwrt-chinadns)

<div id="refer-5"></div>

- [5] [DNS over HTTPS with Dnsmasq and https-dns-proxy](https://openwrt.org/docs/guide-user/services/dns/doh_dnsmasq_https-dns-proxy)