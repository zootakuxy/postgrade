#!/bin/bash
WORKDIR=$(pwd)
HOME=$(dirname "$0")/..

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



# Continua a execução do seu script Docker Compose
echo "Stop docker compose..."
cd "${HOME}"

# Rodar o comando Docker Compose (substitua pelo seu comando real)
docker compose -p "${PROJECT}" -f postgrade.yml --env-file "${WORKDIR}/.env.${PROJECT}" down
echo "Docker Compose finished."
cd "${WORKDIR}"




