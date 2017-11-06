---
layout:post
title: Nagios + Ansible
date: 2017-11-06
---

Ansible部署Nagios监控系统
=============================================

## 我们要实现的

为了实现系统高度可用，以及在出现故障的时候能够分析可能的原因，我们需要对线上服务器的资源，如CPU，硬盘内存及网络等进行监控，也要确保MySQL，Nginx，redis等服务能够正常访问。这里我们基于Nagios搭建一套监控系统来实现以上功能。

简单介绍一下用到的开源软件：

* **Nagios**是一款开源的系统和网络监视工具，能有效监控Linux和Windows的主机状态，交换机路由器等网络设置等。并在系统或服务状态异常时发出邮件或短信报警，在状态恢复后发出正常的邮件或短信通知。
* **Ansible**是自动化运维工具，可以配置系统，部署软件等。它不需要服务器端也不用客户端，这个特性比较重要。
* **InfluxDB**是一个分布式的时序数据库。
* **Grafana**是一个开源的可视化平台，具有功能齐全的度量仪表盘和图形编辑器，有灵活丰富的图形化选项，可以混合多种风格，支持多个数据源。
* **Slack**团队协作工具，这里用来接受Nagios报警信息。




## 文档

* [Nagios][1]
* [Ansible][2]
* [InfluxDB][3]
* [Grafana][4]
* [Slack][5]


[1]: https://assets.nagios.com/downloads/nagioscore/docs/nagioscore/4/en/quickstart.html#_ga=2.92539934.2061844877.1509670667-1605740700.1509670667
[2]: http://docs.ansible.com/ansible/latest/index.html
[3]: https://docs.influxdata.com/influxdb/v1.3/introduction/getting_started/
[4]: http://docs.grafana.org/installation/rpm/
[5]: https://slack.com/apps/A0F81R747-nagios
