#!/bin/bash

vault server -dev -dev-root-token-id root &> /dev/null &

export VAULT_ADDR=http://127.0.0.1:8200
export VAULT_TOKEN=root

export OPENLDAP_URL=192.168.1.1:389


# 1. Enable LDAP secret engine
vault secrets enable ldap

vault write ldap/config \
    binddn=cn=Manager,dc=amyinfo,dc=com \
    bindpass=$OPENLDAP_MANAGER_PASSWORD \
    userdn=ou=devops,dc=amyinfo,dc=com \
    url=ldap://$OPENLDAP_URL                 

# 2. Rotate the LDAP manager password
#vault write -f ldap/rotate-root

# 3. Create a role that maps a name in Vault to an entry in OpenLDAP.
vault write ldap/static-role/qa \
    dn='uid=alice,ou=devops,dc=amyinfo,dc=com' \
    username='alice' \
    rotation_period="24h"

# 4. Request OpenLDAP credentials
vault read ldap/static-cred/qa

# Generate another credential for alice
LDAP_PASSWORD=$(vault read --format=json ldap/static-cred/qa | jq -r ".data.password")

ldapsearch -b "uid=alice,ou=devops,dc=amyinfo,dc=com" \
    -D 'uid=alice,ou=devops,dc=amyinfo,dc=com' \
    -w $LDAP_PASSWORD \
    -H ldap://$OPENLDAP_URL


# 5. Create a set of service accounts for check-out

# Create some service accounts in OpenLDAP for test
cat <<EOF | ldapadd -x -D "cn=Manager,dc=amyinfo,dc=com" -w $OPENLDAP_MANAGER_PASSWORD
dn: cn=fizz@amyinfo.com,ou=devops,dc=amyinfo,dc=com
objectClass: top
objectClass: person
cn: fizz@amyinfo.com
sn: Service Account for fizz
description: Service account for devops-team
userPassword: {SSHA}initial_password_hash

dn: cn=buzz@amyinfo.com,ou=devops,dc=amyinfo,dc=com
objectClass: top
objectClass: person
cn: buzz@amyinfo.com
sn: Service Account for buzz
description: Service account for devops-team
userPassword: {SSHA}initial_password_hash
EOF

vault write ldap/library/devops-team \
    service_account_names=fizz@amyinfo.com,buzz@amyinfo.com \
    ttl=10h \
    max_ttl=20h \
    disable_check_in_enforcement=false

# Check status of these service accounts
vault read ldap/library/devops-team/status
# Check out a service account
vault write ldap/library/devops-team/check-out ttl=30m

# Check in
vault write ldap/library/devops-team/check-in service_account_names=fizz@amyinfo.com