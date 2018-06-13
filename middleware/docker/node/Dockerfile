FROM ubuntu:16.04

# Node.js 설치
RUN apt-get update && apt-get install --yes curl
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -
RUN apt-get install --yes nodejs
RUN apt-get install --yes build-essential

# 앱 디렉터리 생성
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# 앱 의존성 설치
RUN apt-get install -y lib32stdc++6
COPY package*.json ./
RUN npm install

# 앱 소스 추가
# COPY . .

EXPOSE 8080
CMD [ "npm", "start" ]
