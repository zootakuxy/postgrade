# Usar a imagem base do PostgreSQL 17.0 em Alpine


ARG PG_VERSION=17
ARG VARIATION=alpine3.19
FROM postgres:${PG_VERSION}-${VARIATION}
LABEL name="postgrade" \
    version="1.0" \
    description="Imagem de PostgresSQL putencializado com http"

EXPOSE 5432 27017 3000
WORKDIR /app

ARG SETUP=/postgrade/setups
ARG CLUSTER=/var/lib/postgresql/data

ENV POSTGRADE_POSTGRES_CLUSTER ${CLUSTER}
ENV POSTGRADE_SETUP ${SETUP}
ENV POSTGRADE_POSTGRES_VERSION=$PG_VERSION

VOLUME ${POSTGRADE_POSTGRES_CLUSTER}
VOLUME ${POSTGRADE_SETUP}

# Instalar dependências necessárias para a compilação
RUN apk add --no-cache \
    build-base \
    git \
    curl-dev \
    postgresql-dev \
    musl-dev \
    openrc \
    nodejs npm

# Clonar o repositório da extensão pgsql-http
RUN git clone --branch master https://github.com/pramsey/pgsql-http.git /pgsql-http

# Compilar e instalar a extensão pgsql-http
RUN cd /pgsql-http && \
    make && \
    make install && \
    rm -rf /pgsql-http

run su postgres -c "initdb -D ${POSTGRADE_POSTGRES_CLUSTER} --auth-host=md5"

# Copy mandatories files
RUN mkdir bin
COPY bin/postgrade.sh bin
COPY bin/setup.sh bin
COPY package.json .

# Grant mandated permissions
RUN chmod +x bin/postgrade.sh
RUN chmod +x bin/setup.sh

# Build setups
RUN ./bin/setup.sh
RUN npm install typescript -g
RUN npm install --production

# Copy another files
COPY . .
RUN tsc | echo "ok"
CMD ["./bin/postgrade.sh"]
