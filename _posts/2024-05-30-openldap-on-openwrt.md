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

By modifying the configuration file /etc/openldap/slapd.conf, using my own domain name as LDAP DN.

```conf
...
database        mdb                                                    
maxsize         8388608                          
suffix          "dc=amyinfo,dc=com"                                    
rootdn          "cn=Manager,dc=amyinfo,dc=com"     
```

# Add the admin role for my orgnazation

Create an LDIF file that includes the organization and manager.

```
dn: dc=amyinfo,dc=com
objectclass: dcObject
objectclass: organization
o: amyinfo.com
dc: amyinfo

dn: cn=Manager,dc=amyinfo,dc=com
objectclass: organizationalRole
cn: Manager
```

Then, run ldapadd(1) to insert these entries into the directory.

```bash
ldapadd -x -H ldapi:/// -D "cn=Manager,dc=amyinfo,dc=com" -W -f manager.ldif
```

# Create a user for testing purpose

Use `slappasswd` to create the password.

```
dn: cn=Alice,dc=amyinfo,dc=com
changetype: add
objectClass: person
objectClass: organizationalPerson
objectClass: top
cn: Alice
sn: Alice
ou: SRE
userPassword: {SSHA}xxxxxxxxxxxxxxxxxxx
```

Add this user to the LDAP server

```bash
ldapadd -x -H ldapi:/// -D "cn=Manager,dc=amyinfo,dc=com" -vvvv -W -f alice.ldif
```
