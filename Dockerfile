FROM node:latest
LABEL maintainer="Derick Hammer <contact@lumeweb.com>"

ARG branch=master

WORKDIR /
RUN git clone --single-branch --branch ${branch} https://github.com/LumeWeb/gundns.git app

WORKDIR /app

# Install all dependencies needed for production build
RUN yarn && yarn build

# Clean
RUN rm -rf node_modules
RUN yarn cache clean

# install production dependencies only
RUN yarn install --production

ENTRYPOINT ["npm","start"]
