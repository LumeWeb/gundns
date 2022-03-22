FROM node:latest
LABEL maintainer="Derick Hammer <contact@lumeweb.com>"

WORKDIR /app

ADD src src/
ADD *.json ./
ADD yarn.lock ./

# Install all dependencies needed for production build
RUN yarn && yarn build

# Clean
RUN rm -rf node_modules
RUN yarn cache clean

# install production dependencies only
RUN yarn install --production

CMD ["npm","start"]
