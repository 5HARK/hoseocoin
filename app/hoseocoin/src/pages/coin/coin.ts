import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { Validators, FormBuilder, FormGroup } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';

import { HoseocoinProvider } from '../../providers/hoseocoin/hoseocoin';

import { ToastController } from 'ionic-angular';
import { LoadingController } from 'ionic-angular';
/**
 * Generated class for the CoinPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
    selector: 'page-coin',
    templateUrl: 'coin.html',
})
export class CoinPage {
    private real_balance: number;
    private balance: number;
    private wontocoin_form: FormGroup;
    private cointowon_form: FormGroup;
    private loading;

    constructor(public navCtrl: NavController, public navParams: NavParams,
        private currenyPipe: CurrencyPipe,
        private formBuilder: FormBuilder,
        private hoseocoinProvider: HoseocoinProvider,
        private toastCtrl: ToastController,
        private loadingCtrl: LoadingController) {
        this.wontocoin_form = this.formBuilder.group({
            won: ['', Validators.required]
        });
        this.cointowon_form = this.formBuilder.group({
            won: ['', Validators.required],
            desc: ['']
        });
    }

    ionViewDidLoad() {
        console.log('ionViewDidLoad CoinPage');
        this.refreshBalance();
    }

    submitWonToCoin() {
        this.loading = this.loadingCtrl.create({
            content: '코인 충전중...'
        });
        this.loading.present();
        this.wontocoin_form.value.id = this.hoseocoinProvider.getUserCredential().id;
        this.wontocoin_form.value.pw = this.hoseocoinProvider.getUserCredential().pw;
        console.log(this.wontocoin_form.value);
        this.hoseocoinProvider.doWonToCoin(this.wontocoin_form.value).subscribe(resp => {
            console.log("wontocoin() Success");
            console.log(resp);
            if (resp.status == 200) {
                this.loading.dismiss();
                this.toastCtrl.create({
                    message: '충전 완료',
                    duration: 3000
                }).present();
                this.refreshBalance();
            }
        }, err => {
            console.log("wontocoin() Failed");
            console.log(err);
            this.loading.dismiss();
            this.toastCtrl.create({
                message: '충전 실패',
                duration: 3000
            }).present();
            this.refreshBalance();
        });
    }

    submitCoinToWon() {
        this.loading = this.loadingCtrl.create({
            content: '원화 환급중...'
        });
        this.loading.present();
        this.cointowon_form.value.id = this.hoseocoinProvider.getUserCredential().id;
        this.cointowon_form.value.pw = this.hoseocoinProvider.getUserCredential().pw;
        console.log(this.cointowon_form.value);
        this.hoseocoinProvider.doCoinToWon(this.cointowon_form.value).subscribe(resp => {
            console.log("cointowon() Success");
            console.log(resp);
            if (resp.status == 200) {
                this.loading.dismiss();
                this.toastCtrl.create({
                    message: '환급 완료',
                    duration: 3000
                }).present();
                this.refreshBalance();
            }
        }, err => {
            console.log("cointowon() Failed");
            console.log(err);
            this.loading.dismiss();
            this.toastCtrl.create({
                message: '환급 실패',
                duration: 3000
            }).present();
            this.refreshBalance();
        });
    }

    refreshBalance() {
        this.cointowon_form.reset();
        this.wontocoin_form.reset();
        this.loading = this.loadingCtrl.create({
            content: '잔고 조회중...'
        });
        let cre = this.hoseocoinProvider.getUserCredential();
        this.hoseocoinProvider.doSelectCoin({
            id: cre.id,
            pw: cre.pw
        }).subscribe(resp => {
            this.balance = resp.body * 1;
            this.real_balance = resp.body * 1;
            this.loading.dismiss();
        }, err => {
            this.loading.dismiss();
            this.toastCtrl.create({
                message: '잔고 조회 실패',
                duration: 3000
            }).present();
        });
    }

    doRefresh(refresher) {
        this.cointowon_form.reset();
        this.wontocoin_form.reset();
        this.refreshBalance();
        refresher.complete();
    }

    onChangeCoinToWon(event: any) {
        let input = event.target.value * 1;
        let res = this.real_balance - input;

        if (res < 0) {
            this.balance = 0;
            event.target.value = this.real_balance;
        } else {
            this.balance = res;
        }
    }

    onChangeWonToCoin(event: any) {
        let input = event.target.value * 1;
        let res = this.real_balance + input;

        if (res < 0) {
            this.balance = 0;
            event.target.value = this.real_balance;
        } else {
            this.balance = res;
        }
    }
}
