import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { Validators, FormBuilder, FormGroup } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';

import { HoseocoinProvider } from '../../providers/hoseocoin/hoseocoin';

import { ToastController } from 'ionic-angular';
import { LoadingController } from 'ionic-angular';

/**
 * Generated class for the HomePage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
    selector: 'page-home',
    templateUrl: 'home.html',
})
export class HomePage {
    private real_balance: number;
    private balance: number;
    private sendcoin_form: FormGroup;
    private loading;

    constructor(public navCtrl: NavController, public navParams: NavParams,
        private currenyPipe: CurrencyPipe,
        private formBuilder: FormBuilder,
        private hoseocoinProvider: HoseocoinProvider,
        private toastCtrl: ToastController,
        private loadingCtrl: LoadingController) {
        this.sendcoin_form = this.formBuilder.group({
            to: ['', Validators.required],
            amount: ['', Validators.required],
            desc: ['']
        });
    }

    ionViewDidLoad() {
        console.log('ionViewDidLoad HomePage');
        this.refreshBalance();
    }

    submit() {
        this.loading = this.loadingCtrl.create({
            content: '송금 처리중...'
        });
        this.loading.present();
        this.sendcoin_form.value.id = this.hoseocoinProvider.getUserCredential().id;
        this.sendcoin_form.value.pw = this.hoseocoinProvider.getUserCredential().pw;
        console.log(this.sendcoin_form.value);
        this.hoseocoinProvider.doSendCoin(this.sendcoin_form.value).subscribe(resp => {
            console.log("sendcoin() Success");
            console.log(resp);
            if (resp.status == 200) {
                this.loading.dismiss();
                this.toastCtrl.create({
                    message: '송금 완료',
                    duration: 3000
                }).present();
                this.refreshBalance();
            }
        }, err => {
            console.log("sendcoin() Failed");
            console.log(err);
            this.loading.dismiss();
            this.toastCtrl.create({
                message: '송금 실패',
                duration: 3000
            }).present();
        });
    }

    refreshBalance() {
        this.sendcoin_form.reset();
        this.loading = this.loadingCtrl.create({
            content: '잔고 조회중...'
        });
        this.loading.present();
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
        this.refreshBalance();
        refresher.complete();
    }

    onChange(event: any) {
        let res = this.real_balance - event.target.value;
        if (res < 0) {
            this.balance = 0;
            event.target.value = this.real_balance;
        } else {
            this.balance = res;
        }
    }
}
