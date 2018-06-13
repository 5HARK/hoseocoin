FROM hyperledger/iroha:develop

RUN apt-get update && apt-get install -y software-properties-common
RUN apt-add-repository -y ppa:ansible/ansible
RUN apt-get update && apt-get install -y ansible
WORKDIR /usr/src/app
