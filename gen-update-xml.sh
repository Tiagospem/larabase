#!/bin/bash

echo 'owner: Tiagospem
repo: app
provider: github' > app-update.yml

echo 'owner: Tiagospem
repo: app
provider: github' > dev-app-update.yml

echo 'appId: com.larabase.app
publish:
  provider: github' > electron-builder.yml