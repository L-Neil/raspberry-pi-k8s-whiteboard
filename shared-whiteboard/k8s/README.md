# Kubernetes deployment

このmanifestは、`whiteboard-storage=true`ラベルを付けた1台のworkerへlocal PersistentVolumeを作成します。まず、各Kubernetes Nodeで利用できるARM64またはAMD64イメージを`shared-whiteboard:1.0.0`として用意してください。

```bash
kubectl label node <保存先worker名> whiteboard-storage=true
ssh <保存先worker名> 'sudo mkdir -p /var/lib/shared-whiteboard'
kubectl apply -f whiteboard.yaml
kubectl -n whiteboard rollout status deployment/shared-whiteboard --timeout=300s
```

Registryを使う場合は、manifest内の2か所の`image:`を同じ公開イメージ名へ変更してください。local PVは保存先Nodeに依存します。複数ReplicaやNode障害時の自動移動が必要な環境では、ReadWriteMany対応のnetwork storageと外部同期backendへ置き換えてください。
