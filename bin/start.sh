set -e

# Diretório de dados do PostgreSQL
DATA_DIR="${POSTGRADE_POSTGRES_CLUSTER}"

# Verifica se a pasta de dados está vazia
if [ "$(ls -A "$DATA_DIR")" ]; then
    echo "A pasta de dados não está vazia. Pulando o setup."
else
    echo "Executando o setup pela primeira vez..."
    ./bin/setup.sh
fi

echo "POSTGRADE_POSTGRES_PASSWORD: $POSTGRADE_POSTGRES_PASSWORD"
su postgres -c "pg_ctl -D \"${DATA_DIR}\"  start"
node server/index.js