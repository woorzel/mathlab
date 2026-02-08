# ===== 1) build front =====
FROM node:20-alpine AS front
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ===== 2) build back =====
FROM maven:3.9-eclipse-temurin-21 AS back
WORKDIR /app
COPY backend/Mathla/pom.xml backend/pom.xml
COPY backend/Mathla/src backend/src
# wrzuć zbudowany front do zasobów Springa
COPY --from=front /app/frontend/dist backend/Mathla/src/main/resources/static
WORKDIR /app/backend
RUN mvn -DskipTests package

# ===== 3) runtime =====
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=back /app/backend/target/*.jar app.jar
# Render/Railway często ustawiają PORT env
ENV SERVER_PORT=8080
EXPOSE 8080
CMD ["sh","-c","java -jar app.jar --server.port=${PORT:-8080}"]
