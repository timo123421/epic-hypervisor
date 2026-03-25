#!/bin/bash

# Project Nova Installation Script
# Supports Debian/Ubuntu and Arch Linux

set -e

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit
fi

OS_TYPE=""
if [ -f /etc/debian_version ]; then
  OS_TYPE="debian"
elif [ -f /etc/arch-release ]; then
  OS_TYPE="arch"
else
  echo "Unsupported OS"
  exit 1
fi

echo "Detected OS: $OS_TYPE"

# Install dependencies
if [ "$OS_TYPE" == "debian" ]; then
  apt-get update
  apt-get install -y nodejs npm libvirt-daemon-system libvirt-clients qemu-kvm virt-manager virt-install virt-clone lxc iptables util-linux sqlite3 openvswitch-switch iproute2
elif [ "$OS_TYPE" == "arch" ]; then
  pacman -Syu --noconfirm nodejs npm libvirt qemu-full virt-manager virt-install lxc iptables-nft util-linux sqlite openvswitch iproute2
fi

# Enable services
if [ "$OS_TYPE" == "debian" ]; then
  systemctl enable --now libvirtd
  systemctl enable --now openvswitch-switch
elif [ "$OS_TYPE" == "arch" ]; then
  systemctl enable --now libvirtd
  # Check for available OVS services
  if systemctl list-unit-files | grep -q "ovs-vswitchd.service"; then
    systemctl enable --now ovs-vswitchd
  elif systemctl list-unit-files | grep -q "openvswitch.service"; then
    systemctl enable --now openvswitch
  else
    echo "Warning: Could not find Open vSwitch service. Please check your OVS installation."
  fi
fi

# Add current user to libvirt group
# Note: This requires the user to log out and back in
USER_NAME=$(logname)
usermod -aG libvirt $USER_NAME

echo "Installation complete. Please log out and back in for group changes to take effect."
echo "Run 'npm install' and 'npm run dev' to start Project Nova."
