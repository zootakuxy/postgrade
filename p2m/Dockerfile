# Use a imagem oficial do Node.js como base
FROM node:20-alpine

LABEL name="Postgrade PGAdmin" \
    version="1.0"

# Expor a porta onde a aplicação Express estará rodando
EXPOSE 5000

VOLUME [ "/etc/postgrade" ]

# Definir o diretório de trabalho dentro do contêiner
WORKDIR /usr/src/app

# Definir a variável de ambiente para o PostgreSQL
ENV POSTGRES_SUPERUSER=postgres
ENV POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
ENV POSTGRES_MANAGE=postgres
ENV POSTGRES_HOST=pg.postgrade

# Define volumes

RUN mkdir -p  "/etc/postgrade"
RUN chmod 777 "/etc/postgrade"

# Copiar o package.json e o package-lock.json para instalar as dependências
COPY p2m/package*.json .
RUN npm install --omit=dev

# Copiar o código-fonte da aplicação para dentro do contêiner
COPY p2m p2m
COPY libs libs

COPY /version.* .
COPY VERSION .
COPY REVISION .
COPY TAG .




# Iniciar a aplicação Node.js
CMD ["node", "p2m/server"]
