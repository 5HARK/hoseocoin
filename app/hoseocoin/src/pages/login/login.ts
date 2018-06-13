import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { Validators, FormBuilder, FormGroup } from '@angular/forms';

import { HoseocoinProvider } from '../../providers/hoseocoin/hoseocoin';

import { ToastController } from 'ionic-angular';
import { LoadingController } from 'ionic-angular';

import { TabsPage } from '../tabs/tabs';


/**
 * Generated class for the LoginPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
    selector: 'page-login',
    templateUrl: 'login.html',
})
export class LoginPage {
    private login_form: FormGroup;
    private register_form: FormGroup;
    private register_mode: boolean;
    private submit;
    private login_txt: string = "로그인";
    private register_txt: string = "계정 등록";

    private submit_btn_txt: string;
    private register_btn_txt: string;

    private loading;

    constructor(public navCtrl: NavController, public navParams: NavParams,
        private formBuilder: FormBuilder,
        private hoseocoinProvider: HoseocoinProvider,
        private toastCtrl: ToastController,
        private loadingCtrl: LoadingController) {
        this.login_form = this.formBuilder.group({
            id: ['', Validators.required],
            password: ['', Validators.required],
        });

        this.register_form = this.formBuilder.group({
            id: ['', Validators.required],
            password: ['', Validators.required],
            name: ['', Validators.required]
        });
        this.submit = this.login;
        this.register_mode = false;
        this.submit_btn_txt = this.login_txt;
        this.register_btn_txt = this.register_txt;
    }

    ionViewDidLoad() {
        console.log('ionViewDidLoad LoginPage');
    }

    public login() {
        this.loading = this.loadingCtrl.create({
            content: '로그인중...'
        });
        this.loading.present();
        this.hoseocoinProvider.doLogin(this.login_form.value).subscribe(resp => {
            console.log("login() Success");
            console.log(resp);
            if (resp.status == 200) {
                this.loading.dismiss();
                this.hoseocoinProvider.setUserCredential(this.login_form.value.id, this.login_form.value.password);
                this.navCtrl.setRoot(TabsPage);
            }
        }, err => {
            console.log("login() Failed");
            this.loading.dismiss();
            this.toastCtrl.create({
                message: '로그인 실패',
                duration: 3000
            }).present();
        });
    }

    public register() {
        this.loading = this.loadingCtrl.create({
            content: '계정 등록중...'
        });
        this.loading.present();
        this.hoseocoinProvider.doRegister(this.register_form.value).subscribe(resp => {
            console.log("register() Success");
            console.log(resp);
            if (resp.status == 200) {
                this.loading.dismiss();
                this.toastCtrl.create({
                    message: '계정 등록 성공',
                    duration: 3000
                }).present();
                this.toggleRegisterMode();
            }
        }, err => {
            console.log("register() Failed");
            this.loading.dismiss();
            this.toastCtrl.create({
                message: '계정 등록 실패',
                duration: 3000
            }).present();
        });
    }

    private toggleRegisterMode() {
        this.register_mode = !this.register_mode;
        [this.submit_btn_txt, this.register_btn_txt] = [this.register_btn_txt, this.submit_btn_txt];
        if (this.register_mode) {
            this.submit = this.register;
        } else {
            this.submit = this.login;
        }
    }

}
