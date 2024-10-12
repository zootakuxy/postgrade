#sh
if [ -z "${POSTGRADE_POSTGRES_PASSWORD}" ]; then
  echo "A variável de ambiente SUPERUSER_PASSWORD não está definida. Abortando."
  exit 0
fi

mkdir -p "/postgrade/superuser"
echo "${POSTGRADE_POSTGRES_PASSWORD}" > /postgrade/superuser/password
su postgres -c "initdb \
                  -D ${POSTGRADE_POSTGRES_CLUSTER} \
                  --auth-host=md5 \
                  --username=${POSTGRADE_POSTGRES_SUPERUSER} \
                  --encoding=utf8 \
                  --pwfile=/postgrade/superuser/password"