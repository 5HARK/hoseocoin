# Hoseocoin App middleware
호서코인 앱 중계서버
## Requirements
- [Docker](https://www.docker.com/)

## 구동 방법
의존성 설치
```
sudo apt install docker docker-compose
```

서버 도커 이미지 생성 및 빌드
```
cd docker
./clean-and-recreate-all.sh
```

서버 도커 이미지 실행
```
cd docker
./start.sh
```
