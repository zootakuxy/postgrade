# Use a imagem oficial do PostgreSQL como base
FROM postgres:16-alpine3.19

LABEL name="Postgrade PG" \
    version="1.0" description="Imagem de PostgresSQL putencializado com http"

# Expor a porta onde a aplicação Express estará rodando
EXPOSE 5432

# Definir o diretório de trabalho dentro do contêiner
WORKDIR /usr/src/app

# Define volumes
VOLUME [ "/etc/postgrade", "/var/lib/postgresql/data" ]

RUN mkdir -p  "/etc/postgrade"
RUN chmod 777 "/etc/postgrade"

# pg-http Instalation
# https://github.com/pramsey/pgsql-http

RUN echo 'http://dl-cdn.alpinelinux.org/alpine/v3.9/main' >> /etc/apk/repositories
RUN echo 'http://dl-cdn.alpinelinux.org/alpine/v3.9/community' >> /etc/apk/repositories
RUN apk update

# Instalar dependências necessárias para a compilação
RUN apk add --no-cache build-base
RUN apk add --no-cache git
RUN apk add --no-cache curl-dev
RUN apk add --no-cache curl
RUN apk add --no-cache postgresql-dev
RUN apk add --no-cache musl-dev
RUN apk add --no-cache openrc

# Clonar o repositório da extensão pgsql-http
RUN git clone --branch master https://github.com/pramsey/pgsql-http.git /pgsql-http

# Compilar e instalar a extensão pgsql-http
RUN cd /pgsql-http && \
    make && \
    make install && \
    rm -rf /pgsql-http


RUN tsc | echo "ok"
