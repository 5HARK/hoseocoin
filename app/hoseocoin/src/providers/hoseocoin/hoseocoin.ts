import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';

/*
  Generated class for the HoseocoinProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class HoseocoinProvider {
    private hoseocoinServerUrl: string = 'http://leocorp.iptime.org:8080/hoseocoin';

    private user_id: string;
    private user_pw: string;

    constructor(public http: HttpClient) {
        console.log('Hello HoseocoinProvider Provider');
    }

    doLogin(data): Observable<any> {
        return this.http.post(this.hoseocoinServerUrl + '/login', {
            id: data.id,
            pw: data.password
        }, { observe: 'response' });
    }

    doRegister(data): Observable<any> {
        return this.http.post(this.hoseocoinServerUrl + '/register', {
            id: data.id,
            pw: data.password,
            name: data.name
        }, { observe: 'response' });
    }

    doSelectCoin(data): Observable<any> {
        return this.http.post(this.hoseocoinServerUrl + '/select-coin', {
            id: data.id,
            pw: data.pw
        }, { observe: 'response' });
    }

    doSendCoin(data): Observable<any> {
        return this.http.post(this.hoseocoinServerUrl + '/send-coin', {
            id: data.id,
            pw: data.pw,
            to: data.to,
            amount: data.amount,
            desc: data.desc
        }, { observe: 'response' });
    }

    doWonToCoin(data): Observable<any> {
        return this.http.post(this.hoseocoinServerUrl + '/won-to-coin', {
            id: data.id,
            pw: data.pw,
            won: data.won
        }, { observe: 'response' });
    }

    doCoinToWon(data): Observable<any> {
        return this.http.post(this.hoseocoinServerUrl + '/coin-to-won', {
            id: data.id,
            pw: data.pw,
            won: data.won,
            desc: ('desc' in data ? data.desc : undefined)
        }, { observe: 'response' });
    }

    doSelectTx(data): Observable<any> {
        return this.http.post(this.hoseocoinServerUrl + '/select-transaction', {
            id: data.id,
            pw: data.pw,
            who: data.who
        }, { observe: 'response' });
    }

    setUserCredential(id: string, pw: string) {
        this.user_id = id;
        this.user_pw = pw;
    }

    getUserCredential() {
        let res = {
            id: this.user_id,
            pw: this.user_pw
        };
        return res;
    }
}
