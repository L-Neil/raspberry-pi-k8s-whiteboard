# Kubernetes cluster provisioning with Ansible

Ubuntu 24.04 LTSを導入した5台のRaspberry Piを、コントロールプレーン1台とワーカー4台のKubernetesクラスタとして構成します。

## 前提条件

- 管理端末にAnsibleが導入されている
- 全Nodeへ同じSSH公開鍵で接続できる
- 全Nodeが互いのIPアドレスへ到達できる
- ホスト側ネットワークと`10.244.0.0/16`が重複しない
- 対象利用者が初回のみ`sudo`パスワードを入力できる

## 設定

```bash
cp inventory.example.ini inventory.ini
```

`inventory.ini`のホスト名、IPアドレス、`ansible_user`を環境に合わせます。コントロールプレーンは1台だけ指定してください。秘密鍵はファイルへ書かず、SSHエージェントを使用するか、実行時に`--private-key`で指定します。

共通変数は`group_vars/k8s.yml`にあります。

| 変数 | 既定値 | 用途 |
| --- | --- | --- |
| `kubernetes_minor_version` | `v1.36` | Kubernetesのaptリポジトリ系列 |
| `flannel_version` | `v0.28.4` | Flannelマニフェストの固定版 |
| `pod_network_cidr` | `10.244.0.0/16` | Podネットワーク |

## 実行

```bash
ansible k8s -m ping
ansible-playbook --syntax-check site.yml
ansible-playbook --ask-become-pass bootstrap_sudo.yml
ansible-playbook -f 1 site.yml
```

`bootstrap_sudo.yml`は授業用LANで繰り返し実行しやすくするため、対象利用者へパスワードなしの`sudo`を許可します。不要な環境では実行せず、通常の`--ask-become-pass`を使用してください。

## 確認

コントロールプレーンへSSH接続し、次を実行します。

```bash
kubectl get nodes -o wide
kubectl get pods -A -o wide
kubectl version
```

全Nodeが`Ready`であり、CoreDNS、Flannel、kube-proxy、コントロールプレーン用Podが`Running`であることを確認します。

## 再実行

プレイブックは、既に`/etc/kubernetes/admin.conf`または`/etc/kubernetes/kubelet.conf`が存在するNodeを再初期化しません。クラスタを作り直す場合は、データの消失を伴う`kubeadm reset`を安易に実行せず、必要なデータと対象Nodeを確認してから別途初期化してください。
