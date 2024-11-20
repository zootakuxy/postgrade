#!/bin/bash

POSTGRADE_HOME=$(cd "$(dirname "$(readlink -f "$0")")" && pwd)/..
# Muda para o diretório pai do diretório onde o script está localizado
cd $(dirname "$0")/..

# shellcheck disable=SC2216
tsc | echo "build"
node version.js
docker compose build
