#!/bin/bash
WORKDIR=$(pwd)
POSTGRADE_HOME=$(cd "$(dirname "$(readlink -f "$0")")" && pwd)/..

DEFAULT_PROJECT="postgrade"
# Exibe a mensagem solicitando a senha e sugere o valor atual, se existente
if [ -n "$1" ]; then
  PROJECT=$(basename $1)
else
  # Solicitar ao usuário as variáveis necessárias com valores padrão do .env ou padrão definido
  read -p "PROJECT [${DEFAULT_PROJECT}]: " PROJECT
  PROJECT=${PROJECT:-$DEFAULT_PROJECT}
fi

# Remover o prefixo ".env." de PROJECT, caso presente
if [[ "$PROJECT" =~ ^\.env\.(.*) ]]; then
  PROJECT="${BASH_REMATCH[1]}"
fi


if [ ! -f ".env.${PROJECT}" ]; then
    echo ".env não encontrado. Criando o arquivo .env..."
    $(dirname "$0")/./init.sh $PROJECT
fi

source ".env.${PROJECT}"
# Continua a execução do seu script Docker Compose
echo "Start docker compose..."
cd "${POSTGRADE_HOME}"

mkdir -p ${POSTGRADE_VOLUME}


# Rodar o comando Docker Compose (substitua pelo seu comando real)
docker compose -p "${PROJECT}" -f "${POSTGRADE_HOME}/postgrade.yml" --env-file "${WORKDIR}/.env.${PROJECT}" stop
echo "Docker Compose finished."
cd "${WORKDIR}"




