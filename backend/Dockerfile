# Builds the React client and the Spring Boot backend into one image.
# Build from the REPO ROOT:  docker build -f backend/Dockerfile -t jack .

# 1. React client (frontend/client) -> frontend/client/dist
FROM node:22 AS client
WORKDIR /repo/frontend
COPY frontend/package.json frontend/package-lock.json ./
COPY frontend/client/package.json client/
RUN npm ci
COPY frontend/client/ client/
RUN npm run build -w client

# 2. Spring Boot jar, with the client copied into static/
FROM eclipse-temurin:25-jdk AS backend
WORKDIR /repo/backend
COPY backend/mvnw backend/pom.xml ./
COPY backend/.mvn/ .mvn/
RUN chmod +x mvnw && ./mvnw -q dependency:go-offline
COPY backend/src/ src/
COPY --from=client /repo/frontend/client/dist/ src/main/resources/static/
RUN ./mvnw -q -DskipTests package && cp target/backend-*.jar /app.jar

# 3. Runtime
FROM eclipse-temurin:25-jre
COPY --from=backend /app.jar /app/app.jar
# Let the heap use most of the container's memory (Render's free plan has 512 MB).
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
EXPOSE 4000
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
