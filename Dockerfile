# Stage 1
FROM node:16.2-alpine AS build-step
WORKDIR /app
COPY . .
RUN npm ci && npm run build


# Stage 2
FROM nginx:1.20-alpine
COPY --from=build-step /app/dist/aerodyne /usr/share/nginx/html
EXPOSE 80
