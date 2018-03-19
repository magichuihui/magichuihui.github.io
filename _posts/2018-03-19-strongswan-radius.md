---
layout: post
title: CentOS6.5部署VPN管理系统（Strongswan + letsencrypt + Freeradius + MySQL + Daloradius)
date: 2018-03-19
---

CentOS6.5部署VPN管理系统
=============================================

## 一、环境及使用的软件介绍

* OS: CentOS release 6.5 (Final)
* domain: vpn.baiyang.com（请自行替换）
* Strongswan: strongswan-5.6.2
* freeradius: freeradius-2.2.6
* MySQL: MySQL5.6
* daloradius


## 二、安装配置Strongswan + letsencrypt

安装Strongswan并使用letsencrypt提供的免费证书

### 1. 安装相关依赖

```bash
yum install pam-devel openssl-devel make gcc gmp-devel
```

### 2. 首先安装python2.7，因为centos6 默认安装的python2.6缺少必要的库

```bash
cd /usr/local/src
wget https://www.python.org/ftp/python/2.7.14/Python-2.7.14.tar.xz
tar xvf Python-2.7.14.tar.xz

cd Python-2.7.14
./configure --enable-optimizations
make altinstall

```

### 3. 下载并编译安装strongswan

```bash

wget https://download.strongswan.org/strongswan-5.6.2.tar.gz
tar zxvf strongswan-5.6.2.tar.gz

cd strongswan-*
# 更改python解释器
PYTHON=/usr/local/bin/python2.7 ./configure --prefix=/usr --sysconfdir=/etc/strongswan \
    --enable-openssl --enable-nat-transport --disable-mysql --disable-ldap \
    --disable-static --enable-shared --enable-md4 --enable-eap-mschapv2 --enable-eap-aka \
    --enable-eap-aka-3gpp2  --enable-eap-gtc --enable-eap-identity --enable-eap-md5 \
    --enable-eap-peap --enable-eap-radius --enable-eap-sim --enable-eap-sim-file \
    --enable-eap-simaka-pseudonym --enable-eap-simaka-reauth --enable-eap-simaka-sql \
    --enable-eap-tls --enable-eap-tnc --enable-eap-ttls

make && make install
```

### 4. 配置 Let's encrypt

使用certbot来安装letsencrypt证书，因为CentOS6没有certbot包，所以我们下载安装 certbot-auto 脚本

```bash
wget  https://dl.eff.org/certbot-auto
chmod a+x certbot-auto
mv certbot-auto /usr/bin/
```

在nginx上建一个域名为vpn.baiyang.com的站点，重启nginx使之生效

```nginx
# vpn.conf
server {
    listen 80;
    server_name vpn.baiyang.com;
    
    # 此目录需要与 certbot 命令的参数一致
    location / {
        root /var/www/vpn;
    }
}
```
certbot-auto 更新证书

```bash
certbot-auto certonly --webroot -w /var/www/vpn -d vpn.baiyangwang.com

# certbot 自动更新证书
echo "0 0,12 * * * root python -c 'import random; import time; 
    time.sleep(random.random() * 3600)' && /usr/bin/certbot-auto renew" \
    >> /etc/crontab
```

### 5. 为strongswan准备证书

```bash
ln -s /etc/letsencrypt/live/vpn.baiyang.com/fullchain.pem /etc/strongswan/ipsec.d/certs/
ln -s /etc/letsencrypt/live/vpn.baiyang.com/privkey.pem /etc/strongswan/ipsec.d/private/
ln -s /etc/letsencrypt/live/vpn.baiyang.com/chain.pem /etc/strongswan/ipsec.d/cacerts/

# 我们还需要提供let's encrypt 的中级证书
wget https://letsencrypt.org/certs/lets-encrypt-x3-cross-signed.pem.txt -O \
/etc/strongswan/ipsec.d/cacerts/lets-encrypt-x3-cross-signed.pem
```

### 6. 配置stongswan

a. 修改/etc/strongswan/ipsec.conf

```conf
# ipsec.conf - strongSwan IPsec configuration file
# basic configuration

config setup
    # strictcrlpolicy=yes
    # uniqueids = no
    charondebug = ike 4, cfg 3, esp 2

conn ikev2
    auto=add
    dpdaction=clear
    dpddelay=60s
    rekey=no
    fragmentation=yes
    keyexchange=ikev2

    # left - server configuration
    left=%any
    #ike=aes256-sha1-modp1024,aes128-sha1-modp1024,3des-sha1-modp1024!
    #esp=aes256-sha256,aes256-sha1,3des-sha1!
    ike=aes128-sha256-ecp256,aes256-sha384-ecp384,aes128-sha256-modp2048, \
    aes128-sha1-modp2048,aes256-sha384-modp4096,aes256-sha256-modp4096, \
    aes256-sha1-modp4096,aes128-sha256-modp1536,aes128-sha1-modp1536, \
    aes256-sha384-modp2048,aes256-sha256-modp2048,aes256-sha1-modp2048, \
    aes128-sha256-modp1024,aes128-sha1-modp1024,aes256-sha384-modp1536, \
    aes256-sha256-modp1536,aes256-sha1-modp1536,aes256-sha384-modp1024, \
    aes256-sha256-modp1024,aes256-sha1-modp1024!
    esp=aes128gcm16-ecp256,aes256gcm16-ecp384,aes128-sha256-ecp256,\
    aes256-sha384-ecp384,aes128-sha256-modp2048,aes128-sha1-modp2048,\
    aes256-sha384-modp4096,aes256-sha256-modp4096,aes256-sha1-modp4096, \
    aes128-sha256-modp1536,aes128-sha1-modp1536,aes256-sha384-modp2048, \
    aes256-sha256-modp2048,aes256-sha1-modp2048,aes128-sha256-modp1024, \
    aes128-sha1-modp1024,aes256-sha384-modp1536,aes256-sha256-modp1536, \
    aes256-sha1-modp1536,aes256-sha384-modp1024,aes256-sha256-modp1024, \
    aes256-sha1-modp1024,aes128gcm16,aes256gcm16,aes128-sha256,aes128-sha1, \
    aes256-sha384,aes256-sha256,aes256-sha1!
    leftsendcert=always
    leftcert=fullchain.pem
    leftid=@vpn.baiyang.com
    leftsubnet=%dynamic,10.0.0.0/8
    leftauth=pubkey
    lefthostaccess=yes
    leftfirewall=yes
    # right - client confguration
    rightsourceip=%dynamic,10.0.11.0/24
    rightauth=eap-mschapv2
    rightsendcert=never
    eap_identity=%any
```

b. 修改/etc/strongswan/ipsec.secrets

```bash
# ipsec.secrets - strongSwan IPsec secrets file

vpn.baiyang.com : RSA privkey.pem
test : EAP "password"
```

### 7. 配置网络转发

a. 设置ip_forward

```bash
# vim /etc/sysctl.conf

net.ipv4.ip_forward = 0
改为==>
net.ipv4.ip_forward = 1

sysctl -p
```

b. 设置iptables

```bash
iptables -t nat -A POSTROUTING -s 10.0.0.0/16 -d 10.0.0.0/8 -j MASQUERADE 
iptables -t nat -A POSTROUTING -s 10.0.0.0/8 -d 10.0.0.0/16 -j MASQUERADE 

iptables -A FORWARD -s 10.0.0.0/16 -d 10.0.0.0/8 -i eth0 -m policy --dir in --pol ipsec --reqid 1 --proto esp -j ACCEPT 
iptables -A FORWARD -s 10.0.0.0/8 -d 10.0.0.0/16 -o eth0 -m policy --dir out --pol ipsec --reqid 1 --proto esp -j ACCEPT 
```

重启ipsec `ipsec restart`，然后可以连接客户端进行测试了


## 三、部署freeradius + MySQL + daloradius

### 1. 安装freeradius

```bash
yum -y install freeradius freeradius-mysql freeradius-utils
```

### 2. 为raidus建立数据库

```mysql
CREATE DATABASE radius;
GRANT ALL PRIVILEGES ON radius.* TO 'radius'@'localhost' IDENTIFIED BY "password";
FLUSH privileges;
USE radius;
SOURCE /etc/raddb/sql/mysql/schema.sql;
SOURCE /etc/raddb/sql/mysql/cui.sql;
SOURCE /etc/raddb/sql/mysql/ippool.sql;
SOURCE /etc/raddb/sql/mysql/nas.sql;
SOURCE /etc/raddb/sql/mysql/wimax.sql;
```

### 3. 配置freeradius连接数据库

```bash
# vim /etc/raddb/sql.conf

    # Connection info:
    server = "127.0.0.1"
    port = 3306
    login = "radius"
    password = "password"
```

### 4. 配置freeradius使用sql来读取客户信息

```bash
# 启用模块
# vim /etc/raddb/radiusd.conf

# 去掉以下行前的#
    $INCLUDE sql.conf
    $INCLUDE sqlippool.conf
```

```bash
# vim /etc/raddb/sites-available/default

# 需要修改的行数及修改后的结果：例：# 001 content
# 170    #files
# 177    sql
# 396    #radutmp
# 397    sradutmp
# 406    sql
# 450    #radutmp
# 454    sql
# 475    sql
# 577    sql
```

```bash
# vim /etc/raddb/sites-available/inner-tunnel

# 125    #file
# 132    sql
# 252    #radutmp
# 256    sql
# 278    sql
# 302    sql
```

修改秘钥

```bash
# vim /etc/raddb/clients.conf

secret = thissecretisverysecret
```

### 5. 添加测试用户

```bash
# mysql -uroot -p
mysql> use radius;
mysql> insert into radcheck (username,attribute,op,value) \
values ('test','User-Password',':=','test');
```

然后以debug模式启动radius

```bash
radiusd -X
```

在另外的窗口测试：

```bash
# radtest test test 127.0.0.1 0 tencentvpn

Sending Access-Request of id 113 to 127.0.0.1 port 1812
    User-Name = "test"
    User-Password = "test"
    NAS-IP-Address = 127.0.0.1
    NAS-Port = 0
    Message-Authenticator = 0x00000000000000000000000000000000
rad_recv: Access-Accept packet from host 127.0.0.1 port 1812, id=113, length=26
```

## 四、Strongswan和Freeradius整合

### 1. 修改/etc/strongswan/strongswan.d/charon/eap-radius.conf

```bash
# vim /etc/strongswan/strongswan.d/charon/eap-radius.conf

# 开启在线人数查询
accounting = yes

accounting_close_on_timeout = yes

# 在 servers {} 中添加radius server

servers {
    primary {
        secret = thissecretisverysecret
        address = 127.0.0.1
    }
}
```

### 2. 修改/etc/strongswan/ipsec.conf

```bash
# vim /etc/strongswan/ipsec.conf

# 启用radius认证及分配IP
rightsourceip=%radius
rightauth=eap-radius
```

### 3. 重启服务

```bash
# service radiusd restart
# ipsec stop
# ipsec start --nofork
```

## 五、设置Daloradius管理用户，以及计费策略等

请参考daloradius的[GitHub](https://github.com/lirantal/daloradius)


## 六、Centos 7 上客户端的设置

安装strongswan

```bash
yum install strongswan
```

设置ipsec.conf

```conf
# ipsec.conf - strongSwan IPsec configuration file
# basic configuration
config setup
    cachecrls=yes
    strictcrlpolicy=no

conn ikev2
    keyexchange=ikev2
    ike=aes256-sha1-modp1024!
    esp=aes256-sha1!
    right=vpn.baiyang.com
    rightid=vpn.baiyang.com
    rightsubnet=10.0.0.0/8
    rightauth=pubkey

    leftsourceip=10.0.1.82
    leftsubnet=%dynamic,192.168.3.0/24
    leftauth=eap
    eap_identity=test
    auto=start
```

下载中级证书

```bash
wget https://letsencrypt.org/certs/lets-encrypt-x3-cross-signed.pem.txt -O \
/etc/strongswan/ipsec.d/cacerts/lets-encrypt-x3-cross-signed.pem
```

Lets encrypt 的根CA证书可用从 [DST ROOT CA X3](https://www.identrust.com/certificates/trustid/root-download-x3.html) 下载，并且在开头和结尾加上"-----BEGIN CERTIFICATE-----"和"-----END CERTIFICATE-----"

```bash
# cat /etc/strongswan/ipsec.d/cacerts/dst_root_ca_x3.pem 
-----BEGIN CERTIFICATE-----
MIIDSjCCAjKgAwIBAgIQRK+wgNajJ7qJMDmGLvhAazANBgkqhkiG9w0BAQUFADA/
MSQwIgYDVQQKExtEaWdpdGFsIFNpZ25hdHVyZSBUcnVzdCBDby4xFzAVBgNVBAMT
DkRTVCBSb290IENBIFgzMB4XDTAwMDkzMDIxMTIxOVoXDTIxMDkzMDE0MDExNVow
PzEkMCIGA1UEChMbRGlnaXRhbCBTaWduYXR1cmUgVHJ1c3QgQ28uMRcwFQYDVQQD
Ew5EU1QgUm9vdCBDQSBYMzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB
AN+v6ZdQCINXtMxiZfaQguzH0yxrMMpb7NnDfcdAwRgUi+DoM3ZJKuM/IUmTrE4O
rz5Iy2Xu/NMhD2XSKtkyj4zl93ewEnu1lcCJo6m67XMuegwGMoOifooUMM0RoOEq
OLl5CjH9UL2AZd+3UWODyOKIYepLYYHsUmu5ouJLGiifSKOeDNoJjj4XLh7dIN9b
xiqKqy69cK3FCxolkHRyxXtqqzTWMIn/5WgTe1QLyNau7Fqckh49ZLOMxt+/yUFw
7BZy1SbsOFU5Q9D8/RhcQPGX69Wam40dutolucbY38EVAjqr2m7xPi71XAicPNaD
aeQQmxkqtilX4+U9m5/wAl0CAwEAAaNCMEAwDwYDVR0TAQH/BAUwAwEB/zAOBgNV
HQ8BAf8EBAMCAQYwHQYDVR0OBBYEFMSnsaR7LHH62+FLkHX/xBVghYkQMA0GCSqG
SIb3DQEBBQUAA4IBAQCjGiybFwBcqR7uKGY3Or+Dxz9LwwmglSBd49lZRNI+DT69
ikugdB/OEIKcdBodfpga3csTS7MgROSR6cz8faXbauX+5v3gTt23ADq1cEmv8uXr
AvHRAosZy5Q6XkjEGB5YGV8eAlrwDPGxrancWYaLbumR9YbK+rlmM6pZW87ipxZz
R8srzJmwN0jP41ZL9c8PDHIyh8bwRLtTcm1D9SZImlJnt1ir/md2cXjbDaJWFBM5
JDGFoqgCWjBH4d1QB7wCCZAA62RjYJsWvIjJEubSfZGL+T0yjWW06XyxV3bqxbYo
Ob8VZRzI9neWagqNdwvYkQsEjgfbKbYK7p2CNTUQ
-----END CERTIFICATE-----
```

重启strongswan

```bash
service strongswan restart
```

启动连接

```bash
ipsec up ikev2
```
