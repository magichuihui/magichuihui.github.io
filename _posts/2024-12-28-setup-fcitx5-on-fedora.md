---
layout: post
title: Input Chinese on Fedora 41 using fcitx5
excerpt: Setup fcitx5 on Fedora
date: 2024-12-28
tags: [Linux]
comments: true
---

Fedora use ibus for input by default, but for Chinese user you will find fcitx5 Pinyin is more efficient.

## 1. Install fcitx5

```bash
sudo dnf install fcitx5 fcitx5-chinese-addons
```

## 2. Config .xinitrc

```bash
cat >> $HOME/.xinitrc <<"EOF"
export XMODIFIERS="@im=fcitx"
export GTK_IM_MODULE=xim
export QT_IM_MODULE=fcitx
EOF
```

## 3. Enable fcitx for Gnome

```bash
gsettings set org.gnome.settings-daemon.plugins.xsettings overrides "{'Gtk/IMModule':<'fcitx'>}"
```

## References

[1] [Inputting Japanese text in Linux and some BSDs](https://srobb.net/jpninpt.html#Fedora)