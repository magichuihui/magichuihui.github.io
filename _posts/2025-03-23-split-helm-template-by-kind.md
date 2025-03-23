---
layout: post
title: Export Helm Chart to kubernetes manifests
excerpt: Split Helm template to separate files
date: 2025-03-23
tags: [kubernetes, helm]
comments: true
---

It's very convenient to use `helm template` to generate kubernetes manifests of your helm chart, for debugging purpose. But sometimes you might want to split those manifests to separate files according to its own kind.

## Split manifests

Here is a solution which don't require to install `jq`, `yq` or other tools, just use `sed` and `awk`.

```bash
#!/bin/bash

set -ex

# store all resources in a single file
cat >all.yaml

# create a directory to store the split resources
mkdir -p manifests

# use \n---\n as the separator of awk
sed -i 's/^---$/\n---\n/g' all.yaml # replace all --- lines with \n---\n
sed -i '1s/^/\n---\n/' all.yaml     # make sure the first line starts with \n---\n
sed -i '/^[[:space:]]*$/d' all.yaml # remove all empty lines

# split resources into files by k8s kind
awk '
BEGIN { RS = "\n---\n"; idx = 0 }       # define record separator
$0 ~ /kind:/ {                          # only process lines with "kind:"
  kind = ""
  if (match($0, /kind:[[:space:]]*([^[:space:]]+)/, arr)) {
    kind = tolower(arr[1])
    filename = "manifests/" kind ".yaml"
    if (system("test -f " filename) == 0) {
      print "---" >> filename           # add YAML separator
    }
    print $0 >> filename
    close(filename)
  }
}
' all.yaml

# Cleanup
rm -f all.yaml
```

## Usage

Just redirect the output of `helm template` to the above script, all k8s resources will be generated into a directory named `manifests`.

```bash
helm template vault hashicorp/vault  | sh split-helm-template.sh
```

The struct of the directory:

```
├── manifests
│   ├── clusterrolebinding.yaml
│   ├── clusterrole.yaml
│   ├── configmap.yaml
│   ├── deployment.yaml
│   ├── mutatingwebhookconfiguration.yaml
│   ├── pod.yaml
│   ├── serviceaccount.yaml
│   ├── service.yaml
│   └── statefulset.yaml
└── split-helm-template.sh
```