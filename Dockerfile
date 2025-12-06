# ====== BUILD ======
FROM eclipse-temurin:17-jdk AS build
WORKDIR /app

# Maven wrapper + konfiguracja
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .

RUN chmod +x mvnw
RUN ./mvnw -q -Dmaven.test.skip=true dependency:go-offline

# Kod źródłowy
COPY src src

# Budowa JAR
RUN ./mvnw -q -Dmaven.test.skip=true package

# ====== RUNTIME ======
FROM eclipse-temurin:17-jre
WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]
