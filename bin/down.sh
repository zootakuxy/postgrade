#!/bin/bash
cd $(dirname "$0")/..
docker compose -f postgrade.yml --env-file .env up -d