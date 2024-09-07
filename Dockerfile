# create a dockerfile that builds nodejs image and compiles main.ts and runs the compiled main.js
FROM node:20-bullseye-slim As build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . njkllolmk

RUN npx tsc

EXPOSE 3000

CMD ["node", "dist/main.js"]