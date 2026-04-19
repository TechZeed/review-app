# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Single build arg — selects apps/web/config/appconfig.<APP_ENV>.json.
# See docs/specs/26-frontend-appconfig.
ARG APP_ENV=prod
ENV APP_ENV=$APP_ENV

RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
