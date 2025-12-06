# ===== STAGE 1: build (Maven + JDK) =====
FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /app

# kopiujemy sam pom.xml z backend/Mathla
COPY backend/Mathla/pom.xml .

# pobieramy zależności (cache'uje się osobno, więc kolejne buildy są szybsze)
RUN mvn -q -Dmaven.test.skip=true dependency:go-offline

# kopiujemy kod źródłowy
COPY backend/Mathla/src ./src

# budujemy JAR
RUN mvn -q -DskipTests package


# ===== STAGE 2: runtime (tylko JRE + JAR) =====
FROM eclipse-temurin:17-jre

WORKDIR /app

# kopiujemy zbudowany JAR z poprzedniego etapu
COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
