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

By modifying the configuration file /etc/openldap/slapd.conf, using my own domain name as LDAP DN. And I have create new ACL policies to allow importing ldif files via ldapi unix socket in the router without requiring password for rootdn. Also use `slappasswd` to create an encrypted password for rootdn.


```conf
...
include         /etc/openldap/schema/core.schema
include         /etc/openldap/schema/cosine.schema
include         /etc/openldap/schema/inetorgperson.schema
include         /etc/openldap/schema/nis.schema

access to * 
    by dn.exact="gidNumber=0+uidNumber=0,cn=peercred,cn=external,cn=auth" manage
    by * break

access to attrs=userPassword,shadowLastChange
    by self write
    by dn="cn=admin,dc=amyinfo,dc=com" write
    by dn="cn=Manager,dc=amyinfo,dc=com" write
    by anonymous auth 
    by * none

access to * 
    by self read
    by dn="cn=admin,dc=amyinfo,dc=com" write
    by dn="cn=Manager,dc=amyinfo,dc=com" write
    by * none

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
userPassword: {SSHA}xxxxxxxxxxxxxxxxxxxxx

dn: ou=devops,dc=amyinfo,dc=com
objectclass: top
objectclass: organizationalUnit
ou: devops

dn: ou=groups,dc=amyinfo,dc=com
objectclass: top
objectclass: organizationalUnit
ou: groups

dn: cn=developers,ou=groups,dc=amyinfo,dc=com
memberUid: kyra
memberUid: alice
gidNumber: 1000
objectClass: posixGroup
objectClass: top
cn: developers

dn: cn=sre,ou=groups,dc=amyinfo,dc=com
memberUid: kyra
gidNumber: 1001
objectClass: posixGroup
objectClass: top
cn: sre

dn: cn=qa,ou=groups,dc=amyinfo,dc=com
memberUid: alice
gidNumber: 1002
objectClass: posixGroup
objectClass: top
cn: qa
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
userPassword: {SSHA}xxxxxxxxxxxxxxxxxxx

Add this user to the LDAP server

```bash
ldapadd -x -H ldapi:/// -D "cn=admin,dc=amyinfo,dc=com" -vvvv -W -f alice.ldif
```

Fetch information from `dc=amyinfo,dc=com`

```bash
ldapsearch -x -W -D "cn=Manager,dc=amyinfo,dc=com" -H ldapi:/// -b "dc=amyinfo,dc=com"

# Fetch groups of Alice
ldapsearch -x -W -D "cn=Manager,dc=amyinfo,dc=com" -H ldapi:/// -b "ou=groups,dc=amyinfo,dc=com" "(&(objectClass=posixGroup) (memberUid=alice))"
```