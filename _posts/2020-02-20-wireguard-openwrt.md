---
layout: post
title: Wireguard连接云服务器与OpenWrt
excerpt: Wireguard连接云服务器与OpenWrt
date: 2020-02-20
tags: [OpenWrt, vpn]
comments: true
---

公司里原来使用`Strongswan`作VPN连接云服务器与公司内网，想要换成更加轻量级的`Wireguard`。先在家里的路由器上试一下吧。

## 开始之前

* 服务器OS： CentOS 7
* 路由器OS： OpenWrt 19.07.1

## 服务器上安装Wireguard

首先更新系统内核，这里要确保`kernel`与`kernel-header`是同一个版本，我更新了kernel跟kernel-header，执行`modprobe wireguard`仍然报错`Module wireguard not found`,无法加载wireguard。Google也没有找到解决办法，直接完全更新后竟然可以用了

```bash
$ sudo yum update -y
```

按照官方网站上的方法安装Wireguard

```bash
$ sudo yum install https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm
$ sudo curl -o /etc/yum.repos.d/jdoss-wireguard-epel-7.repo https://copr.fedorainfracloud.org/coprs/jdoss/wireguard/repo/epel-7/jdoss-wireguard-epel-7.repo
$ sudo yum install wireguard-dkms wireguard-tools
```

检查是否安装成功

```bash
$ sudo modprobe wireguard
# 查看是否成功
$ sudo lsmod | grep wireguard
```

## 服务器上配置Wireguard

安装成功之后我们在服务器上配置Wireguard, 以下操作都使用root账户

1. 生成Wireguard密钥

    ```bash
umask 077
mkdir -p /etc/wireguard/ssl && cd /etc/wireguard/ssl
wg genkey | tee privatekey | wg pubkey > publickey
# 下面需要使用这里生成的密钥
cat privatekey publickey
cd ..
    ```

2. 创建配置文件 `/etc/wireguard/wg0.conf`，内容如下所示。用刚刚生成的私钥替换`<Private Key>`，IP地址可以按需更换。

    ```conf
[Interface]
Address = 10.14.0.1/24
SaveConfig = true
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE;
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE;
ListenPort = 51820
PrivateKey = <Private Key>
    ```

我们的服务器没有使用系统防火墙，所以如果你可能需要自行开放51820的UDP端口

## 启动Wireguard服务

1. 启动Wireguard

    ```bash
wg-quick up wg0
    ```

2. 开机自动启动

    ```bash
systemctl enable wg-quick@wg0
    ```

3. 查看Wireguard运行状态

    ```bash
wg show
    ```

会看见如下输出：
```
[root@VM_123_123_centos ~]# wg show
interface: wg0
  public key: +/VeIJIW9+GT7SxQ5XCdyPsvNiTtBBLFlKuGqCAM3Dw=
  private key: (hidden)
  listening port: 51820
```

```bash
ifconfig wg0
```

新增的网络接口
```
[root@VM_123_123_centos ~]# ifconfig wg0
wg0: flags=209<UP,POINTOPOINT,RUNNING,NOARP>  mtu 1420
        inet 10.14.0.1  netmask 255.255.255.0  destination 10.14.0.1
        unspec 00-00-00-00-00-00-00-00-00-00-00-00-00-00-00-00  txqueuelen 1000  (UNSPEC)
        RX packets 13314  bytes 2263368 (2.1 MiB)
        RX errors 1809  dropped 6  overruns 0  frame 1809
        TX packets 25463  bytes 19192484 (18.3 MiB)
        TX errors 0  dropped 337 overruns 0  carrier 0  collisions 0

```

## OpenWrt上安装

1. 首先可以将opkg源替换为国内源`mirrors.ustc.edu.cn/lede/`

    ```bash
opkg update
opkg install luci-proto-wireguard luci-app-wireguard wireguard kmod-wireguard wireguard-tools
# module not found udp_tunnel
opkg install kmod-udptunnel4
reboot
    ```


2. 生成Wireguard密钥， 跟服务器上操作一样

    ```bash
umask 077
mkdir -p /etc/wireguard/ssl && cd /etc/wireguard/ssl
wg genkey | tee privatekey | wg pubkey > publickey
# 下面需要使用这里生成的密钥
cat privatekey publickey
cd ..
    ```

3. 设置Wireguard接口

    * 登录LuCI，打开 `Netowrk>Interfaces>Add new interface`
    * 将新接口的名字也设置为wg0
    * 协议选择 `WireGuard VPN`, 确认
    * 复制上面生成privatekey到`Private Key`栏
    * 在`IP Addresses`栏添加 `10.14.0.2/24`
    * 在`Firewall Settings`里把新接口wg0添加到`lan Zone`
    * 保存并应用

## 连接OpenWrt与服务器

1. 服务器上的设置

    ```bash
wg-quick down wg0
echo "
[Peer]
PublicKey = <OpenWrt's publickey>
AllowedIPs = 10.14.0.0/24
PersistentKeepalive = 25
" >> /etc/wireguard/wg0.conf
wg-quick up wg0
    ```

用OpenWrt上生成publickey替换`<OpenWrt's publickey>`

2. OpenWrt上的设置

    * LuCI中打开 `Network>Interfaces>WG0>Edit>Peers>Add peer`
    * `Public Key`栏填在服务器上生成的 publickey
    * `Allow IPs`栏填上`10.14.0.0/24`，以及服务器端的内网网段（例如：10.104.0.0/16)
    * 选上`Route Allowed IPs`，否则不能自动生成路由
    * `Endpoint Host`是服务器的公网IP
    * `Endpoint Port`是服务器上配置的`ListenPort`（即51820）
    * `Persistent Keep Alive`填25
    * 保存并应用

重启路由器或者网络
```bash
service network restart
```

## OpenWrt防火墙设置

到此在OpenWrt上已经能够访问服务器的网络，下面需要设置防火墙让我们局域网里面的机器可以访问服务器

LuCI中打开`Network>Firewall>NAT Rules>Add`，添加如下设置

> Destination address: 10.104.0.0/16  
> Action: MASQUERADE  
> Outbound device: wg0  

保存并应用，然后在电脑试试吧