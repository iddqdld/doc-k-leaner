FROM alpine:latest

# Intentional misconfigurations for demo scanning
ENV APP_SECRET_KEY="hardcoded-demo-secret"

RUN apk add curl \
    && curl -sSL https://example.com/install.sh | sh

USER root

