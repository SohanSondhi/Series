FROM node:20-alpine

# Install postgresql-client for pg_isready
RUN apk add --no-cache postgresql-client

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Make startup script executable
RUN chmod +x scripts/start.sh

EXPOSE 5001

CMD ["./scripts/start.sh"]

