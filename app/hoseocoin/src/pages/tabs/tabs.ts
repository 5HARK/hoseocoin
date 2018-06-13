import { Component } from '@angular/core';

import { HomePage } from '../home/home';
import { TxListPage } from '../tx-list/tx-list';
import { CoinPage } from '../coin/coin';

@Component({
    templateUrl: 'tabs.html'
})
export class TabsPage {

    tab1Root = HomePage;
    tab2Root = TxListPage;
    tab3Root = CoinPage;

    constructor() {

    }
}
