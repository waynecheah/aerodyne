# Stage 1
FROM node:16.3-alpine AS build-step
WORKDIR /app
COPY . .
RUN npm ci && npm run build


# Stage 2
FROM nginx:1.25.4-alpine
COPY nginx.conf /etc/nginx/conf.d/configfile.template
COPY --from=build-step /app/dist/aerodyne /usr/share/nginx/html
ENV PORT 8080
ENV HOST 0.0.0.0
EXPOSE 8080
CMD sh -c "envsubst '\$PORT' < /etc/nginx/conf.d/configfile.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
