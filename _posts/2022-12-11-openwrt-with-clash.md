---
layout: post
title: Transparent proxy with clash on OpenWRT
excerpt: using clash on Openwrt
date: 2022-12-11
tags: [openwrt, clash, kubernetes]
comments: true
---

最近在**Netgear WNDR4300v2**上重装了openwrt 22，以下记录重新安装clash的过程

# Mechanism

我们使用clash作为透明代理，通过`iptables + ipset`实现国外流量走clash，国内直连。

对于DNS污染的问题，我们使用`dnsmasq` + 国内域名白名单，让国内的域名解析使用国内DNS服务器，并且将这些域名的IP地址保存在`ipset`，通过iptables规则直接连接。

而不在国内域名列表里的域名，使用**dnscrypt-proxy2**解析，结合iptables将流量转发到`clash`

# Prerequisite

* OpenWRT 22.03：路由器版本
* dnsmasq-full：用来配置国内域名，并且将解析的IP地址保存在ipset，而dnsmasq不支持
* dnscrypt-proxy2：用来防止DNS污染
* clash：支持多种协议
* iptables-nft：openwrt 22上使用nf-tables代替了iptables

# 安装Clash

## 下载并上传 clash

在[github](https://github.com/Dreamacro/clash/releases)下载路由器相应的版本，**Netgear WNDR4300v2**选择clash-linux-mips-softfloat

```bash
curl -LO https://github.com/Dreamacro/clash/releases/download/v1.12.0/clash-linux-mips-softfloat-v1.12.0.gz

tar zxvf clash-linux-mips-softfloat-v1.12.0.gz
cd clash-linux-mips-softfloat-v1.12.0

# 增加可执行权限
chmod +x clash-linux-mips-softfloat
scp clash-linux-mips-softfloat root@192.168.1.1:/usr/bin/clash
```

## 配置

在**OpenWRT**路由器上配置clash

### config.yaml

从服务商下载clash的配置文件，我用的是[shadowsocks.com](https://portal.shadowsocks.au/aff.php?aff=792)，将下载的文件`shadowsocks.yaml`重命名为`config.yaml`。

因为我们需要用到透明代理，所以在配置文件添加透明代理的端口

```yaml
# /etc/clash/config.yaml
port: 7890
redi-port: 7892
```

放到`/etc/clash/`目录下。

### service

通过`service`启动clash

```bash
cat >> /etc/init.d/clash <<'EOF'
#!/bin/sh /etc/rc.common
START=90
USE_PROCD=1

start_service() {
        procd_open_instance
        procd_set_param command /bin/clash -d /etc/clash
        procd_set_param respawn 300 0 5 # threshold, timeout, retry
        procd_set_param file /etc/clash/config.yml
        procd_set_param stdout 1
        procd_set_param stderr 1
        procd_set_param pidfile /var/run/clash.pid
        procd_close_instance
}
EOF

chmod +x /etc/init.d/clash
```

### 启动 Clash

启动clash并设置为开机自动启动

```bash
service clash start
service clash enable
```

至此**Clash**已经配置好了，通过设置`HTTP_PROXY=http://192.168.1.1:7890`已经可以科学上网

# 设置DNS

在路由器上设置DNS相关组件

## 安装 dnsmasq-full、dnscrypt-proxy2

```bash
opkg update

# 卸载 dnsmasq 并安装 dnsmasq-full
opkg remove dnsmasq && opkg install dnsmasq-full

# 安装 dnscrypt-proxy2 等
opkg install curl ipset iptables-nft dnscrypt-proxy2 ca-certificates coreutils-base64
```

## 禁用运营商的DNS

在`/etc/config/network`里增加以下参数，禁用ISP的DNS服务器

```conf
config interface 'wan'    # or 'wan6'
    option peerdns '0'
```

## 配置 dnscrypt-proxy2

这里只为`dnscrypt-proxy2`增加了一个http代理的配置，详细的参数可以参考[官方文档](https://github.com/DNSCrypt/dnscrypt-proxy/wiki/Configuration)

```toml
# /etc/dnscrypt-proxy2/dnscrypt-proxy.toml
http_proxy = 'http://127.0.0.1:7890'

```

重启 dnscrypt-proxy

```bash
service dnscrypt-proxy restart
service dnscrypt-proxy enable
```

## 配置 dnsmasq

定位 dnsmasq 的配置文件

```bash
mkdir /etc/dnsmasq.d
uci add_list dhcp.@dnsmasq[0].confdir=/etc/dnsmasq.d
uci add_list dhcp.@dnsmasq[0].cachesize=0
uci commit dhcp
```

下载大陆白名单，让大陆的走指定的解析，直接连接，达到加速国内站点的目的。

```bash
mkdir -p /etc/scripts && cd /etc/scripts

# 下载国内域名列表的生成脚本
curl -L -o generate_dnsmasq_chinalist.sh https://github.com/cokebar/openwrt-scripts/raw/master/generate_dnsmasq_chinalist.sh

chmod +x generate_dnsmasq_chinalist.sh

# 生成 dnsmasq 配置
sh generate_dnsmasq_chinalist.sh -d 114.114.114.114 -p 53 -s chinalist -o /etc/dnsmasq.d/accelerated-domains.china.conf

# 重启 dnsmasq 
service dnsmasq restart
```

登录路由器的管理界面，设置 dnsmasq 的转发服务器为`dnscrypt-proxy`的地址

![dnsmasq转发服务器](/images/dnsmasq-dnscrypt-proxy.png)

同时，忽略解析文件。

![dnsmasq ignore resolv](/images/dnsmasq-ignore-resolv.png)


保存并应用后，dnsmasq 就配置好了。

# 配置 iptables

在 `System > Startup > Local Startup` 中，添加开机启动脚本。

```bash
iptables -t nat -N clash

# 局域网IP地址直连
iptables -t nat -A clash -d 0.0.0.0/8 -j RETURN
iptables -t nat -A clash -d 10.0.0.0/8 -j RETURN
iptables -t nat -A clash -d 127.0.0.0/8 -j RETURN
iptables -t nat -A clash -d 169.254.0.0/16 -j RETURN
iptables -t nat -A clash -d 172.16.0.0/12 -j RETURN
iptables -t nat -A clash -d 192.168.0.0/16 -j RETURN
iptables -t nat -A clash -d 224.0.0.0/4 -j RETURN
iptables -t nat -A clash -d 240.0.0.0/4 -j RETURN

# 清空 ipset 集合
ipset destroy
ipset create chinalist hash:net

# 国内IP地址直连
iptables -t nat -A clash -m set --match-set chinalist dst -j RETURN

# 其他流量走 clash 代理
nft add rule ip nat clash ip protocol tcp counter redirect to :7892

iptables -t nat -A PREROUTING -p tcp -j clash
```

重启路由器

```bash
reboot
```

至此，我们已经实现了科学上网。

# Linux上额外的配置

## systemd-resolved(8)

使用了[systemd-resolved](https://wiki.archlinux.org/title/systemd-resolved)的**Linux**发行版，还需要额外的配置。设置`resolv.conf`直接使用路由器提供的DNS

```bash
ln -rsf /run/systemd/resolve/resolv.conf /etc/resolv.conf
```

## domain-based DNS routing

当我们有私有域名需要根据域名来选择DNS服务器，例如VPN、kubernetes等，我们可以通过设置`systemd-networkd`来实现

对于`nodelocaldns`可以如下设置：

```bash
cat >> /etc/systemd/network/nodelocaldns.network <<'EOF'
[Match]
Name=nodelocaldns

[Network]
DNS=169.254.25.10
Domains=~cluster.local
EOF

systemctl restart systemd-networkd
```

验证解析状态

```bash

$ resolvectl dns
Global: 192.168.1.1
Link 2 (enp4s0):
Link 3 (enp0s31f6): 192.168.1.1
Link 4 (nodelocaldns): 169.254.25.10

$ resolvectl domain
Global:
Link 2 (enp4s0):
Link 3 (enp0s31f6):
Link 4 (nodelocaldns): ~cluster.local
```

至此，kubernetes里的域名、科学上网都可以访问了