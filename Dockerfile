ARG PG_VERSION="17"
ARG VARIATION="alpine3.19"


FROM postgres:${PG_VERSION}-${VARIATION}

LABEL name="postgrade" \
    version="1.0" \
    description="Imagem de PostgresSQL putencializado com http"

EXPOSE 5432 3000
WORKDIR /app

ARG SETUP="/postgrade/setups"
ARG CLUSTER="/var/lib/postgresql/data"
ARG SUPERUSER="postgres"

ENV POSTGRADE_POSTGRES_CLUSTER="${CLUSTER}"
ENV POSTGRADE_SETUP="${SETUP}"
ENV POSTGRADE_POSTGRES_VERSION="${PG_VERSION}"
ENV POSTGRADE_POSTGRES_SUPERUSER="${SUPERUSER}"

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

RUN npm install typescript -g

# Copy mandatories files
RUN mkdir bin
COPY package.json .


RUN npm install --omit=dev

# Copy another files
COPY . .

# Grant mandated permissions
RUN chmod +x bin/start.sh
RUN chmod +x bin/setup.sh
RUN chmod +x bin/stop.sh

RUN tsc | echo "ok"


#ENTRYPOINT ["./bin/start.sh"]
CMD ["./bin/start.sh"]