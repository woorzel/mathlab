# ===== STAGE 1: build (Maven + JDK) =====
FROM eclipse-temurin:17-jdk AS build

# Katalog roboczy wewnątrz kontenera
WORKDIR /app

# Pliki mavenowe z katalogu backend
COPY backend/mvnw .
COPY backend/.mvn .mvn
COPY backend/pom.xml .

# Uprawnienia + pobranie zależności
RUN chmod +x mvnw
RUN ./mvnw -q -Dmaven.test.skip=true dependency:go-offline

# Kod źródłowy z katalogu backend
COPY backend/src src

# Budowa JAR (bez testów)
RUN ./mvnw -q -DskipTests=true package


# ===== STAGE 2: lekki obraz do uruchomienia =====
FROM eclipse-temurin:17-jre

WORKDIR /app

# Kopiujemy zbudowany JAR z poprzedniego etapu
# (zakładamy, że w target jest dokładnie jeden plik .jar)
COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
