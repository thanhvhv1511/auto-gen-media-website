FROM node:20-alpine

WORKDIR /app

# Copy package.json và cài đặt dependencies
COPY package.json .
RUN npm install

# Copy source code
COPY ./src /app/src

# Khởi chạy luồng Worker polling
CMD ["npm", "start"]