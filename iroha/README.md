# Hoseocoin Iroha deploy tools
호서코인 Iroha 배포 도구
## Requirements
- [Ansible](https://www.ansible.com/)
- [Docker](https://www.docker.com/)
- [Hyperledger Iroha](https://github.com/hyperledger/iroha)

## 의존성 설치
```
pip install -r requirements.txt
```

## 배포 방법
1. Iroha 피어 목록 파일, keypair, genesis 블록 생성
[공식 문서](https://hyperledger.github.io/iroha-api/#create-genesis-block) 를 참조하여 피어 목록 파일로 부터 keypair 와 genesis 블록을 생성
```
iroha-cli --genesis_block --peers_address peers.list
```

2. 생성 및 수정한 keypair 와 genesis 블록 파일들을 /tmp/iroha-files 위치로 복사
```
mkdir /tmp/iroha-files
cp ./* /tmp/iroha-files
```

3. 배포할 서버에 sshd 설정에 rsa 키를 통한 로그인 설정을 해둔뒤, 해당 rsa 키를 keypairs 폴더에 복사
```
mkdir keypairs
cp ~/.ssh/id_rsa* keypairs/
```

4. ansible 폴더 내에 위치한 ansible 스크립트의 설정 파일들을 배포할 서버와 의도할 배포 설정에 맞게 수정한다
[https://github.com/5HARK/hoseocoin/tree/master/iroha/ansible](https://github.com/5HARK/hoseocoin/tree/master/iroha/ansible)

5. 배포 스크립트 실행
```
ansible-playbook -i inventory/hosts_docker_cluster.list playbooks/iroha-docker-cluster/iroha-deploy.yml
```
