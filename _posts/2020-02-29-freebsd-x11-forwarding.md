---
layout: post
title: How to run vscode on FreeBSD
excerpt: Run Visual Studio Code on FreeBSD
date: 2020-02-29
tags: [FreeBSD]
comments: true
---

First, I have to admit this article is not about running vscode on FreeBSD, at least not all. There is already a [FreeBSD VSCode port](https://github.com/tagattie/FreeBSD-VSCode) on github which still has some issues. What I am trying to do here is to show you how to run vscode inside a bhyve guest system on the FreeBSD host via ssh X11 Forwarding.

## bhyve

The First step is creating a Fedora 31 virtual machine in bhyve, where Visual Studio Code is actually running in.

### 1. Prepare the host

Runing the following scripts to load the bhyve kernel module and create network interfaces needed by the bhyve guest.

```bash
kldload vmm

ifconfig tap0 create
sysctl net.link.tap.up_on_open=1
ifconfig bridge0 create
ifconfig bridge0 addm igb0 addm tap0
ifconfig bridge0 up
```

Presist the configuration after reboot by adding the following lines to configuration files.

```bash
# cat /etc/rc.conf
cloned_interfaces="bridge0 tap0 lo1"
ifconfig_bridge0="addm em0 addm tap0"
kld_list="vmm"
```

```bash
# cat /etc/sysctl.conf
net.link.tap.up_on_open=1
```

### 2. Prepare a Fedora Guest

First, create a ZFS volume by:

```bash
zfs create -V100G -o volmode=dev zroot/fedora
```

Then, download an installation image of Fedora 31 to install:

```bash
curl -LO https://download.fedoraproject.org/pub/fedora/linux/releases/31/Server/x86_64/iso/Fedora-Server-dvd-x86_64-31-1.9.iso
```

### 3. Booting bhyve Guest with UEFI firmware

Install UEFI firmware images from [sysutils/bhyve-firmware](https://www.freebsd.org/cgi/url.cgi?ports/sysutils/bhyve-firmware/pkg-descr).

```bash
pkg install sysutils/bhyve-firmware
```

Now we can boot the guest with the image we just downloaded.

```bash
bhyve -AHP -s 0:0,hostbridge -s 31:0,lpc \
-s 2:0,virtio-net,tap0 -s 3:0,virtio-blk,/dev/zvol/zroot/fedora \
-s 4:0,ahci-cd,./Fedora-Server-dvd-x86_64-31-1.9.iso
-c 4 -m 8192M \
-s 20,xhci,tablet \
-s 29,fbuf,tcp=0.0.0.0:5900,w=1920,h=1080,wait \
-l bootrom,/usr/local/share/uefi-firmware/BHYVE_UEFI.fd \
fedora
```

We just create a VNC server for the Guest by adding the `-s 29,fbuf,tcp=0.0.0.0:5900,w=1920,h=1080,wait` flags. The Guest will boot, we can connect to it via a VNC client and finish the install procedure, when we have installed Fedora 31 on the virtual machine, reboot the Guest. Here we have to remove the instance of the virtual machine otherwise it cannot be started again.

```bash
bhyvectl --destroy --vm=fedora
```

### 4. Start Fedora VM

Start the Guest by:

```bash
bhyve -AHP -s 0:0,hostbridge -s 31:0,lpc \
-s 2:0,virtio-net,tap0 -s 3:0,virtio-blk,/dev/zvol/zroot/fedora \
-c 4 -m 8192M \
-s 20,xhci,tablet \
-s 29,fbuf,tcp=0.0.0.0:5900,w=1920,h=1080 \
-l bootrom,/usr/local/share/uefi-firmware/BHYVE_UEFI.fd \
fedora > /var/log/bhyve 2>&1 &
```

We can destroy a specified virtual machine by using `bhyvectl`:

```bash
bhyvectl --destroy --vm=fedora
```

## X11 forwarding with Indirect GLX enabled

To enable Indirect GLX, we have to create `~/.xserverrc`:

```bash
#!/bin/sh
/usr/local/bin/X -iglx "$@"
```

This time we use the command `ssh -X user@fedora` connecting to the Fedora Guest, and then input `code` in the terminal. Ahha, it works.

But there is still an issue, an error that saying "code not responding, wait or quit, blah blah" keeps coming. Using trusted X11 forwarding, aka `-Y` option, will get rid of this error. Unfortunately `Intel HD Graphics 630` on my machine may not support trusted X11 forwarding or whatever, every time I exec `ssh -Y user@fedora "code"`, the system will crash and reboot. So I borrow a GTX 650 from a friend.

```bash
pkg install nvidia_driver
```

And add these lines to `/etc/rc.conf`:

```conf
linux_enable="YES"
kld_list="vmm nvidia-modeset"
nvidia_name="nvidia"
nvidia_modset_name="nvidia-modeset"
```

Create an X11 configuration file named `/usr/local/etc/X11/xorg.conf.d/nvidia.conf`.

```conf
Section "Device"
        Identifier "NVIDIA Card"
        VendorName "NVIDIA Corporation"
        Driver "nvidia"
EndSection
```

Reboot. Execute `ssh -Y user@fedora "code"` again. Finally, it works like a charm.

## Reference

1. [FreeBSD as a Host with bhyve](https://www.freebsd.org/doc/en_US.ISO8859-1/books/handbook/virtualization-host-bhyve.html)
2. [FreeBSD 12.0 NVIDIA Graphics](https://headthirst.com/freebsd-nvidia.html)