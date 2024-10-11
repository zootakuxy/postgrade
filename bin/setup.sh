if [ -z "$SUPERUSER_PASSWORD" ]; then
  echo "A variável de ambiente SUPERUSER_PASSWORD não está definida. Abortando."
  exit 0
fi

# Define o nome do usuário superusuário do PostgreSQL, geralmente 'postgres'
SUPERUSER="postgres"

# Define a senha do superusuário
echo "Atribuindo senha ao superusuário PostgreSQL..."
sudo -u postgres psql -c "ALTER USER $SUPERUSER WITH PASSWORD '${SUPERUSER_PASSWORD}';"

if [ $? -eq 0 ]; then
  echo "Senha atribuída com sucesso ao superusuário PostgreSQL."
else
  echo "Erro ao tentar definir a senha do superusuário PostgreSQL."
fi