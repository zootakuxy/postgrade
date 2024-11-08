# Use a imagem oficial do Node.js como base
FROM node:18-alpine

LABEL name="Postgrade p2m" \
    version="1.0"
# Expor a porta onde a aplicação Express estará rodando
EXPOSE 5000

# Definir o diretório de trabalho dentro do contêiner
WORKDIR /usr/src/app

# Define volumes
VOLUME [ "/etc/postgrade" ]
RUN mkdir -p  "/etc/postgrade"
RUN chmod 777 "/etc/postgrade"

# Copiar o package.json e o package-lock.json para instalar as dependências
COPY p2m/package*.json .

# Instalar as dependências do Node.js
RUN npm install --omit=dev

# Copiar o código-fonte da aplicação para dentro do contêiner
COPY admin ./
COPY libs ../libs

# Expor a porta onde a aplicação estará rodando (opcional)

# Definir variáveis de ambiente para as conexões com PostgreSQL e MongoDB
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=mysecretpassword
ENV POSTGRES_DB=mydatabase
ENV POSTGRES_HOST=postgres
ENV MONGO_URI=mongodb://root:rootpassword@mongo:27017

# Iniciar a aplicação Node.js
CMD ["node", "server"]
