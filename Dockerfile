#使用輕量級的 Node.js 映像檔作為基礎

FROM node:18-alpine

#設定工作目錄

WORKDIR /usr/src/app

#複製 package.json 和 package-lock.json

COPY package*.json ./

#安裝依賴

RUN npm install

#複製整個專案內容到容器

COPY . .

#曝露伺服器運行的 port

EXPOSE 3000

#啟動 Node.js 伺服器

CMD [ "node", "server.js" ]