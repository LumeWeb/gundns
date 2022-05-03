FROM node:16-alpine
LABEL maintainer="Derick Hammer <contact@lumeweb.com>"

WORKDIR /app

RUN apk add git

ADD src src/
ADD *.json ./
ADD yarn.lock ./

# Install all dependencies needed for production build
RUN yarn && rm node_modules/@types/web -rf && yarn build

# Clean
RUN rm -rf node_modules
RUN yarn cache clean

# install production dependencies only
RUN yarn install --production

CMD ["npm","start"]
