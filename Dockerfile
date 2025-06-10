FROM node:20-alpine

WORKDIR /app

COPY yarn.lock package.json ./

RUN yarn install

COPY . .

RUN mkdir -p /app/data

EXPOSE 3001

CMD ["yarn", "start"]