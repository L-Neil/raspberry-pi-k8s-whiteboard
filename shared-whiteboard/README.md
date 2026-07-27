# Shared Whiteboard

ブラウザ間で付箋や図形をリアルタイム同期できる、小さなセルフホスト型ホワイトボードです。ボードの状態はJSONファイルとして保存され、コンテナを再作成してもvolumeから復元できます。

## Features

- 複数ブラウザ間のリアルタイム同期
- ボードの作成、一覧表示、名前変更、削除
- JSONファイルへの永続化
- Docker ComposeとKubernetesに対応
- `/healthz`によるhealth check
- ARM64とAMD64でbuild可能

## Quick start

DockerとDocker Composeが利用できる環境で実行します。

```bash
git clone https://github.com/L-Neil/raspberry-pi-k8s-whiteboard.git
cd raspberry-pi-k8s-whiteboard/shared-whiteboard
docker compose up --build -d
curl http://127.0.0.1:3000/healthz
```

ブラウザで `http://127.0.0.1:3000` を開きます。停止する場合は次を実行します。

```bash
docker compose down
```

保存データも削除する場合だけ、内容が不要であることを確認してから `docker compose down -v` を使用してください。

## Configuration

| 環境変数 | 既定値 | 説明 |
| --- | --- | --- |
| `PORT` | `3000` | HTTPとWebSocketの待受port |
| `AUTH_MODE` | `local` | `local`または`header` |
| `LOCAL_USER_EMAIL` | `user@example.invalid` | local modeで使用する識別子 |
| `AUTH_HEADER` | `x-authenticated-user-email` | header modeで信頼するheader名 |

`local` modeには利用者を認証する機能がなく、全員を同一利用者として扱います。手元のPCや信頼できるLAN内での利用を想定しています。

インターネットへ公開する場合は、TLSと認証を行うreverse proxyの背後へ配置し、`AUTH_MODE=header`を設定してください。reverse proxyは外部から送られた認証headerを必ず削除し、認証に成功した利用者の値だけを設定する必要があります。このアプリケーションをNodePortやport 3000のままインターネットへ直接公開しないでください。

## Build without Compose

```bash
docker build -t shared-whiteboard:1.0.0 .
docker run --rm -p 3000:3000 \
  -e AUTH_MODE=local \
  -v shared-whiteboard-data:/app/data \
  shared-whiteboard:1.0.0
```

## Kubernetes

`k8s/whiteboard.yaml`は、1台のNodeにlocal PersistentVolumeを用意する最小構成です。詳しい適用手順は[k8s/README.md](k8s/README.md)を参照してください。

この構成は`replicas: 1`と`Recreate`を使用します。現在状態をprocess memoryでも管理し、保存先が1台のNodeに固定されるためです。高可用化する場合は、外部同期backendとnetwork storageを使用する設計へ変更してください。

## Browser dependencies

画面はブラウザから`esm.sh`と`unpkg.com`上の固定versionのJavaScript/CSSを読み込みます。利用者のブラウザから両domainへ接続できる必要があります。完全なoffline運用では、これらのassetを自分でbundleして配信する構成へ変更してください。

## Data and backup

データはコンテナ内の`/app/data`へ保存されます。Composeではnamed volume、付属Kubernetes manifestでは`/var/lib/shared-whiteboard`を使用します。更新や削除の前に、このdirectoryまたはvolumeをbackupしてください。

## Open source and licensing

このリポジトリ固有のserver、UI glue code、deployment filesは[MIT License](LICENSE)で公開します。

描画・同期機能にはtldraw 3.1.0を使用しています。tldrawはMIT Licenseではなく、独自のtldraw licenseです。配布に必要な同版のライセンス全文を[licenses/tldraw-v3.1.0.txt](licenses/tldraw-v3.1.0.txt)へ収録しています。既定のtldraw watermarkを削除・非表示・変更しないでください。その他の主要依存関係は[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)を参照してください。

このプロジェクトはtldraw Inc.の公式製品ではなく、同社による承認や提携を示すものではありません。tldrawの名称は依存OSSの識別と帰属表示のためにのみ使用しています。

## Development

```bash
npm ci
npm test
npm start
```
