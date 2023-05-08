---
layout: post
title: Network monitoring with Grafana and Prometheus
excerpt: monitoring h3c device with prometheus and snmp
date: 2023-05-05
tags: [prometheus, snmp]
comments: true
---

Prometheus provides an official SNMP exporter, aka [snmp_exporter](https://github.com/prometheus/snmp_exporter), which can be used for monitoring devices that support SNMP, such as switches, routers and firewalls, etc.

The below example will illustrate how to use snmp_exporter to monitor H3C ER3260G3.

# SNMP exporter

There are two main components of snmp_exporter:

* exporter: collect metrics from managed devices through SNMP, acts as a NMS;
* generator: create configurations for exporter by mapping SNMP OIDs to counters, gauges which can be understood by Prometheus;

Clone the snmp_exporter project for the further usage.

```bash
git clone https://github.com/prometheus/snmp_exporter.git
```

## generator

Simply speaking, generator is the tool parsing SNMP MIBs and creating a configuration file containing specified OIDs which are mapped to indicators of Prometheus. Then exporter queries SNMP agents for those specified OIDs and map the results as counters/gauges based on the configuration file waiting for Prometheus scrapes.

### Download h3c mibs 

First, We can find H3C mibs in this site, https://www.h3c.com/en/Products_and_Solutions/InterConnect/Operating_System/Comware_V7/MIB/MIB/201808/1106576_748048_0.htm, we need to put all of these files to `generator/mibs` of the above snmp_exporter directory.

### generator.yml

```bash
cd generator
```

Then create our `generator.yml` to overwrite the original one.

```yaml
# generator.yml
modules:
  # H3C.
  h3c:
    walk:
      - sysUpTime
      - interfaces
      - ifXTable
      - 1.3.6.1.2.1.1.1                     #sysDescr
      - 1.3.6.1.2.1.1.3                     #sysUpTime
      - 1.3.6.1.2.1.1.5                     #sysName
      - 1.3.6.1.2.1.2.2.1.1                 #ifIndex
      - 1.3.6.1.2.1.2.2.1.2                 #IfDescr
      - 1.3.6.1.2.1.2.2.1.8                 #ifOperStatus
      - 1.3.6.1.2.1.4.20.1.1                #ipAdEntAddr
      - 1.3.6.1.2.1.31.1.1.1.1              #ifName
      - 1.3.6.1.2.1.31.1.1.1.6              #ifHCInOctets
      - 1.3.6.1.2.1.31.1.1.1.10             #ifHCOutOctets
      - 1.3.6.1.2.1.47.1.1.1.1.2            #entPhysicalDescr
      - 1.3.6.1.2.1.47.1.1.1.1.5            #entPhysicalClass
      - 1.3.6.1.2.1.47.1.1.1.1.7            #entPhysicalName
      - 1.3.6.1.4.1.25506.2.6.1.1.1.1.6     #hh3cEntityExtCpuUsage
      - 1.3.6.1.4.1.25506.2.6.1.1.1.1.8     #hh3cEntityExtMemUsage
      - 1.3.6.1.4.1.25506.2.6.1.1.1.1.12    #hh3cEntityExtTemperature
      - 1.3.6.1.4.1.25506.8.35.9.1.1.1.2    #hh3cDevMFanStatus
      - 1.3.6.1.4.1.25506.8.35.9.1.2.1.2    #hh3cDevMPowerStatus    
    version: 3
    auth:
      username: prom
    lookups:
      - source_indexes: [ifIndex]
        lookup: ifAlias
      - source_indexes: [ifIndex]
        # Uis OID to avoid conflict with PaloAlto PAN-COMMON-MIB.
        lookup: 1.3.6.1.2.1.2.2.1.2 # ifDescr
      - source_indexes: [ifIndex]
        # Use OID to avoid conflict with Netscaler NS-ROOT-MIB.
        lookup: 1.3.6.1.2.1.31.1.1.1.1 # ifName
      - source_indexes: [hh3cEntityExtPhysicalIndex]
        lookup: 1.3.6.1.2.1.47.1.1.1.1.2  #entPhysicalDescr
      - source_indexes: [hh3cEntityExtPhysicalIndex]
        lookup: 1.3.6.1.2.1.47.1.1.1.1.5  #entPhysicalClass
      - source_indexes: [hh3cEntityExtPhysicalIndex]
        lookup: 1.3.6.1.2.1.47.1.1.1.1.7  #entPhysicalName
    overrides:
      ifAlias:
        ignore: true # Lookup metric
      ifDescr:
        ignore: true # Lookup metric
      ifName:
        ignore: true # Lookup metric
      ifType:
        type: EnumAsInfo
      entPhysicalDescr:
        ignore: true # Lookup metric
      entPhysicalName:
        ignore: true # Lookup metric
      entPhysicalClass:
        ignore: true # Lookup metric
```

### Create exporter‘s configuration

```bash
make docker-generate
```

Once running the above command, the exporter configuration file **snmp.yml** will be generated.

## exporter

We will deploy snmp exporter to Kubernetes

### configmap of snmp.yml

```bash
kubectl create configmap snmp-exporter --from-file=snmp.yml -n devops
```

### the exporter

```bash
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app.amyinfo.com/instance: snmp-exporter
  name: snmp-exporter
  namespace: devops
spec:
  replicas: 1
  revisionHistoryLimit: 10
  selector:
    matchLabels:
      app.amyinfo.com/instance: snmp-exporter
  strategy:
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 25%
    type: RollingUpdate
  template:
    metadata:
      labels:
        app.amyinfo.com/instance: snmp-exporter
    spec:
      containers:
      - args:
        - --web.listen-address=:9107
        - --config.file=/snmp.yml
        image: prom/snmp-exporter:v0.21.0
        imagePullPolicy: Always
        name: snmp-exporter
        ports:
        - containerPort: 9107
          name: metrics
          protocol: TCP
        volumeMounts:
        - mountPath: /snmp.yml
          name: conf
          readOnly: true
          subPath: snmp.yml
      volumes:
      - configMap:
          defaultMode: 420
          name: snmp-exporter
        name: conf
---
apiVersion: v1
kind: Service
metadata:
  labels:
    metrics.amyinfo.com/instance: h3c
  name: snmp-exporter
  namespace: devops
spec:
  ports:
  - name: metrics
    port: 9107
    protocol: TCP
    targetPort: 9107
  selector:
    app.amyinfo.com/instance: snmp-exporter
  type: ClusterIP
EOF
```

# Prometheus

Since we are running prometheus in kubernetes, we may use `ServiceMonitor` to create the scrape job

```bash
cat << EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  labels:
    app.kubernetes.io/part-of: kube-prometheus
  name: h3c
  namespace: monitoring
spec:
  jobLabel: metrics.amyinfo.com/instance
  namespaceSelector:
    matchNames:
    - devops
  endpoints:
  - interval: 30s
    port: metrics
    params:
      module:
      - h3c
      target:
      - 192.168.1.1
    path: "/snmp"
  selector:
    matchLabels:
      metrics.amyinfo.com/instance: h3c
EOF
```

After all of this we can create a grafana dashboard to visualize network performance.