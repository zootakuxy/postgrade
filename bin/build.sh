#!/bin/bash

# Muda para o diretório pai do diretório onde o script está localizado
cd $(dirname "$0")/..

docker build -t zootakuxy/postgrade-admin   -f admin/Dockerfile .
docker build -t zootakuxy/postgrade-p2m     -f p2m/Dockerfile .
docker build -t zootakuxy/postgrade-pg      -f pg/Dockerfile .
