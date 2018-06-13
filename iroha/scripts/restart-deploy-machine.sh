#!/bin/sh

cd ../docker
docker-compose up --force-recreate --build -d
docker exec -it docker_iroha-ansible-deploy_1 /bin/bash
