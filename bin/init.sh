#!/bin/bash

# Função para autocompletar o caminho baseado em pastas disponíveis
complete_path() {
    local cur="${COMP_WORDS[COMP_CWORD]}"  # Caminho atual digitado
    local paths=("~" "/home" "/mnt" "/tmp")  # Caminhos predefinidos onde procurar

    # Para cada caminho predefinido, geramos a lista de opções possíveis
    local suggestions=()
    for path in "${paths[@]}"; do
        # Expande o caminho (considera "~" como o diretório home)
        expanded_path=$(eval echo $path)

        # Adiciona as opções de diretórios que correspondem ao que o usuário digitou
        if [ -d "$expanded_path" ]; then
            suggestions+=( $(compgen -d -- "$expanded_path/$cur") )
        fi
    done

    # Passa as sugestões para o Bash
    COMPREPLY=("${suggestions[@]}")
    return 0
}
echo "$(complete_path)"

PathResolve() {
  local UsePath="$1"
  local CurrentDir=$(pwd)

  if [ ! -f "${UsePath}" ]; then
    mkdir -p "${UsePath}"
    cd "${UsePath}"
    local Resolved=$(pwd)
    cd "${CurrentDir}"
    rm -rf "${UsePath}"
  else
    cd "${UsePath}"
    local Resolved=$(pwd)
    cd "${CurrentDir}"
  fi
  echo "${Resolved}"
}

# Registrar a função de autocomplete para POSTGRADE_VOLUME
complete -F complete_path POSTGRADE_VOLUME

# Função para solicitar uma senha com mascaramento de caracteres
ask_password() {
    local fieldName="$1"
    local defaultPassword="$2"
    local fieldLabel="$3"
    local prompt="${fieldLabel:-${fieldName}}"
    local password=""
    local char=""

    # Exibe a mensagem solicitando a senha e sugere o valor atual, se existente
    if [ -n "$defaultPassword" ]; then
      echo -n "$prompt [****]: "
    else
      echo -n "$prompt: "
    fi

    # Desativa exibição dos caracteres
    stty -echo
    while IFS= read -r -n1 char; do
        if [[ $char == "" ]]; then
            break
        elif [[ $char == $'\x7f' ]]; then
            # Verifica se a senha não está vazia antes de apagar
            if [ -n "$password" ]; then
                password="${password%?}" # Remove o último caractere
                echo -ne "\b \b" # Remove o asterisco visualmente
            fi
        else
            password+="$char"
            echo -n "*" # Mostra o asterisco
        fi
    done
    stty echo
    echo

    # Se o usuário não digitou nada, usa a senha atual como valor
    password=${password:-$defaultPassword}
    eval "$fieldName=\"$password\""
}

# Carrega o arquivo .env, se ele existir
if [ -f .env ]; then
    echo "Carregando valores atuais do .env como padrão..."
    source .env
fi

# Valores padrão
DEFAULT_SERVICE=${SERVICE-"postgrade"}
DEFAULT_DOMAIN=${DOMAIN-"postgrade.srv"}
DEFAULT_POSTGRADE_VOLUME=${POSTGRADE_VOLUME-"${HOME}/AppsData/postgrade"}

DEFAULT_ADMIN_PORT=${ADMIN_PORT-4000}
DEFAULT_POSTGRES_PORT=${POSTGRES_PORT-5432}
DEFAULT_POSTGRES_USER=${POSTGRES_USER-"postgres"}
DEFAULT_POSTGRES_PASSWORD=${POSTGRES_PASSWORD-}
DEFAULT_POSTGRES_DATABASE=${POSTGRES_DATABASE-"postgres"}
DEFAULT_MONGO_PORT=${MONGO_PORT-27017}
DEFAULT_MONGO_USER=${MONGO_USER-"root"}
DEFAULT_MONGO_DB=${MONGO_DB-"mdb"}
DEFAULT_MONGO_PASSWORD=${MONGO_PASSWORD-}

# Solicitar ao usuário as variáveis necessárias com valores padrão do .env ou padrão definido
read -p "SERVICE [${DEFAULT_SERVICE}]: " SERVICE
SERVICE=${SERVICE:-$DEFAULT_SERVICE}

read -p "DOMAIN [${DEFAULT_DOMAIN}]: " DOMAIN
DOMAIN=${DOMAIN:-$DEFAULT_DOMAIN}

read -p "POSTGRADE_VOLUME [${DEFAULT_POSTGRADE_VOLUME}]: " POSTGRADE_VOLUME
POSTGRADE_VOLUME=${POSTGRADE_VOLUME:-$DEFAULT_POSTGRADE_VOLUME}
POSTGRADE_VOLUME=$(PathResolve "$POSTGRADE_VOLUME")

read -p "ADMIN_PORT [${DEFAULT_ADMIN_PORT}]: " ADMIN_PORT
ADMIN_PORT=${ADMIN_PORT:-$DEFAULT_ADMIN_PORT}

read -p "POSTGRES_PORT [${DEFAULT_POSTGRES_PORT}]: " POSTGRES_PORT
POSTGRES_PORT=${POSTGRES_PORT:-$DEFAULT_POSTGRES_PORT}

read -p "POSTGRES_USER [${DEFAULT_POSTGRES_USER}]: " POSTGRES_USER
POSTGRES_USER=${POSTGRES_USER:-$DEFAULT_POSTGRES_USER}

read -p "POSTGRES_DATABASE [${DEFAULT_POSTGRES_DATABASE}]: " POSTGRES_DATABASE
POSTGRES_DATABASE=${POSTGRES_DATABASE:-$DEFAULT_POSTGRES_DATABASE}

# Solicitar a senha do Postgres com mascaramento
ask_password "POSTGRES_PASSWORD" "$DEFAULT_POSTGRES_PASSWORD"
echo "Senha do Postgres definida."

read -p "MONGO_PORT [${DEFAULT_MONGO_PORT}]: " MONGO_PORT
MONGO_PORT=${MONGO_PORT:-$DEFAULT_MONGO_PORT}

read -p "MONGO_USER [${DEFAULT_MONGO_USER}]: " MONGO_USER
MONGO_USER=${MONGO_USER:-$DEFAULT_MONGO_USER}

read -p "MONGO_DB [${DEFAULT_MONGO_DB}]: " MONGO_DB
MONGO_DB=${MONGO_DB:-$DEFAULT_MONGO_DB}

# Solicitar a senha do MongoDB com mascaramento
ask_password "MONGO_PASSWORD" "$DEFAULT_MONGO_PASSWORD"
echo "Senha do MongoDB definida."

# Cria o arquivo .env com os valores fornecidos
cat <<EOL > .env
## Geral Configs
SERVICE=$SERVICE
DOMAIN=$DOMAIN
POSTGRADE_VOLUME=$POSTGRADE_VOLUME

## Admin
ADMIN_PORT=$ADMIN_PORT

## Postgres sets
POSTGRES_PORT=$POSTGRES_PORT
POSTGRES_USER=$POSTGRES_USER
POSTGRES_DATABASE=$POSTGRES_DATABASE
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

## Mongo sets
MONGO_PORT=$MONGO_PORT
MONGO_DB=$MONGO_DB
MONGO_USER=$MONGO_USER
MONGO_PASSWORD=$MONGO_PASSWORD
EOL

echo ".env criado com sucesso."
