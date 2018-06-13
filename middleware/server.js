'use strict';

const express = require('express');
const cors = require('cors');

const PORT = 8080;
const HOST = '0.0.0.0';
const REDIS_HOST = 'redis';
const IROHA_HOST = 'majamaja7438.cafe24.com:50051';
const HOSEOCOIN_ASSET_NAME = 'coin';
const HOSEOCOIN_DOMAIN_NAME = 'hoseocoin';
const ADMIN_DOMAIN_NAME = 'admin';
const ADMIN_NAME = 'admin';
const ADMIN_ID = ADMIN_NAME + '@' + ADMIN_DOMAIN_NAME;
const HOSEOCOIN_MONEYCREATOR_NAME = 'admin';
const HOSEOCOIN_MONEYCREATOR_ID = HOSEOCOIN_MONEYCREATOR_NAME + '@' + ADMIN_DOMAIN_NAME;
const HOSEOCOIN_ASSET_ID = HOSEOCOIN_ASSET_NAME + '#' + HOSEOCOIN_DOMAIN_NAME;
const TRANSACTION_LATENCY = 5000; // 대기시간(ms)

const app = express();
const redis = require('redis');

const iroha = require('iroha-lib');
const txBuilder = new iroha.ModelTransactionBuilder();
const queryBuilder = new iroha.ModelQueryBuilder();
const protoTxHelper = new iroha.ModelProtoTransaction();
const protoQueryHelper = new iroha.ModelProtoQuery();
const fs = require('fs');
const adminPriv = fs.readFileSync('keypairs/admin@test.priv').toString();
const adminPub = fs.readFileSync('keypairs/admin@test.pub').toString();

const crypto = require('crypto');         // nodejs 암호화 라이브러리
const ircrypto = new iroha.ModelCrypto(); // iroha 암호화 라이브러리
const hcrypto = {                         // hoseocoin 암호화 라이브러리
    genRandomString: (length) => {
        return crypto.randomBytes(Math.ceil(length / 2))
            .toString('hex') /** convert to hexadecimal format */
            .slice(0, length);   /** return required number of characters */
    },

    sha512: (password, salt) => {
        let hash = crypto.createHmac('sha512', salt); /** Hashing algorithm sha512 */
        hash.update(password);
        let value = hash.digest('hex');
        return {
            salt: salt,
            passwordHash: value
        };
    },

    saltHashPassword: (userpassword) => {
        let salt = hcrypto.genRandomString(16); /** Gives us salt of length 16 */
        let passwordData = hcrypto.sha512(userpassword, salt);
        return passwordData;
    }
};
const blob2array = (blob) => {
    let bytearray = new Uint8Array(blob.size());
    for (let i = 0; i < blob.size(); ++i) {
        bytearray[i] = blob.get(i);
    }
    return bytearray;
};

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

let protoEnumName = {};
const getProtoEnumName = (obj, key, value) => {
    if (protoEnumName.hasOwnProperty(key)) {
        if (protoEnumName[key].length < value) {
            return 'unknown';
        } else {
            return protoEnumName[key][value];
        }
    } else {
        protoEnumName[key] = [];
        for (var k in obj) {
            let idx = obj[k];
            if (isNaN(idx)) {
                console.log(
                    'getProtoEnumName:wrong enum value, now is type of ' +
			typeof idx +
			' should be integer'
                );
            } else {
                protoEnumName[key][idx] = k;
            }
        }
        return getProtoEnumName(obj, key, value);
    }
};

const getUserKeys = (id, pw) => {
    return new Promise((resolve, reject) => {
        let client = redis.createClient({ host: REDIS_HOST });
        client.on('error', (err) => {
            console.log('Error ' + err);
            reject();
        });
        client.get('hoseocoin:user:' + id + ':enc_priv', (error, result) => {
            let tmp = hcrypto.sha512(pw, '').passwordHash;
            let encryptor = require('simple-encryptor')(tmp);
            let userPriv = encryptor.decrypt(result);
            client.get('hoseocoin:user:' + id + ':pub', (error, result) => {
                let userPub = result;
                resolve(ircrypto.convertFromExisting(userPub, userPriv));
            });
        });
    });
};

const isUserExist = (id) => {
    return new Promise((resolve, reject) => {
	let client = redis.createClient({ host: REDIS_HOST });
	client.on('error', (err) => {
	    reject(err);
	});
	client.exists('hoseocoin:user:' + id + ':pw_hash', (err, reply) => {
	    if(reply == 1){
		resolve(true);
	    }else{
		resolve(false);
	    }
	});
    });
};

const checkUserPw = (id, pw) => {
    return new Promise((resolve, reject) => {
	let client = redis.createClient({ host: REDIS_HOST });
	const {promisify} = require('util');
	const getAsync = promisify(client.get).bind(client);
        
        client.on('error', (err) => {
	    console.log('Error ' + err);
	    reject();
        });
	
	(async () => {
	    let pw_hash = getAsync('hoseocoin:user:' + id + ':pw_hash');
	    let pw_salt = getAsync('hoseocoin:user:' + id + ':pw_salt');
	    return new Array(await pw_hash, await pw_salt);
	})().then((array) => {
	    if(hcrypto.sha512(pw, array[1]).passwordHash === array[0]){
		resolve(true);
	    }else{
		resolve(false);
	    }
	});
    });
};

const sendTransaction = (tx, keys) => {
    return new Promise((resolve, reject) => {
	// 트랜잭션 서명 및 바이너리 데이터로 변환
	let txblob = protoTxHelper.signAndAddSignature(tx, keys).blob();
	let txArray = blob2array(txblob);
	// proto 객체 생성, iroha 네트워크로 전송
	let blockTransaction = require('iroha-lib/pb/block_pb.js').Transaction;
	let protoTx = blockTransaction.deserializeBinary(txArray);

	let grpc = require('grpc');
	let endpointGrpc = require('iroha-lib/pb/endpoint_grpc_pb.js');
	let clientGrpc = new endpointGrpc.CommandServiceClient(
	    IROHA_HOST,
	    grpc.credentials.createInsecure()
	);
	let txHashBlob = tx.hash().blob();
	let txHash = blob2array(txHashBlob);
	console.log('Submit Transaction...');
	clientGrpc.torii(protoTx, (err, data) => {
	    if (err) {
		reject(err);
	    } else {
		console.log('Submitted transaction successfully');
		resolve(txHash);
	    }
	});
    });
};

const sendTransactionStatusRequest = (txHash) => {
    return new Promise((resolve, reject) => {
	let grpc = require('grpc');
	let endpointGrpc = require('iroha-lib/pb/endpoint_grpc_pb.js');
	let clientGrpc = new endpointGrpc.CommandServiceClient(
	    IROHA_HOST,
	    grpc.credentials.createInsecure()
	);
	console.log('Send Transaction status request...');
	// create status request
	let endpointPb = require('iroha-lib/pb/endpoint_pb.js');
	let request = new endpointPb.TxStatusRequest();
	request.setTxHash(txHash);
	clientGrpc.status(request, (err, response) => {
	    if (err) {
		reject(err);
	    } else {
		let status = response.getTxStatus();
		let TxStatus = require('iroha-lib/pb/endpoint_pb.js').TxStatus;
		let statusName = getProtoEnumName(
		    TxStatus,
		    'iroha.protocol.TxStatus',
		    status
		);
		console.log('Got Transaction status: ' + statusName);
		resolve(statusName);
	    }
	});
    });
};

const sendQuery = (qry, keys) => {
    return new Promise((resolve, reject) => {
	let queryBlob = protoQueryHelper.signAndAddSignature(qry, keys).blob();
	let pbQuery = require('iroha-lib/pb/queries_pb.js').Query;
	let queryArray = blob2array(queryBlob);
	let protoQuery = pbQuery.deserializeBinary(queryArray);
	let grpc = require('grpc');
	let endpointGrpc = require('iroha-lib/pb/endpoint_grpc_pb.js');
	let clientGrpc = new endpointGrpc.QueryServiceClient(
	    IROHA_HOST,
	    grpc.credentials.createInsecure()
	);
	console.log('Submit Query...');
	clientGrpc.find(protoQuery, (err, response) => {
	    if (err) {
		reject(err);
	    } else {
		console.log('Submitted query successfully');
		let type = response.getResponseCase();
		let responsePb = require('iroha-lib/pb/responses_pb.js');
		let name = getProtoEnumName(
		    responsePb.QueryResponse.ResponseCase,
		    'iroha.protocol.QueryResponse',
		    type
		);
		if (name === 'ERROR_RESPONSE') {
		    resolve({
			status: name
		    });
		} else {
		    resolve({
			status: name,
			response: response
		    });
		}
	    }
	});
    });
};

const pubkeyToString = (key) => {
    let res = '';
    for(let i in key){
	res += key[i].toString(16);
    }
    return res;
};

const signatureToJSON = (sign) => {
    let res = {
	pubkey: pubkeyToString(sign.getPubkey()),
	signature: pubkeyToString(sign.getSignature())
    };
    return res;
};

const signaturesListToJSON = (sign_list) => {
    let res = new Array();
    for(let sign of sign_list){
	res.push(signatureToJSON(sign));
    };
    return res;
};

const amountToInteger = (amount) => {
    let uint64_number = '18446744073709551616' * 1;
    let res = 0;
    res += amount.getValue().getFirst() * 1;
    res *= uint64_number;
    res += amount.getValue().getSecond() * 1;
    res *= uint64_number;
    res += amount.getValue().getThird() * 1;
    res *= uint64_number;
    res += amount.getValue().getFourth() * 1;
    return res;
};

const addAssetQuantityToJSON = (add_ast) => {
    let res = {
	accountId: add_ast.getAccountId(),
	assetId: add_ast.getAssetId(),
	amount: amountToInteger(add_ast.getAmount())
    };
    return res;
};

const subtractAssetQuantityToJSON = (sub_ast) => {
    let res = {
	accountId: sub_ast.getAccountId(),
	assetId: sub_ast.getAssetId(),
	amount: amountToInteger(sub_ast.getAmount())
    };
    return res;
};

const transferAssetToJSON = (trn) => {
    let res = {
	srcAccountId: trn.getSrcAccountId(),
	destAccountId: trn.getDestAccountId(),
	assetId: trn.getAssetId(),
	description: trn.getDescription(),
	amount: amountToInteger(trn.getAmount())
    };
    return res;
};

const commandToJSON = (cmd) => {
    let type = cmd.getCommandCase();
    let commandPb = require('iroha-lib/pb/commands_pb.js');
    let name = getProtoEnumName(
	commandPb.Command.CommandCase,
	'iroha.protocol.Command',
	type
    );
    let res = {};

    if(name === 'TRANSFER_ASSET'){
	res[name] = transferAssetToJSON(cmd.getTransferAsset());
    }
    else if(name === 'ADD_ASSET_QUANTITY'){
	res[name] = addAssetQuantityToJSON(cmd.getAddAssetQuantity());
    }
    else if(name === 'SUBTRACT_ASSET_QUANTITY'){
	res[name] = subtractAssetQuantityToJSON(cmd.getSubtractAssetQuantity());
    }
    else{
	res[name] = {};
    }

    return res;
};

const commandsListToJSON = (cmd_list) => {
    let res = new Array();
    for(let cmd of cmd_list){
	res.push(commandToJSON(cmd));
    };
    return res;
};

const transactionPayloadToJSON = (tx_payload) => {
    let res = {
	commandsList: commandsListToJSON(tx_payload.getCommandsList()),
	creatorAccountId: tx_payload.getCreatorAccountId(),
	createdTime: tx_payload.getTxCounter()
    };
    return res;
};

const transactionToJSON = (tx) => {
    let res = {
	payload: transactionPayloadToJSON(tx.getPayload()),
	signatureList: signaturesListToJSON(tx.getSignatureList())
    };
    return res;
};

const transactionsListToJSON = (tx_list) => {
    let res = new Array();
    for(let tx of tx_list){
	res.push(transactionToJSON(tx));
    };
    return res;
};

// json 포맷 응답 설정
app.use(express.json());
// CORS 설정
app.use(cors());

app.get('/', (req, res) => {
    res.send('Hello world\n');
});

app.get('/redistest', (req, res) => {
    let client = redis.createClient({ host: REDIS_HOST });
    client.on('error', (err) => {
	console.log('Error ' + err);
    });

    client.set('ping', 'pong', redis.print);

    client.get('pong', (error, result) => {
	if (error) throw error;
	console.log('GET result ->', result);
	res.send(result);
    });
});

// 로그인 controller
app.post('/hoseocoin/login', (req, res) => {
    /* POST request json 포맷
       {
       id: '학번',
       pw: '비밀번호'
       }
    */

    // 필수 request 인자가 비어 있을 경우
    if (!req.body.id || !req.body.pw) {
	return res.status(400).json({ error: 'Empty request fields' });
    }

    (async () => {
	// 존재 하는 유저인지 비밀번호는 올바른지 확인
	if(await isUserExist(req.body.id) && await checkUserPw(req.body.id, req.body.pw)){
	    return res.status(200).send();
	}else{
	    return res.status(400).json({ error: 'Wrong credentials' });
	}
    })();
});

// 회원 가입 controller
app.post('/hoseocoin/register', (req, res) => {
    /* POST request json 포맷
       {
       id: '학번',
       pw: '비밀번호',
       name: '실명'
       }
    */

    // 필수 request 인자가 비어 있을 경우
    if (!req.body.id || !req.body.pw || !req.body.name) {
	return res.status(400).json({ error: 'Empty request fields' });
    }

    (async () => {
	// 존재 하는 유저인지 먼저 확인
	if(await isUserExist(req.body.id)){
	    return res.status(400).json({ error: 'Id already exist' });
	}

	let req_id = req.body.id;
	let req_pw = req.body.pw;
	let req_name = req.body.name;
	let nameKeyName = 'name';
	let client = redis.createClient({ host: REDIS_HOST });
	client.on('error', (err) => {
	    console.log('Error ' + err);
	});
	// redis db에 계정의 비밀번호 해시값과 솔트값 저장
	let password_data = hcrypto.saltHashPassword(req_pw);
	client.set('hoseocoin:user:' + req_id + ':pw_hash', password_data.passwordHash);
	client.set('hoseocoin:user:' + req_id + ':pw_salt', password_data.salt);

	// iroha 키페어(ed25519) 생성
	let newKeypair = ircrypto.generateKeypair();

	// 사용자의 비밀번호로(Hashing 는 자릿수 늘릴려고)으로 개인키 암호화(AES256)
	let tmp = hcrypto.sha512(req_pw, '').passwordHash;
	let encryptor = require('simple-encryptor')(tmp);
	let encrypted_privatekey = encryptor.encrypt(newKeypair.privateKey().hex());

	// 사용자의 공개키 개인키 서버에 저장
	client.set('hoseocoin:user:' + req_id + ':enc_priv', encrypted_privatekey);
	client.set('hoseocoin:user:' + req_id + ':pub', newKeypair.publicKey().hex());

	// 트랜잭션 빌드에 필요한 정보들 초기화
	let adminKeys = ircrypto.convertFromExisting(adminPub, adminPriv);
	let creator = ADMIN_ID; // 관리자 권한으로 트랜잭션 발생
	let currentTime = Date.now();

	// 트랜잭션 초기화
	let tx = txBuilder
	    .creatorAccountId(creator)
	    .createdTime(currentTime)
	    .createAccount(req_id, HOSEOCOIN_DOMAIN_NAME, newKeypair.publicKey())
	    .build();

	try{
	    // iroha 네트워크에 유저 생성 트렌잭션 보내기
	    let txHash = await sendTransaction(tx, adminKeys);
	    let success = false;
	    for(let i = 0; i < 6; i++){ // 최대 재시도 횟수 5회
		// 처리 되는 동안 대기
		console.log('[/hoseocoin/register] Sleep ' + TRANSACTION_LATENCY / 1000 + ' seconds...');
		await sleep(TRANSACTION_LATENCY);
		console.log('[/hoseocoin/register] Send Transaction1 status request...');
		// iroha 네트워크에 트랜잭션 처리 결과 질의
		let status = await sendTransactionStatusRequest(txHash);
		console.log('[/hoseocoin/register] Got Transaction1 status: ' + status);
		if(status === 'COMMITTED'){
		    success = true;
		    break;
		}else if(status === 'STATELESS_VALIDATION_SUCCESS' || status === 'STATEFUL_VALIDATION_SUCCESS'){
		    continue;
		}else{
		    console.error("[/hoseocoin/register] Your transaction1 wasn't committed");
		    break;
		}
	    }
	    // 트랜잭션1이 승인되지 않았을 경우
	    if(!success){
		return res.status(400).json({ error: "transaction1 wasn't committed" });
	    }
	    // 트랜잭션 빌드에 필요한 정보들 초기화
	    let creator = req_id + '@' + HOSEOCOIN_DOMAIN_NAME; // 유저 권한으로 트랜잭션 발생
	    let currentTime = Date.now();
	    let userKeys = await getUserKeys(req_id, req_pw);
	    // 트랜잭션2 초기화(관리자에게 송금 권한 부여)
	    tx = txBuilder
		.creatorAccountId(creator)
		.createdTime(currentTime)
		.grantPermission(ADMIN_ID, 'can_transfer_my_assets')
		.setAccountDetail(creator, nameKeyName, req_name)
		.build();

	    // iroha 네트워크에 관리자에게 송금 권한 부여 및 계정 정보 설정 트랜잭션 보내기
	    txHash = await sendTransaction(tx, userKeys);
	    success = false;
	    for(let i = 0; i < 6; i++){ // 최대 재시도 횟수 5회
		// 처리 되는 동안 대기
		console.log('[/hoseocoin/register] Sleep ' + TRANSACTION_LATENCY / 1000 + ' seconds...');
		await sleep(TRANSACTION_LATENCY);
		console.log('[/hoseocoin/register] Send Transaction2 status request...');
		// iroha 네트워크에 트랜잭션 처리 결과 질의
		let status = await sendTransactionStatusRequest(txHash);
		console.log('[/hoseocoin/register] Got Transaction2 status: ' + status);
		if(status === 'COMMITTED'){
		    success = true;
		    break;
		}else if(status === 'STATELESS_VALIDATION_SUCCESS' || status === 'STATEFUL_VALIDATION_SUCCESS'){
		    continue;
		}else{
		    console.error("[/hoseocoin/register] Your transaction2 wasn't committed");
		    break;
		}
	    }
	    // 트랜잭션2이 승인되지 않았을 경우
	    if(!success){
		return res.status(400).json({ error: "transaction2 wasn't committed" });
	    }else if(success){
		res.status(200).send();
	    }
	}catch(err){
	    console.error(err);
	    return res.status(500).send({error: 'Server error' });
	}
    })();
});

// 회원 탈퇴 controller
app.post('/hoseocoin/unregister', (req, res) => {
    /* POST request json 포맷
       {
       id: '학번',
       pw: '비밀번호'
       }
    */

    let client = redis.createClient({ host: REDIS_HOST });

    // 학번이나 비밀번호가 비어있을 경우
    if (!req.body.id || !req.body.pw) {
	return res.status(400).json({ error: 'Empty ID or PW' });
    }

    let req_id = req.body.id;
    let req_pw = req.body.pw;

    // 존재하는 계정인지 확인
    client.exists('hoseocoin:user:' + req_id + ':pw_hash', (err, reply) => {
	if (reply == 1) { // 탈퇴 루틴들 진행
	    client.del('hoseocoin:user:' + req_id + ':pw_hash');
	    client.del('hoseocoin:user:' + req_id + ':pw_salt');
	    client.del('hoseocoin:user:' + req_id + ':pub');
	    client.del('hoseocoin:user:' + req_id + ':enc_priv');
	    return res.status(200).send();
	} else {
	    return res.status(400).json({ error: 'Id doesn\'t exist' });
	}
    });
});

// 잔액 확인 controller
app.post('/hoseocoin/select-coin', (req, res) => {
    /* POST request json 포맷
       {
       id: '학번',
       pw: '비밀번호'
       }
    */

    // 필수 request 인자가 비어 있을 경우
    if (!req.body.id || !req.body.pw) {
	return res.status(400).json({ error: 'Empty request fields' });
    }

    (async () => {
	// 존재 하는 유저인지 먼저 확인
	if(!await isUserExist(req.body.id)){
	    return res.status(400).json({ error: "Id doesn't exist" });
	}

	let req_id = req.body.id;
	let req_pw = req.body.pw;
	let client = redis.createClient({ host: REDIS_HOST });
	client.on('error', (err) => {
	    console.log('Error ' + err);
	});

	// 쿼리 빌드에 필요한 정보들 초기화
	let creator = req_id + '@' + HOSEOCOIN_DOMAIN_NAME;
	let currentTime = Date.now();
	let startQueryCounter = 1;
	// 잔액 조회 쿼리 빌드
	let query = queryBuilder
		.creatorAccountId(creator)
		.createdTime(Date.now())
		.queryCounter(startQueryCounter)
		.getAccountAssets(creator, HOSEOCOIN_ASSET_ID)
		.build();

	try{
	    // 유저 키페어 초기화
	    let userKeys = await getUserKeys(req_id, req_pw);
	    // iroha 네트워크에 잔액 조회 쿼리 보내기
	    let resp = await sendQuery(query, userKeys);
	    console.log('[/hoseocoin/select-coin] Submitted query successfully');
	    // 잔액이 0원이거나 그 이상일때의 응답 처리 로직
	    if(resp.status === 'ERROR_RESPONSE' || resp.status === 'ACCOUNT_ASSETS_RESPONSE'){
		if(resp.response){
		    let accountAssets = resp.response.getAccountAssetsResponse().getAccountAsset();
		    let balance = amountToInteger(accountAssets.getBalance());
		    return res.status(200).send(balance.toString());
		}else{
		    return res.status(200).send('0');
		}
	    }else{
		new Error('[/hoseocoin/select-coin] Query response error');
	    }
	}catch(err){
	    console.error(err);
	    return res.status(500).send({error: 'Server error' });
	}
    })();
});

// 원화 입금(코인 발급) controller
app.post('/hoseocoin/won-to-coin', (req, res) => {
    /* POST request json 포맷
       {
       id: '학번',
       pw: '비밀번호',
       won: '입금 금액'
       }
    */
    /* 사전 가정 조건: 입금이 확인 되었어야 함-은행권 API 사용 필요 생략 */

    // 필수 request 인자가 비어 있을 경우
    if (!req.body.id || !req.body.pw || !req.body.won){
	return res.status(400).json({ error: 'Empty request fields' });
    }

    (async () => {
	// 존재 하는 유저인지 먼저 확인
	if(!await isUserExist(req.body.id)){
	    return res.status(400).json({ error: "Id doesn't exist" });
	}
	
	let req_id = req.body.id;
	let req_pw = req.body.pw;
	let req_won = req.body.won;
	let client = redis.createClient({ host: REDIS_HOST });
	client.on('error', (err) => {
	    console.log('Error ' + err);
	});

	// 트랜잭션 빌드에 필요한 정보들 초기화
	let adminKeys = ircrypto.convertFromExisting(adminPub, adminPriv);
	let creator = HOSEOCOIN_MONEYCREATOR_ID;
	let amount = req_won;
	let description = '원화 입금(코인 발급)';
	let currentTime = Date.now();

	// 트랜잭션 초기화
	let tx = txBuilder
	    .creatorAccountId(creator)
	    .createdTime(currentTime)
	    .addAssetQuantity(creator, HOSEOCOIN_ASSET_NAME + '#' + HOSEOCOIN_DOMAIN_NAME, amount)
	    .transferAsset(creator, req_id + '@' + HOSEOCOIN_DOMAIN_NAME, HOSEOCOIN_ASSET_ID, description, amount)
	    .build();

	// iroha 네트워크에 코인 발급 및 이체 트렌잭션 보내기
	console.log('[/hoseocoin/won-to-coin] Submit Transaction...');
	let txHash = await sendTransaction(tx, adminKeys);
	let success = false;
	for(let i = 0; i < 6; i++){ // 최대 재시도 횟수 5회
	    // 처리 되는 동안 대기
	    console.log('[/hoseocoin/won-to-coin] Sleep ' + TRANSACTION_LATENCY / 1000 + ' seconds...');
	    await sleep(TRANSACTION_LATENCY);
	    console.log('[/hoseocoin/won-to-coin] Send Transaction status request...');
	    // iroha 네트워크에 트랜잭션 처리 결과 질의
	    let status = await sendTransactionStatusRequest(txHash);
	    console.log('[/hoseocoin/won-to-coin] Got Transaction status: ' + status);
	    if(status === 'COMMITTED'){
		success = true;
		break;
	    }else if(status === 'STATELESS_VALIDATION_SUCCESS' || status === 'STATEFUL_VALIDATION_SUCCESS'){
		continue;
	    }else{
		console.error("[/hoseocoin/won-to-coin] Your transaction wasn't committed");
		break;
	    }
	}
	// 트랜잭션1이 승인되지 않았을 경우
	if(!success){
	    return res.status(400).json({ error: "transaction wasn't committed" });
	}else{
	    return res.status(200).send();
	}
    })();
});

// 원화 출금 controller
app.post('/hoseocoin/coin-to-won', (req, res) => {
    /* POST request json 포맷
       {
       id: '학번',
       pw: '비밀번호',
       won: '출금 금액',
       desc: '메시지'
       }
    */
    /* 사전 사후 조건: 모든 처리가 끝난후 원화를 유저의 계좌로 입금시켜 주어야 함-은행권 API 사용 생략 */

    // 필수 request 인자가 비어 있을 경우
    if (!req.body.id || !req.body.pw || !req.body.won){
	return res.status(400).json({ error: 'Empty request fields' });
    }
    
    (async () => {
	// 존재 하는 유저인지 먼저 확인
	if(!await isUserExist(req.body.id)){
	    return res.status(400).json({ error: 'Id already exist' });
	}
	
	let req_id = req.body.id;
	let req_pw = req.body.pw;
	let req_won = req.body.won;
	let req_desc = null;
	if(req.body.desc){
	    req_desc = req.body.desc;
	}
	let client = redis.createClient({ host: REDIS_HOST });
	client.on('error', (err) => {
	    console.log('Error ' + err);
	});

	// 트랜잭션 빌드에 필요한 정보들 초기화
	let adminKeys = ircrypto.convertFromExisting(adminPub, adminPriv);
	let creator = HOSEOCOIN_MONEYCREATOR_ID;
	let amount = req_won;
	let description = (req_desc == null ? '원화 출금(코인 파쇄)' : '원화 출금-' + req_desc);
	let currentTime = Date.now();

	// 트랜잭션 초기화(코인 회수 및 파쇄)
	let tx = txBuilder
	    .creatorAccountId(creator)
	    .createdTime(currentTime)
	    .transferAsset(req_id + '@' + HOSEOCOIN_DOMAIN_NAME, ADMIN_ID, HOSEOCOIN_ASSET_ID, description, amount)
	    .subtractAssetQuantity(creator, HOSEOCOIN_ASSET_ID, amount)
	    .build();

	// iroha 네트워크에 코인 회수 및 파쇄 트렌잭션 보내기
	console.log('[/hoseocoin/coin-to-won] Submit Transaction...');
	let txHash = await sendTransaction(tx, adminKeys);
	let success = false;

	for(let i = 0; i < 6; i++){ // 최대 재시도 횟수 5회
	    // 처리 되는 동안 대기
	    console.log('[/hoseocoin/coin-to-won] Sleep ' + TRANSACTION_LATENCY / 1000 + ' seconds...');
	    await sleep(TRANSACTION_LATENCY);
	    console.log('[/hoseocoin/coin-to-won] Send Transaction status request...');
	    // iroha 네트워크에 트랜잭션 처리 결과 질의
	    let status = await sendTransactionStatusRequest(txHash);
	    console.log('[/hoseocoin/coin-to-won] Got Transaction status: ' + status);
	    if(status === 'COMMITTED'){
		success = true;
		break;
	    }else if(status === 'STATELESS_VALIDATION_SUCCESS' || status === 'STATEFUL_VALIDATION_SUCCESS'){
		continue;
	    }else{
		console.error("[/hoseocoin/coin-to-won] Your transaction wasn't committed");
		break;
	    }
	}
	// 트랜잭션1이 승인되지 않았을 경우
	if(!success){
	    return res.status(400).json({ error: "transaction wasn't committed" });
	}else{
	    return res.status(200).send();
	}
    })();
});

// 코인 송금 controller
app.post('/hoseocoin/send-coin', (req, res) => {
    /* POST request json 포맷
       {
       id: '학번',
       pw: '비밀번호',
       to: '코인을 송금할 유저의 학번',
       amount: '송금할 액수',
       desc: '송금 메시지'
       }
    */

    // 필수 request 인자가 비어 있을 경우
    if (!req.body.id || !req.body.pw || !req.body.to || !req.body.amount) {
	return res.status(400).json({ error: 'Empty request fields' });
    }else if(req.body.amount * 1 == NaN){
	return res.status(400).json({ error: 'Amount must be integer' });
    }

    
    (async () => {
	// 존재 하는 유저인지 비밀번호는 올바른지 확인
	if(!await isUserExist(req.body.id) || !await checkUserPw(req.body.id, req.body.pw)){
	    return res.status(400).json({ error: 'Wrong credentials' });
	}
	
	// 트랜잭션 빌드
	let src_account_id = req.body.id + '@' + HOSEOCOIN_DOMAIN_NAME;
	let dest_account_id = req.body.to + '@' + HOSEOCOIN_DOMAIN_NAME;
	let amount = req.body.amount;
	let description = req.body.desc;
	if(!description){ description = ''; };
	let currentTime = Date.now();

	let tx = txBuilder
	    .creatorAccountId(src_account_id)
	    .createdTime(currentTime)
	    .transferAsset(src_account_id, dest_account_id, HOSEOCOIN_ASSET_ID, description, amount)
	    .build();
	try{
	    let keys = await getUserKeys(req.body.id, req.body.pw);
	    // iroha 네트워크에 송금 트랜잭션 전송
	    let txHash = await sendTransaction(tx, keys);
	    let success = false;

	    for(let i = 0; i < 6; i++){ // 최대 재시도 횟수 5회
		// 처리 되는 동안 대기
		console.log('[/hoseocoin/send-coin] Sleep ' + TRANSACTION_LATENCY / 1000 + ' seconds...');
		await sleep(TRANSACTION_LATENCY);
		console.log('[/hoseocoin/send-coin] Send Transaction status request...');
		// iroha 네트워크에 트랜잭션 처리 결과 질의
		let status = await sendTransactionStatusRequest(txHash);
		console.log('[/hoseocoin/send-coin] Got Transaction status: ' + status);
		if(status === 'COMMITTED'){
		    success = true;
		    break;
		}else if(status === 'STATELESS_VALIDATION_SUCCESS' || status === 'STATEFUL_VALIDATION_SUCCESS'){
		    continue;
		}else{
		    console.error("[/hoseocoin/coin-to-won] Your transaction wasn't committed");
		    break;
		}
	    }
	    // 트랜잭션1이 승인되지 않았을 경우
	    if(!success){
		return res.status(400).json({ error: "transaction wasn't committed" });
	    }else{
		return res.status(200).send();
	    }
	}catch(err){
	    console.error(err);
	    return res.status(500).json({ error: 'Server error' });
	}
    })();
});

// 거래 기록 조회 controller
app.post('/hoseocoin/select-transaction', (req, res) => {
    /* POST request json 포맷
       {
       id: '학번',
       pw: '비밀번호',
       who: '거래 기록 조회할 학번' - 선택 사항, 미기재시 본인 거래 기록 반환
       }
    */

    // 필수 request 인자가 비어 있을 경우
    if (!req.body.id || !req.body.pw) {
	return res.status(400).json({ error: 'Empty request fields' });
    }else if(!req.body.who){
	req.body.who = req.body.id;
    }

    (async () => {
	// 존재 하는 유저인지 비밀번호는 올바른지 확인
	if(!await isUserExist(req.body.id) || !await checkUserPw(req.body.id, req.body.pw)){
	    return res.status(400).json({ error: 'Wrong credentials' });
	}
	
	// 쿼리 빌드
	let creator = req.body.id + '@' + HOSEOCOIN_DOMAIN_NAME;
	let target = req.body.who + '@' + HOSEOCOIN_DOMAIN_NAME;
	let startQueryCounter = 1;
	let currentTime = Date.now();
	let query = queryBuilder
	    .creatorAccountId(creator)
	    .createdTime(currentTime)
	    .queryCounter(startQueryCounter)
	    .getAccountAssetTransactions(target, HOSEOCOIN_ASSET_ID)
	    .build();
	
	try{
	    let keys = await getUserKeys(req.body.id, req.body.pw);
	    let resp = await sendQuery(query, keys);
	    if(resp.status === 'ERROR_RESPONSE'){ // 거래 기록이 아예 없을 경우
		return res.status(200).send();
	    }
	    let transactions = resp.response.getTransactionsResponse().getTransactionsList();
	    let result = transactionsListToJSON(transactions);
	    // 시간순 오름차순 정렬
	    result.sort((a, b) => {
		return a.payload.createdTime - b.payload.createdTime;
	    });
	    return res.status(200).json(result);
	}catch(err){
	    console.error(err);
	    return res.status(500).json({ error: 'Server error' });
	}
    })();
});


app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);










