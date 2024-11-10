#!/bin/bash

# Função para solicitar uma senha com mascaramento de caracteres
# Parâmetro: O prompt a ser exibido para o usuário
ask_password() {
    local fieldName="$1"
    local prompt="$2"
    local password=""
    local char=""

    # Exibe a mensagem solicitando a senha
    echo -n "$prompt"

    # Desabilita a exibição dos caracteres digitados
    stty -echo

    # Lê a senha digitada pelo usuário
    while IFS= read -r -n1 char; do
        if [[ $char == $'\0' ]]; then
            break
        fi
        if [[ $char == $'\x7f' ]]; then  # Se for Backspace
            password="${password%${password: -1}}"  # Remove o último caractere da senha
            echo -ne "\b \b"  # Apaga o último asterisco na tela
        else
            password+="$char"
            echo -n "*"  # Exibe um asterisco na tela para cada caractere
        fi
    done

    # Restaura a exibição normal dos caracteres
    stty echo
    echo  # Adiciona uma nova linha após a entrada
    eval "$fieldName=\"$password\""
}

# Verifica se o arquivo .env existe
#if [ ! -f ".env" ]; then
    echo ".env não encontrado. Criando o arquivo .env..."

    # Solicitar ao usuário as variáveis necessárias
    read -p "SERVICE: " SERVICE
    read -p "DOMAIN: " DOMAIN

    read -p "ADMIN_PORT: " ADMIN_PORT

    read -p "POSTGRES_PORT: " POSTGRES_PORT
    read -p "POSTGRES_USER: " POSTGRES_USER
    read -p "POSTGRES_DATABASE: " POSTGRES_DATABASE

    # Solicitar a senha do Postgres com mascaramento
#    POSTGRES_PASSWORD=$()
    ask_password "POSTGRES_PASSWORD" "POSTGRES_PASSWORD: "

    read -p "MONGO_DB: " MONGO_DB
    read -p "MONGO_USER: " MONGO_USER

    # Solicitar a senha do MongoDB com mascaramento
    ask_password "MONGO_PASSWORD" "MONGO_PASSWORD: "
    echo

    # Cria o arquivo .env com os valores fornecidos (corrigindo as variáveis)
    cat <<EOL > .env
## Geral Configs
SERVICE=$SERVICE
DOMAIN=$DOMAIN

## Admin
ADMIN_PORT=$ADMIN_PORT

## Postgres sets
POSTGRES_PORT=$POSTGRES_PORT
POSTGRES_USER=$POSTGRES_USER
POSTGRES_DATABASE=$POSTGRES_DATABASE
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

## Mongo sets
MONGO_DB=$MONGO_DB
MONGO_USER=$MONGO_USER
MONGO_PASSWORD=$MONGO_PASSWORD
EOL

    echo ".env criado com sucesso."
#fi

# Continua a execução do seu script Docker Compose
echo "Iniciando Docker Compose..."

# Rodar o comando Docker Compose (substitua pelo seu comando real)
#docker compose -f postgrade.yml --env-file .env up -d

echo "Docker Compose finalizado."



