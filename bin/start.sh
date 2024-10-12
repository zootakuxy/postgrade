set -e

# Arquivo de controle
SETUP_DONE="/postgrade/superuser/setup_done"

# Verifica se o setup já foi executado
if [ ! -f "$SETUP_DONE" ]; then
    echo "Executando o setup pela primeira vez..."
    ./bin/setup.sh
    touch "$SETUP_DONE"  # Cria o arquivo de controle
else
    echo "Setup já foi realizado anteriormente. Pulando."
fi

echo "POSTGRADE_POSTGRES_PASSWORD: $POSTGRADE_POSTGRES_PASSWORD"
su postgres -c "pg_ctl -D /var/lib/postgresql/data  start"
node server/index.js