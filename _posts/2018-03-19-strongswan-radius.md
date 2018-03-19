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

按转Strongswan并使用letsencrypt提供的免费证书

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

### 4. 配置letsencrypt

使用certbot来安装letsencrypt证书，因为CentOS6没有certbot包，所以我们要去下载安装certbot-auto 脚本

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

### 5. 为strongswan配置证书

```bash
ln -s /etc/letsencrypt/live/vpn.baiyang.com/fullchain.pem /etc/strongswan/ipsec.d/certs/
ln -s /etc/letsencrypt/live/vpn.baiyang.com/privkey.pem /etc/strongswan/ipsec.d/private/
ln -s /etc/letsencrypt/live/vpn.baiyang.com/chain.pem /etc/strongswan/ipsec.d/cacerts/

# 我们还需要提供let's encrypt 的中级证书
wget https://letsencrypt.org/certs/lets-encrypt-x3-cross-signed.pem -O \
/etc/strongswan/ipsec.d/cacerts/lets-encrypt-x3-cross-signed.pem
```


