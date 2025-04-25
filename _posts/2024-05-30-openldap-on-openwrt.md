---
layout: post
title: Running openldap server on openwrt
date: 2024-05-30
tags: [openwrt, openldap]
comments: true
---

I plan to employ LDAP as the authentication backend system for my personal Kubernetes cluster. The idea of running an OpenLDAP server on an OpenWRT router appears quite feasible to me.

# Install openldap server

Simply use opkg to install the OpenLDAP server.

```bash
opkg update
opkg install openldap-server openldap-utils
```

By modifying the configuration file /etc/openldap/slapd.conf, using my own domain name as LDAP DN. Also use `slappasswd` to create an encrypted password for rootdn.


```conf
...
include         /etc/openldap/schema/core.schema
include         /etc/openldap/schema/cosine.schema
include         /etc/openldap/schema/inetorgperson.schema
include         /etc/openldap/schema/nis.schema
...
database        mdb                                                    
maxsize         8388608                          
suffix          "dc=amyinfo,dc=com"                                    
rootdn          "cn=admin,dc=amyinfo,dc=com"
rootpw          {SSHA}46xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

# Add the admin role for my orgnazation

Create a LDIF file named `start.ldif` that includes the organization and manager.

```
dn: dc=amyinfo,dc=com
objectclass: dcObject
objectclass: organization
o: amyinfo.com
dc: amyinfo

dn: cn=Manager,dc=amyinfo,dc=com
objectclass: organizationalRole
objectclass: simpleSecurityObject
cn: Manager
userPassword: {SSHA}xxxxxxxxxxxxxxxxxxx

dn: ou=devops,dc=amyinfo,dc=com
objectclass: top
objectclass: organizationalUnit
ou: devops
```

Then, run ldapadd(1) to insert these entries into the directory.

```bash
ldapadd -x -H ldapi:/// -D "cn=admin,dc=amyinfo,dc=com" -W -f start.ldif
```

# Create a user for testing purpose

Use `slappasswd` to create the password.

```
dn: uid=alice,ou=devops,dc=amyinfo,dc=com
objectClass: inetOrgPerson
objectClass: person
objectClass: posixAccount
objectClass: top
uid: alice
cn: alice
sn: alice
displayName: Alice
loginShell: /bin/bash
uidNumber: 2000
gidNumber: 2000
homeDirectory: /home/alice
mail: alice@gmail.com
telephonenumber: 13800138000
userPassword: {SSHA}xxxxxxxxxxxxxxxxxx
```

Add this user to the LDAP server

```bash
ldapadd -x -H ldapi:/// -D "cn=admin,dc=amyinfo,dc=com" -vvvv -W -f alice.ldif
```

Fetch information from `dc=amyinfo,dc=com`

```bash
ldapsearch -x -W -D "cn=Manager,dc=amyinfo,dc=com" -H ldapi:/// -b "dc=amyinfo,dc=com"
```