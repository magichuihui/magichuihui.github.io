---
layout: post
title: Ansible部署Nagios监控系统
date: 2017-11-06
---

Ansible部署Nagios监控系统
=============================================

## 我们要实现的

为了实现系统高度可用，以及在出现故障的时候能够分析可能的原因，我们需要对线上服务器的资源，如CPU，硬盘内存及网络等进行监控，也要确保MySQL，Nginx，redis等服务能够正常访问。这里我们基于Nagios搭建一套监控系统来实现以上功能。

简单介绍一下用到的开源软件：

* **Nagios**是一款开源的系统和网络监视工具，能有效监控Linux和Windows的主机状态，交换机路由器等网络设置等。并在系统或服务状态异常时发出邮件或短信报警，在状态恢复后发出正常的邮件或短信通知。
* **Ansible**是自动化运维工具，可以配置系统，部署软件等。它不需要服务器端也不用客户端，这个特性比较重要。
* **InfluxDB**是一个分布式的时序数据库,提供HTTP API接口跟SQL-like查询。
* **Grafana**是一个开源的可视化平台，具有功能齐全的度量仪表盘和图形编辑器，有灵活丰富的图形化选项，可以混合多种风格，支持多个数据源。
* **Slack**团队协作工具，这里用来接受Nagios报警信息。

在此监控系统中，我们使用Nagios来获取监控信息数据，由于rrdtool的历史数据精度不够，采用influxdb来存储数据，然后使用grafana展示数据。Nagios的报警信息发送到slack的频道，slack支持订阅消息。

## Nagios服务

具体安装过程可以参考[官方文档][1]，不再赘述。
Nagios系统在结构上可分为核心，插件及NRPE扩展3个部分，其中核心部分提供调度任务，在事件发生后发送报警信息等基础功能，而具体地监控某一资源需要安装相应的插件，如check_cpu, check_disk等等（[点此下载](https://www.nagios.org/downloads/nagios-plugins/)）。
NRPE扩展安装在被监控主机上来收集监控信息，它由两部分组成：安装在Nagios服务器上的check_nrpe插件及运行与被监控主机的NRPE daemon。

当Naigos监控远程主机的资源时，工作流程如下：

* Nagios 会运行 `check_nrpe` 这个插件，并且告诉它需要检查什么（即运行哪个插件）
* `check_nrpe` 插件会与远程的 NRPE daemon通讯
* NRPE daemon 会运行相应的 Nagios 插件来执行检查动作
* NPRE daemon 将检查的结果返回给 check_nrpe 插件，插件将其返回给 Nagios 做处理。

NRPE 结构图:

![NRPE结构图](/images/nrpe.png)

#### 安装与配置

在服务器端需要安装Nagios Core，Plugins以及NRPE，被监控主机也就是客户端需要安装Nagios Plugins跟NRPE。具体安装过程可以参考[官方文档][1]，不再赘述。

默认的源码安装会在 `/usr/local/nagios` 下生成一下目录：

| 目录名称 | 作用 |
| -------- | :--: |
| bin | Nagios 可执行程序所在目录 |
| etc | Nagios 配置文件目录 |
| share | Nagios Web界面存放路径 |
| libexec | Nagios 外部插件存放目录 |
| var | Nagios 日志文件、Lock 等文件所在的目录 |
| var/archives | Nagios 日志自动归档目录 |
| var/rw | 用来存放外部命令文件的目录 |




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
