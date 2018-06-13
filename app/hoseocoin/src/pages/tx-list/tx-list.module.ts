import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { TxListPage } from './tx-list';

@NgModule({
  declarations: [
    TxListPage,
  ],
  imports: [
    IonicPageModule.forChild(TxListPage),
  ],
})
export class TxListPageModule {}
