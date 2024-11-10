# Use a imagem oficial do Node.js como base
FROM node:20-alpine

LABEL name="Postgrade PGAdmin" \
    version="1.0"

# Expor a porta onde a aplicação Express estará rodando
EXPOSE 80

VOLUME [ "/etc/postgrade" ]

# Definir o diretório de trabalho dentro do contêiner
WORKDIR /usr/src/app

# Definir a variável de ambiente para o PostgreSQL
ENV POSTGRES_SUPERUSER=postgres
ENV POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
ENV POSTGRES_MANAGE=postgres
ENV POSTGRES_HOST=pg.db.srv

# Define volumes

RUN mkdir -p  "/etc/postgrade"
RUN chmod 777 "/etc/postgrade"

# Instalar dependências do PostgreSQL (pg_dump, psql)
RUN apk update && \
    apk add --no-cache postgresql-client


# Copiar o package.json e o package-lock.json para instalar as dependências
COPY admin/package*.json .

# Instalar as dependências do Node.js
RUN npm install --omit=dev

# Copiar o código-fonte da aplicação para dentro do contêiner
COPY admin admin
COPY libs libs



# Iniciar a aplicação Node.js
CMD [ "node", "admin/server" ]
