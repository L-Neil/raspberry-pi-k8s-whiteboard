#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 NODE_NAME" >&2
  exit 2
fi

NODE_NAME="$1"
KUBERNETES_PACKAGE_VERSION="1.36.1-1.1"

sudo hostnamectl set-hostname "$NODE_NAME"
sudo swapoff -a

printf '%s\n' overlay br_netfilter | sudo tee /etc/modules-load.d/k8s.conf >/dev/null
sudo modprobe overlay
sudo modprobe br_netfilter

printf '%s\n' \
  'net.bridge.bridge-nf-call-iptables = 1' \
  'net.bridge.bridge-nf-call-ip6tables = 1' \
  'net.ipv4.ip_forward = 1' \
  | sudo tee /etc/sysctl.d/99-kubernetes-cri.conf >/dev/null
sudo sysctl --system >/dev/null

sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  apt-transport-https ca-certificates curl gpg containerd

sudo mkdir -p /etc/containerd
/usr/bin/containerd config default | sudo tee /etc/containerd/config.toml >/dev/null
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
sudo mkdir -p /etc/systemd/system/containerd.service.d
printf '%s\n' \
  '[Service]' \
  'ExecStart=' \
  'ExecStart=/usr/bin/containerd' \
  | sudo tee /etc/systemd/system/containerd.service.d/override.conf >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now containerd
sudo systemctl restart containerd

sudo mkdir -p -m 755 /etc/apt/keyrings
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.36/deb/Release.key \
  | sudo gpg --dearmor --yes -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.36/deb/ /' \
  | sudo tee /etc/apt/sources.list.d/kubernetes.list >/dev/null

sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  "kubelet=${KUBERNETES_PACKAGE_VERSION}" \
  "kubeadm=${KUBERNETES_PACKAGE_VERSION}" \
  "kubectl=${KUBERNETES_PACKAGE_VERSION}"
sudo apt-mark hold kubelet kubeadm kubectl
sudo systemctl enable kubelet

echo "node=${NODE_NAME}"
uname -m
/usr/bin/containerd --version
kubeadm version -o short
kubectl version --client
