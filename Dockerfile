# ===== STAGE 1: build (Maven + JDK 21) =====
FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /app

# kopiujemy pom.xml z backend/Mathla
COPY backend/Mathla/pom.xml .

# pobieramy zależności (cache)
RUN mvn -q -Dmaven.test.skip=true dependency:go-offline

# kopiujemy kod źródłowy
COPY backend/Mathla/src ./src

# budujemy JAR (bez testów)
RUN mvn -q -DskipTests package


# ===== STAGE 2: runtime (JRE 21 + JAR) =====
FROM eclipse-temurin:21-jre

WORKDIR /app

# kopiujemy zbudowany JAR z poprzedniego etapu
COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
