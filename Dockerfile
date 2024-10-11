# Usar a imagem base do PostgreSQL 17.0 em Alpine
FROM postgres:17.0-alpine3.19
EXPOSE 5432 27017
WORKDIR /app
LABEL name="postgrade" version="1.0" description="Imagem de PostgresSQL putencializado com http"


#RUN echo 'http://dl-cdn.alpinelinux.org/alpine/v3.6/main' >> /etc/apk/repositories
#RUN echo 'http://dl-cdn.alpinelinux.org/alpine/v3.6/community' >> /etc/apk/repositories
#RUN apk add --no-cache \
#    mongodb mongodb-tools

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

run su postgres -c "initdb -D /var/lib/postgresql/data --auth-host=md5"

COPY bin .
RUN chmod +x ./bin/postgrade.sh
RUN chmod +x ./bin/setup.sh

RUN ./bin/setup.sh

RUN npm install typescript -g
COPY package.json .

RUN npm install --production

COPY . .
RUN tsc | echo "ok"

CMD ["./bin/postgrade.sh"]
