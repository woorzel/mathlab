# ===== STAGE 1: build (Maven + JDK) =====
FROM eclipse-temurin:17-jdk AS build

WORKDIR /app

# skopiuj pliki mvnw, .mvn, pom.xml z backend/Mathla
COPY backend/Mathla/mvnw .
COPY backend/Mathla/.mvn .mvn
COPY backend/Mathla/pom.xml .

# uprawnienia i pobranie zależności
RUN chmod +x mvnw
RUN ./mvnw -q -Dmaven.test.skip=true dependency:go-offline

# kod źródłowy
COPY backend/Mathla/src src

# budowanie JAR
RUN ./mvnw -q -DskipTests=true package


# ===== STAGE 2: runtime =====
FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
