import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { TxDescriptionModalPage } from './tx-description-modal';

@NgModule({
  declarations: [
    TxDescriptionModalPage,
  ],
  imports: [
    IonicPageModule.forChild(TxDescriptionModalPage),
  ],
})
export class TxDescriptionModalPageModule {}
