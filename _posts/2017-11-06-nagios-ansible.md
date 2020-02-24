---
layout: post
title: Ansible部署Nagios监控系统
excerpt: Ansible部署Nagios监控系统
date: 2017-11-06
tags: [linux]
comments: true
---

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

Nagios系统在结构上可分为核心，插件及NRPE扩展3个部分，其中核心部分提供调度任务，在事件发生后发送报警信息等基础功能，而具体地监控某一资源需要安装相应的插件，如check_cpu, check_disk等等（[点此下载](https://www.nagios.org/downloads/nagios-plugins/)）。
NRPE扩展安装在被监控主机上来收集监控信息，它由两部分组成：安装在Nagios服务器上的check_nrpe插件及运行与被监控主机的NRPE daemon。

当Naigos监控远程主机的资源时，工作流程如下：

* Nagios 会运行 `check_nrpe` 这个插件，并且告诉它需要检查什么（即运行哪个插件）
* `check_nrpe` 插件会与远程的 NRPE daemon通讯
* NRPE daemon 会运行相应的 Nagios 插件来执行检查动作
* NPRE daemon 将检查的结果返回给 check_nrpe 插件，插件将其返回给 Nagios 做处理。

NRPE 结构图:

![NRPE结构图](/images/nrpe.png)

#### 安装

在服务器端需要安装Nagios Core，Plugins以及NRPE，被监控主机也就是客户端需要安装Nagios Plugins跟NRPE。具体安装过程可以参考[官方文档][1]，不再赘述。

默认的源码安装会在 `/usr/local/nagios` 下生成以下目录：

| 目录名称 | 作用 |
| -------- | ---- |
| bin | Nagios 可执行程序所在目录 |
| etc | Nagios 配置文件目录 |
| share | Nagios Web界面存放路径 |
| libexec | Nagios 外部插件存放目录 |
| var | Nagios 日志文件、Lock 等文件所在的目录 |
| var/archives | Nagios 日志自动归档目录 |
| var/rw | 用来存放外部命令文件的目录 |

#### 配置

我们在服务器端 `etc` 目录下新建一个`monitor`用来存放配置文件，首先在`nagios.cfg`中添加一行`cfg_dir=/usr/local/nagios/etc/monitor`，然后去掉其他的`cfg_dir`项。

`monitor`目录下配置文件的涵义：

* `hosts.cfg` 网络上物理设备，包括主机，路由器等
* `services.cfg` 主机的属性（cpu load，uptime等）
* `contacts.cfg` 联系人，决定了报警方式，及接受哪些时间的报警
* `commands.cfg` 检查主机、服务状态，报警，事件处理时执行的程序或脚本
* `escalations.cfg` 增强了报警功能，如修改通知间隔，联系人等

在客户端的 `nrpe.cfg` 增加相应nrpe命令后，启动服务器与客户端相应程序以后，Nagios的基础功能就可以使用了。

#### 安装 `PNP4Nagios`

PNP是一款Nagios性能分析插件，它把数据存储在rrdtool。我们在这里只用它来暂存数据。

### InfluxDB

#### 安装

InfluxDB使用主机上的时间作为存储数据的时间戳，所以我们先安装 `NTP` 来校对时间。

然后安装influxDB，添加InfluxDB的安装源：

```bash
cat <<EOF | sudo tee /etc/yum.repos.d/influxdb.repo
[influxdb]
name = InfluxDB Repository - RHEL \$releasever
baseurl = https://repos.influxdata.com/rhel/\$releasever/\$basearch/stable
enabled = 1
gpgcheck = 1
gpgkey = https://repos.influxdata.com/influxdb.key
EOF
```

安装源设置完成就可以安装并启动influxdb

```bash
sudo yum install influxdb
sudo service influxdb start
```

成功启动后可以打开 web 管理界面 http://127.0.0.1:8083/， 默认用户名和密码是 root 和 root。 InfluxDB 的 web 管理界面端口是 8083，HTTP API 监听端口是 8086，如果需要更改这些默认设定，修改 InfluxDB 的配置文件 `/etc/influxdb/influxdb.conf` 后重启 InfluxDB 就可以了。

#### 迁移数据

上面我们将性能数据通过rrdtool存储为硬盘文件，可以通过 [nagflux][6] 把数据自动导入到InfluxDB。

nagflux也是用go语言编写的不需要其他依赖，安装简单。修改配置文件 `config.gcfg`，启动程序就可以在InfluxDB中看到数据了。

### Grafana

#### 安装

使用 yum 直接安装 `Grafana`：

```bash
sudo yum install https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana-4.6.1-1.x86_64.rpm
sudo systemctl start grafana
```

打开 `Grafana` 的web界面，`http://127.0.0.1:3000`。在菜单中找到添加数据源，添加类型为 `InfluxDB` 名为 nagflux 的数据源。

至此我们可以在 grafana 的web界面自定义展示数据的图表，也可以使用 [histou][7] 插件，`histou` 提供了一个模版可以直接展示 `nagflux` 收集的历史数据为曲线图。

#### 集成到Nagios

将曲线图集成到Nagios，需要在配置文件中的 `Host`，`Service`项增加 `action_url`

```
define host {
    name grafana-host 
    action_url http://grafana-server:3000/dashboard/script/histou.js?host=db5&srv=_HOST_
    register 0
}
define service {
    name grafana-service
    action_url http://grafana-server:3000/dashboard/script/histou.js?host=$HOSTNAME$&service=$SERVICEDESC$
    register 0
}
```

这里提供的示例定义了 host 跟 service 的模版，可以被其他的hosts，services继承

### Slack

我们把Nagios的报警信息发送到 [Slack][5] 中的特定频道，通知相关人员


## 相关文档

* [Nagios][1]
* [Ansible][2]
* [InfluxDB][3]
* [Grafana][4]
* [Slack][5]
* [naglux][6]
* [histou][7]


[1]: https://assets.nagios.com/downloads/nagioscore/docs/nagioscore/4/en/quickstart.html#_ga=2.92539934.2061844877.1509670667-1605740700.1509670667
[2]: http://docs.ansible.com/ansible/latest/index.html
[3]: https://docs.influxdata.com/influxdb/v1.3/introduction/getting_started/
[4]: http://docs.grafana.org/installation/rpm/
[5]: https://slack.com/apps/A0F81R747-nagios
[6]: https://github.com/Griesbacher/nagflux
[7]: https://github.com/Griesbacher/histou
