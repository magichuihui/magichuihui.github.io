---
layout: post
title: Elasticsearch的维护
excerpt: elasticsearch maintenance
date: 2023-03-04
tags: [elasticsearch]
comments: true
---

# 1. 定期维护

Elasticsearch Curator 是 Elasticsearch 的索引助手，这里我们使用它来定期删除过期日志。

curator可以通过kubernetes cronjob定期运行，也可以直接运行在elasticsearch的机器上

## 1.1 curator 配置

### 1.1.1 Usage

通过crontab或者cronjob定期执行脚本实现清理日志

```bash
curator --config config.yaml actions.yaml
```

我们通过在actions.yaml设置delete_indices来删除过期不用的日志。

### 1.1.2 config.yaml

```yaml
---
client:
  hosts:
    - 127.0.0.1
  port: 9200
  url_prefix:
  use_ssl: False
  certificate:
  client_cert:
  client_key:
  ssl_no_validate: False
  username:
  password:
  timeout: 30
  master_only: False

logging:
  loglevel: INFO
  logfile:
  logformat: default
  blacklist: ['elasticsearch', 'urllib3']
```

## 1.2 清理日志

### 1.2.1 actions.yaml

filtertype有多种类型，这里我们通过结合pattern跟age，删除kubernetes里产生的、超过3
个月的java日志

```yaml
---
actions:
  1:
    action: delete_indices
    description: >-
      Delete indices older than 90 days (based on index name).
    options:
      ignore_empty_list: True
    filters:
    - filtertype: pattern
      kind: prefix
      value: java-
    - filtertype: age
      source: name
      direction: older
      timestring: '%Y.%m.%d'
      unit: months
      unit_count: 3
```

## 1.3 TODO: 索引合并 

使用curator redindex将形如：iob-battery-index2022-11-22的索引按月合并，合并到哪个索引？？？

### 1.3.1 actions.yaml

```yaml
actions:
  1:
    description: >-
      Reindex all daily logstash indices from last month into ?
    action: reindex
    options:
      wait_interval: 9
      max_wait: -1
      request_body:
        source:
          index: REINDEX_SELECTION
        dest:
          index: ?
    filters:
    - filtertype: pattern
      kind: prefix
      value: iob-battery-index
    - filtertype: period
      period_type: relative
      source: name
      range_from: -1
      range_to: -1
      timestring: '%Y-%m-%d'
      unit: months
```

# 2. TODO: 冷热分离 

结合index lifecycle mangement及index template，实现索引数据冷热分离，降低资源使用率

## 2.1 维护储存日志的索引

创建ILM策略实现：
  - 每天或者达到10GBrollover一次（对logstash非必要）
  - 30天后缩成1个分片,合并索引,并且增加副本
  - 60天后转移到冷数据节点（没有 so, require可以去掉了）
  - 90天后删除数据

### 2.1.1 创建ILM策略

```json
PUT /_ilm/policy/log_policy
{
  "policy": {
    "phases": {
      "hot": {
        "actions": {
          "rollover": {
            "max_age": "1d",
            "max_size": "10G"
          }
        }
      },
      "warm": {
        "min_age": "30d",
        "actions": {
          "forcemerge": {
            "max_num_segments": 1
          },
          "shrink": {
            "number_of_shards": 1
          },
          "allocate": {
            "number_of_replicas": 2
          }
        }
      },
      "cold": {
        "min_age": "60d",
        "actions": {
          "allocate": {
            "require": {
              "box_type": "cold"
            }
          }
        }
      },
      "delete": {
        "min_age": "90d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}
```

### 2.1.2 创建Index Template

```json
PUT /_index_template/log-test
{
  "index_patterns": ["log-test-*"], 
  "template": {
    "settings": {
      "number_of_shards": 5,
      "number_of_replicas": 1,
      "index.lifecycle.name": "log_policy", 
      "index.lifecycle.rollover_alias": "log-test"
    }
  } 
}
```

# 3. TODO: 报警

根据收集的应用日志，通过自定义规则实现报警功能

ElasticAlert

# Reference

* [ILM: Manage the index lifecycle | Elasticsearch Guide [8.6] | Elastic][1]
* [Curator Reference [5.7] | Elastic][2]

[1]: https://www.elastic.co/guide/en/elasticsearch/reference/current/index-lifecycle-management.html
[2]: https://www.elastic.co/guide/en/elasticsearch/client/curator/5.7/index.html
