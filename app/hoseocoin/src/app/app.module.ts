import { NgModule, ErrorHandler } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { IonicApp, IonicModule, IonicErrorHandler } from 'ionic-angular';
import { MyApp } from './app.component';

import { HttpClientModule } from '@angular/common/http';
import { CurrencyPipe } from '@angular/common';


import { LoginPageModule } from '../pages/login/login.module';
import { HomePageModule } from '../pages/home/home.module';
import { CoinPageModule } from '../pages/coin/coin.module';
import { TxListPageModule } from '../pages/tx-list/tx-list.module';
import { TxDescriptionModalPageModule } from '../pages/tx-description-modal/tx-description-modal.module';
import { TabsPage } from '../pages/tabs/tabs';

import { StatusBar } from '@ionic-native/status-bar';
import { SplashScreen } from '@ionic-native/splash-screen';
import { HoseocoinProvider } from '../providers/hoseocoin/hoseocoin';

@NgModule({
    declarations: [
        MyApp,
        TabsPage,
    ],
    imports: [
        BrowserModule,
        HttpClientModule,
        IonicModule.forRoot(MyApp),
        LoginPageModule,
        HomePageModule,
        CoinPageModule,
        TxListPageModule,
        TxDescriptionModalPageModule,
    ],
    bootstrap: [IonicApp],
    entryComponents: [
        MyApp,
        TabsPage,
    ],
    providers: [
        StatusBar,
        SplashScreen,
        { provide: ErrorHandler, useClass: IonicErrorHandler },
        HoseocoinProvider,
        CurrencyPipe
    ]
})
export class AppModule { }
