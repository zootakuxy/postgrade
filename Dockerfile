# Usar a imagem base do PostgreSQL 17.0 em Alpine
FROM postgres:17.0-alpine3.19

# Instalar dependências necessárias para a compilação
RUN apk add --no-cache \
    build-base \
    git \
    curl-dev \
    postgresql-dev \
    musl-dev

# Clonar o repositório da extensão pgsql-http
RUN git clone --branch master https://github.com/pramsey/pgsql-http.git /pgsql-http

# Compilar e instalar a extensão pgsql-http
RUN cd /pgsql-http && \
    make && \
    make install && \
    rm -rf /pgsql-http

# Remover as dependências de compilação
RUN apk del build-base git curl-dev postgresql-dev musl-dev

# Expor a porta padrão do PostgreSQL
EXPOSE 5432
LABEL name="postgrade" version="1.0" \
    description="Imagem de PostgresSQL putencializado com http"