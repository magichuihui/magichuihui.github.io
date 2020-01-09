---
layout: post
title: CentOS6.5部署VPN管理系统（Strongswan + letsencrypt + Freeradius + MySQL + Daloradius)
date: 2018-03-19
---

CentOS6.5部署VPN管理系统
=============================================

## 一、环境及使用的软件介绍

* OS: CentOS release 6.5 (Final)
* domain: vpn.example.com（请自行替换）
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

这里我们使用certbot来安装letsencrypt证书，因为CentOS6没有certbot包，所以需要下载安装 certbot-auto 脚本

```bash
wget  https://dl.eff.org/certbot-auto
chmod a+x certbot-auto
mv certbot-auto /usr/bin/
```

在nginx上建一个域名为vpn.example.com的站点，重启nginx使之生效

```nginx
# vpn.conf
server {
    listen 80;
    server_name vpn.example.com;
    
    # 此目录需要与 certbot 命令的参数一致
    location / {
        root /var/www/vpn;
    }
}
```
certbot-auto 更新证书

```bash
certbot-auto certonly --webroot -w /var/www/vpn -d vpn.example.com

# certbot 自动更新证书
echo "0 0,12 * * * root python -c 'import random; import time; 
    time.sleep(random.random() * 3600)' && /usr/bin/certbot-auto renew" \
    >> /etc/crontab

# 证书更新以后需要重启strongswan，在strongswan 的deploy hook中加上相应脚本
echo -e '#!/bin/bash\nipsec status' >> /etc/letsencrypt/renewal-hooks/deploy/strongswan.sh
chomd a+x /etc/letsencrypt/renewal-hooks/deploy/strongswan.sh
```

### 5. 为strongswan准备证书

```bash
ln -s /etc/letsencrypt/live/vpn.example.com/fullchain.pem /etc/strongswan/ipsec.d/certs/
ln -s /etc/letsencrypt/live/vpn.example.com/privkey.pem /etc/strongswan/ipsec.d/private/
ln -s /etc/letsencrypt/live/vpn.example.com/chain.pem /etc/strongswan/ipsec.d/cacerts/

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
    leftid=@vpn.example.com
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

vpn.example.com : RSA privkey.pem
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

安装过程请参考daloradius的[GitHub](https://github.com/lirantal/daloradius)

### 1. 限制用户每天的登陆时间

```bash
vim /etc/raddb/radiusd.conf
    #将747行取消注释
    $INCLUDE sql/mysql/counter.conf
```

```bash
vim /etc/raddb/sql/mysql/counter.conf

# 把60-63行的sql语句注释并添加
#   query = "SELECT SUM(acctsessiontime - \
#                 GREATEST((%b - UNIX_TIMESTAMP(acctstarttime)), 0)) \
#                 FROM radacct WHERE username = '%{%k}' AND \
#                 UNIX_TIMESTAMP(acctstarttime) + acctsessiontime > '%b'"
    query = "SELECT IFNULL(SUM(acctsessiontime - \
                  GREATEST((%b - UNIX_TIMESTAMP(acctstarttime)), 0)),0) \
                  FROM radacct WHERE username = '%{%k}' AND \
                  UNIX_TIMESTAMP(acctstarttime) + acctsessiontime > '%b'"
```

```
vim /etc/raddb/sites-available/default

authorize {
    ...
    # 注释掉192行
    # daily
    # 在下面添加
    dailycounter
    # 在462行左右的 post-auth 节内添加
    post-auth {
        if(control:Auth-Type =~ /.*AP/){
            update reply {
                Reply-Message := "Hello %{User-Name} !"
                Reply-Message := "Regexp match for %{0}"
            }
        }
    }
}
```

```
vim /etc/raddb/dictionary

# 添加以下属性
ATTRIBUTE   Daily-Session-Time      3000    integer
ATTRIBUTE   Max-Daily-Session       3001    integer
```

在mysql中创建相应的策略

```
mysql -uradius -p

mysql> USE radius;
mysql> TRUNCATE TABLE radacct;
mysql> INSERT INTO radgroupcheck (groupname , attribute , op , value ) \
VALUES ('user', 'Max-Daily-Session', ':=', '43200'); # 43200 seconds is 12h
mysql> INSERT INTO radgroupcheck (groupname , attribute , op , value ) \
VALUES ('user', 'Login-Time', ':=', 'Al0001-2359');
```

### 2. 限制用每天、每月的流量

```
# vim /etc/raddb/sql/mysql/counter.conf
    
#在最后添加以下：
sqlcounter dailytrafficcounter {
    counter-name = Daily-Traffic
    check-name = Max-Daily-Traffic
    reply-name = Daily-Traffic-Limit
    sqlmod-inst = sql
    key = User-Name
    reset = daily
    query = "SELECT (SUM(AcctInputOctets + AcctOutputOctets)) FROM radacct WHERE UserName='%{%k}' AND UNIX_TIMESTAMP(AcctStartTime) > '%b'"
}

sqlcounter monthlytrafficcounter {
    counter-name = Monthly-Traffic
    check-name = Max-Monthly-Traffic
    reply-name = Monthly-Traffic-Limit
    sqlmod-inst = sql
    key = User-Name
    reset = monthly
    query = "SELECT (SUM(AcctInputOctets + AcctOutputOctets)) FROM radacct WHERE UserName='%{%k}' AND UNIX_TIMESTAMP(AcctStartTime) > '%b'"
}

```

```
# vim /etc/raddb/dictionary

# 添加
ATTRIBUTE   Max-Daily-Traffic       3002    integer
ATTRIBUTE   Daily-Traffic-Limit     3003    integer
ATTRIBUTE   Max-Monthly-Traffic     3004    integer
ATTRIBUTE   Monthly-Traffic-Limit   3005    integer
```

```
# vi /etc/raddb/sites-available/default

# 在193行下面添加
dailytrafficcounter
monthlytrafficcounter
```

在MySQL中添加相关策略

```
# mysql -uroot -p

mysql> USE radius;
mysql> TRUNCATE TABLE radacct;
mysql> INSERT INTO radgroupcheck (groupname , attribute , op , value ) \
VALUES ('user', 'Max-Monthly-Traffic', ':=', '10737418240'); 
# 10737418240 bytes = 10*1024*1024*1024 bytes=10 Gbyte, 
# 填写时以byte为单位 每月最大流量10G
mysql> INSERT INTO radgroupcheck (groupname , attribute , op , value ) \
VALUES ('user', 'Max-Daily-Traffic', ':=', '1073741824'); 
# 1073741824 bytes=1024*1024*1024 = 1 Gbyte 每天最大流量为1G

# service radiusd restart
```

至此，基于radius验证的，使用 Let's Encrypt 作为证书的 VPN 已经部署完毕


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
    right=vpn.example.com
    rightid=vpn.example.com
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
