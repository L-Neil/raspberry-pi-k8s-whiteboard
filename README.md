# Raspberry Pi Kubernetes Whiteboard Lab

5台のRaspberry Piへkubeadmを用いたKubernetesクラスタを構築し、リアルタイム同期対応の共有ホワイトボードを配置するための再現用リポジトリです。

- `k8s-ansible/`: Kubernetesノードの共通設定、コントロールプレーンの初期化、ワーカーの参加
- `shared-whiteboard/`: ホワイトボードのプログラム、コンテナイメージ、Kubernetesマニフェスト

## 確認した構成

| 項目 | 構成 |
| --- | --- |
| Node | Raspberry Pi 5台（コントロールプレーン1台、ワーカー4台） |
| OS | Ubuntu 24.04 LTS ARM64 |
| Kubernetes | v1.36系 |
| コンテナ実行環境 | containerd |
| CNI | Flannel v0.28.4 |
| Podネットワーク | `10.244.0.0/16` |
| アプリケーションイメージ | `shared-whiteboard:1.0.0`、`linux/arm64` |

## 1. Kubernetesクラスタの構築

管理端末へAnsibleを導入し、SSH公開鍵で各Raspberry Piへ接続できるようにします。

```bash
cd k8s-ansible
cp inventory.example.ini inventory.ini
```

`inventory.ini`のIPアドレスと利用者名を実際の環境に合わせて変更します。秘密鍵、パスワード、実際の`inventory.ini`はリポジトリへ登録しないでください。

```bash
ansible k8s -m ping
ansible-playbook --syntax-check site.yml
ansible-playbook --ask-become-pass bootstrap_sudo.yml
ansible-playbook -f 1 site.yml
```

構築内容と変数は[`k8s-ansible/README.md`](k8s-ansible/README.md)を参照してください。

## 2. ARM64イメージの作成

管理端末で次を実行します。

```bash
cd shared-whiteboard
docker buildx build --platform linux/arm64 \
  -t shared-whiteboard:1.0.0 --load .
docker image inspect shared-whiteboard:1.0.0 \
  --format '{{.Architecture}}/{{.Os}}'
docker save shared-whiteboard:1.0.0 \
  -o shared-whiteboard-1.0.0.tar
```

最後の確認結果が`arm64/linux`であることを確認します。

## 3. 保存先ワーカーへのイメージ配置

以下の例では`k8s-worker-1`を保存先にします。ホスト名は`inventory.ini`に合わせて読み替えてください。

```bash
scp shared-whiteboard-1.0.0.tar k8s-worker-1:/tmp/
ssh k8s-worker-1 \
  'sudo ctr -n k8s.io images import /tmp/shared-whiteboard-1.0.0.tar'
ssh k8s-worker-1 \
  'sudo ctr -n k8s.io images ls | grep shared-whiteboard'
ssh k8s-worker-1 \
  'sudo mkdir -p /var/lib/shared-whiteboard'
```

## 4. ホワイトボードの配置

コントロールプレーンで次を実行します。

```bash
kubectl label node k8s-worker-1 whiteboard-storage=true
kubectl apply -f shared-whiteboard/k8s/whiteboard.yaml
kubectl -n whiteboard rollout status \
  deployment/shared-whiteboard --timeout=300s
kubectl -n whiteboard get pods -o wide
kubectl -n whiteboard get service shared-whiteboard
kubectl get pv
kubectl -n whiteboard get pvc
```

マニフェストをコントロールプレーンへコピーしていない場合は、リポジトリをコントロールプレーンにもcloneするか、管理端末から`scp`で送ります。

## 5. 接続確認

同じLAN内の端末から、正常な任意のNode IPとNodePort `30080`を指定してアクセスします。

```text
http://<NodeのIPアドレス>:30080
```

ヘルスチェックは次のように確認できます。

```bash
curl http://<NodeのIPアドレス>:30080/healthz
```

`ok`が返り、2つのブラウザで描画内容がリアルタイムに同期されれば通信は正常です。Podを削除した後に新しいPodが作成され、ブラウザの再読み込み後にも描画内容が残ることを確認すると、Deploymentの自己修復とPVの永続化を検証できます。

## 構成上の制約

付属マニフェストは学習用の最小構成です。コントロールプレーンは1台、保存領域は1台のワーカー上のローカルPV、ホワイトボードは1 Podです。ワーカー障害時の自動移動や複数Podによる水平分散には対応していません。インターネットへ公開する場合は、TLS、認証、バックアップ、監視、ネットワークストレージ、共有同期バックエンド等を別途設計してください。

## ライセンス

このリポジトリ固有のコードと構築ファイルはMIT Licenseで公開します。ホワイトボードが利用するtldraw等の第三者ソフトウェアには、それぞれのライセンスが適用されます。詳細は[`shared-whiteboard/THIRD_PARTY_NOTICES.md`](shared-whiteboard/THIRD_PARTY_NOTICES.md)を参照してください。
