import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams, ViewController } from 'ionic-angular';
//import * as beautify from 'json-beautify'

/**
 * Generated class for the TxDescriptionModalPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
    selector: 'page-tx-description-modal',
    templateUrl: 'tx-description-modal.html',
})
export class TxDescriptionModalPage {
    private tx;

    constructor(params: NavParams,
        private viewCtrl: ViewController) {
        this.tx = JSON.stringify(params.get('tx'), null, '\t');
        console.log(this.tx);
    }

    dismiss() {
        this.viewCtrl.dismiss();
    }
}
