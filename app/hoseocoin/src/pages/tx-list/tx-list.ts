import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { Validators, FormBuilder, FormGroup } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';

import { HoseocoinProvider } from '../../providers/hoseocoin/hoseocoin';

import { ModalController } from 'ionic-angular';
import { ToastController } from 'ionic-angular';
import { LoadingController } from 'ionic-angular';

import { TxDescriptionModalPage } from '../../pages/tx-description-modal/tx-description-modal';
/**
 * Generated class for the TxListPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
    selector: 'page-tx-list',
    templateUrl: 'tx-list.html',
})
export class TxListPage {
    private txs;
    private view_txs;
    private txlist_form: FormGroup;
    private loading;

    constructor(public navCtrl: NavController, public navParams: NavParams,
        private currenyPipe: CurrencyPipe,
        private formBuilder: FormBuilder,
        private hoseocoinProvider: HoseocoinProvider,
        private toastCtrl: ToastController,
        private loadingCtrl: LoadingController,
        private modalCtrl: ModalController) {
        this.txlist_form = this.formBuilder.group({
            who: ['', Validators.required]
        });
    }

    ionViewDidLoad() {
        console.log('ionViewDidLoad TxListPage');
        this.txlist_form.value.id = this.hoseocoinProvider.getUserCredential().id;
        this.txlist_form.value.pw = this.hoseocoinProvider.getUserCredential().pw;
        this.txlist_form.value.who = this.hoseocoinProvider.getUserCredential().id;
        this.submit();
    }

    doRefresh(refresher) {
        this.txlist_form.value.id = this.hoseocoinProvider.getUserCredential().id;
        this.txlist_form.value.pw = this.hoseocoinProvider.getUserCredential().pw;
        this.txlist_form.value.who = this.hoseocoinProvider.getUserCredential().id;
        this.submit();
        refresher.complete();
    }

    submit() {
        this.loading = this.loadingCtrl.create({
            content: '거래 기록 조회중...'
        });
        this.loading.present();
        this.txlist_form.value.id = this.hoseocoinProvider.getUserCredential().id;
        this.txlist_form.value.pw = this.hoseocoinProvider.getUserCredential().pw;
        console.log(this.txlist_form.value);
        this.hoseocoinProvider.doSelectTx(this.txlist_form.value).subscribe(resp => {
            console.log("selectTx() Success");
            console.log(resp);
            if (resp.status == 200) {
                this.txs = resp.body.reverse();
                this.view_txs = this.generateViewTxList(this.txs);
                console.log(this.view_txs);
                this.loading.dismiss();
                this.toastCtrl.create({
                    message: '조회 완료',
                    duration: 3000
                }).present();
                this.txlist_form.reset();
            }
        }, err => {
            console.log("selectTx() Failed");
            console.log(err);
            this.loading.dismiss();
            this.toastCtrl.create({
                message: '조회 실패',
                duration: 3000
            }).present();
            this.txlist_form.reset();
        });
    }

    generateViewTxList(input): Array<any> {
        let txs = JSON.parse(JSON.stringify(input)); // deep copy
        let pad = (n: number, width: number) => {
            let prefix = '';
            if (n < 0) {
                n = n * -1;
                n = n - 1;
                prefix = '-';
            }
            let result = n + '';

            return result.length >= width ? prefix + result : prefix + new Array(width - result.length + 1).join('0') + result;
        };
        let result = new Array();
        for (let tx of txs) {
            for (let cmd of tx['payload']['commandsList']) {
                if (Object.keys(cmd)[0] === 'TRANSFER_ASSET') {
                    cmd['key'] = '이체';
                    cmd['value'] = cmd[Object.keys(cmd)[0]];
                    cmd['value']['srcAccountId'] = cmd['value']['srcAccountId'].split('@')[0];
                    cmd['value']['destAccountId'] = cmd['value']['destAccountId'].split('@')[0];
                    delete cmd[Object.keys(cmd)[0]];
                } else if (Object.keys(cmd)[0] === 'SUBTRACT_ASSET_QUANTITY') {
                    cmd['key'] = '코인 파쇄';
                    cmd['value'] = cmd[Object.keys(cmd)[0]];
                    cmd['value']['accountId'] = cmd['value']['accountId'].split('@')[0];
                    delete cmd[Object.keys(cmd)[0]];
                } else if (Object.keys(cmd)[0] === 'ADD_ASSET_QUANTITY') {
                    cmd['key'] = '코인 발급';
                    cmd['value'] = cmd[Object.keys(cmd)[0]];
                    cmd['value']['accountId'] = cmd['value']['accountId'].split('@')[0];
                    delete cmd[Object.keys(cmd)[0]];
                }
                let value = new Array();
                for (let k of Object.keys(cmd['value'])) {
                    value.push({
                        key: k,
                        value: cmd['value'][k]
                    });
                }
                cmd['value'] = value;
            }
            let date = new Date(tx['payload']['createdTime']);
            let year = pad(date.getFullYear(), 2);
            let month = pad(date.getMonth() + 1, 2);
            let dt = pad(date.getDate(), 2);
            let hour = pad(date.getHours(), 2);
            let min = pad(date.getMinutes(), 2);
            let sec = pad(date.getSeconds(), 2);
            tx['payload']['createdTime'] = year + '-' + month + '-' + dt + ' ' + hour + ':' + min + ':' + sec;
            tx['payload']['creatorAccountId'] = tx['payload']['creatorAccountId'].split('@')[0];
            result.push(tx);
        }
        return result;
    }

    txDescription(tx) {
        let txDescModal = this.modalCtrl.create(TxDescriptionModalPage, { tx: this.txs[this.view_txs.indexOf(tx)] });
        txDescModal.present();
    }
}
