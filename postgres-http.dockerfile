ARG PG_VERSION="17"
ARG VARIATION="alpine3.19"


FROM postgres:${PG_VERSION}-${VARIATION}

LABEL name="HTTPostgreSQL" \
    version="1.0" \
    description="Imagem de PostgresSQL putencializado com http"

EXPOSE 5432


# Instalar dependências necessárias para a compilação
RUN apk add --no-cache \
    build-base \
    git \
    curl-dev \
    postgresql-dev \
    musl-dev \
    openrc \

# Clonar o repositório da extensão pgsql-http
RUN git clone --branch master https://github.com/pramsey/pgsql-http.git /pgsql-http

# Compilar e instalar a extensão pgsql-http
RUN cd /pgsql-http && \
    make && \
    make install && \
    rm -rf /pgsql-http
