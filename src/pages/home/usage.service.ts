import { Inject, Injectable } from '@angular/core';
import { Http } from '@angular/http';

import { LoadingController, Platform } from 'ionic-angular';
import { SQLite, SQLiteObject } from '@ionic-native/sqlite';


import * as moment from 'moment';

import { Observable } from 'rxjs/Rx';

// Import RxJs required methods
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';

@Injectable()
export class UsageService {

    static requestUrl: string = 'https://r425r07pzc.execute-api.us-east-1.amazonaws.com/dev/usage';
    // public properties
    
    // db strings

    // Table Names
    private tablesDictionary = {
        daily: 'HILowDaily',
    };

    // Mode Function Names
    private fnDictionary = {
        minute:'queryMin',
        daily: 'queryDaily',
        monthly:'queryMonthly'
    };

    createUsageString = 'CREATE TABLE IF NOT EXISTS Usage (id INTEGER PRIMARY KEY AUTOINCREMENT, kWh NUMBER, kTemp NUMBER, kDateTime TEXT)';
    createMonthlyString = 'CREATE TABLE IF NOT EXISTS HILowMonthly (id INTEGER PRIMARY KEY AUTOINCREMENT, kWh NUMBER, KMin NUMBER,KMax NUMBER, kMinTemp NUMBER, kMaxTemp NUMBER, kDateTime TEXT)';
    createDailyString = 'CREATE TABLE IF NOT EXISTS HILowDaily (id INTEGER PRIMARY KEY AUTOINCREMENT, kWh NUMBER, KMin NUMBER,KMax NUMBER, kMinTemp NUMBER, kMaxTemp NUMBER, kDateTime TEXT)';
    // usage data
    billPeriodData: any[] = [];
    briteID = 'BI-43dd32fe-ecbc-48d4-a8dc-e1f66110a542';
    minData: any[] = [];
    reqMode: string;
    afterDate: string;
    dbParams = {
        name: 'usage.db',
        location: 'default' // the location field is required
    };
    // private fields
    private storage: Storage;
    private lastSyncDate: string = '0';
    private db: any;
    
    // Init an empty DB if it does not exist by now!
    constructor(private sqlite: SQLite, private http: Http, private platform: Platform) { }

    getDbInstance() {
        let dbInstance = new Promise((resolve, reject) => {
            try {
                if (this.db) {
                    resolve({ db: this.db });
                } else {
                    this.platform.ready().then(() => {
                        this.sqlite.create(this.dbParams).then((db:SQLiteObject) => {
                            this.db = db;
                            this.db.transaction((tx) => {
                                tx.executeSql(this.createUsageString);
                                tx.executeSql(this.createMonthlyString);
                                tx.executeSql(this.createDailyString);
                            }).then(() => {
                                console.log('tables created');
                                resolve({ db: this.db })
                            }).catch((err) => {
                                console.log('tables already created', err);
                            });
                        }).catch((err) => {
                            console.log('Couldn\'t open database: ', err);
                        })
                    })
                }
            } catch (err) {
                reject({ err: err })
            }
        });
        return Observable.fromPromise(dbInstance);
    }
    /**
    * @name getUsage
    * @description Get all usage data : Minute, Daily, and Monthly data and
    * returns it. 
    */
    public getUsage() {
        return this.getDbInstance()
            .flatMap((response) => {
                return this.getLastSyncDate();
            })
            .flatMap(latestSyncDate => {
                this.lastSyncDate = latestSyncDate;

                return this.getDaily();
            })
            .flatMap(() => {
                return this.getMonthly();
            })
            .flatMap(() => {
                let afterDate = this.lastSyncDate == '0' ? '' : this.lastSyncDate;
                return this.getMin('', afterDate)
            });
    }

    getUsageInitial() {
        let url = 'https://r425r07pzc.execute-api.us-east-1.amazonaws.com/dev/usage/sfile/?briteid=' + this.briteID;
        return this.http.get(url)
            .flatMap(res => {
                let response = res.json();
                if (response.body) {
                    if (response.body.Message.indexOf('System Error - File not found') >= 0) {
                        return Observable.of('no data');
                    }
                } else {
                    let newCSV = this.convertCSVData(response);
                    this.lastSyncDate = '0';
                    return this.getAllData(newCSV);
                }
            });
    }

    getAllData(csvData) {
        return this.getDaily()
            .flatMap(() => {
                return this.getMonthly();
            })
            .flatMap(() => {
                return this.saveMinDataInitial(csvData);
            }).catch((error: any) => Observable.throw(error || 'Server Error'))
    }
    saveMinDataInitial(records: any[]) {
        let sql = 'INSERT INTO Usage (kWh, kTemp, kDateTime) VALUES(?,?,?)';
        let sqlBatchArray = [];
        for (let i = 1; i < records.length; i++) {
            let currentLine = records[i].split(',');
            sqlBatchArray.push([sql, [
                parseFloat(currentLine[1]),
                parseFloat(currentLine[2]),
                moment(currentLine[0], 'YYYYMMDDHHmm').format()
            ]]);
        }
        return Observable.fromPromise(this.db.sqlBatch(sqlBatchArray));
    }

    convertCSVData(CSVRecords) {
        return CSVRecords.slice(0, -1).split("\n");
    }
    /**
     * @name getMin
     * @description Get all minute data from API and saves it in SQLite
     * 
     */
    getMin(reqMode, afterDate) {
        afterDate = afterDate ? moment(afterDate, 'YYYYMMDDHHmm').format('YYYYMMDDHHmm') : '199001010000';
        let resource = '?';
        let url = UsageService.requestUrl + resource + 'briteid=' + this.briteID + '&reqMode=' + reqMode + '&beforeDate=0' + '&afterDate=' + afterDate;
        return this.http.get(url)
            .concatMap((res: any) => {
                if (res._body === 'null') {
                    return this.getMin(reqMode, afterDate);
                }
                let data = res.json();
                let apiSignal = data.pop();
                reqMode = apiSignal.reqMode;
                let tempArr = [];
                tempArr = this.minData;
                this.minData = tempArr.concat(data);
                console.log('reqMode: ', reqMode, 'afterDate: ', afterDate);
                if (reqMode == 'done') {
                    return this.saveMinData(data);
                } else {
                    return Observable.forkJoin(this.saveMinData(data), this.getMin(reqMode, afterDate));
                }
            })
            .catch((error: any) => Observable.throw(error || 'Server Error'));
    }
    saveMinData(records: any[]) {
        let sql = 'INSERT INTO Usage (kWh, kTemp, kDateTime) VALUES(?,?,?)';
        let sqlBatchArray = records.filter((record) => {
            return record !== null;
        }).map((record) => {
            if (record == null) { return; }
            return [sql, [
                parseFloat(record.KWH),
                parseFloat(record.CurTemp),
                moment(record.UsageDateTime, 'YYYYMMDDHHmm').format(),
            ]];
        });
        return Observable.fromPromise(this.db.sqlBatch(sqlBatchArray));
    }
    /**
    * @name getDaily
    * @description Gets daily data from API using the latestSyncDate and saves it in SQLite
    * 
    */
    public getDaily() {
        let resource = '/hilow?'
        let reqType = 'daily';
        let dateAfter = '0';
        let url = UsageService.requestUrl + resource + 'briteid=' + this.briteID + '&reqType=' + reqType + '&dateAfter=' + dateAfter;
        return this.http.get(url)
            .map(response => {
                let res = response;
                console.log(res);
                return this.saveDailyData(res.json());
            })
            .catch((error: any) => Observable.throw(error || 'Server Error'));
    }

    saveDailyData(records: any[]) {
        let sql = 'INSERT INTO ' + 'HILowDaily' + ' (kWh, KMin,KMax, kMinTemp, kMaxTemp, kDateTime) VALUES(?,?,?,?,?,?)';
        let dateFormat = 'YYYYMMDD';
        let sqlBatchArray = records.map((record) => {
            return [sql, [
                parseFloat(record.KSum),
                parseFloat(record.KMin),
                parseFloat(record.KMax),
                parseFloat(record.TMin),
                parseFloat(record.TMax),
                moment(record.Ind, dateFormat).format(),
            ]];
        });
        return Observable.fromPromise(this.db.sqlBatch(sqlBatchArray));
    }

    /**
     * @name getMonthly
     * @description Gets monthly data from API using the latestSyncDate and saves it in SQLite
     * 
     */
    public getMonthly() {
        let resource = '/hilow?'
        let reqType = 'monthly';
        let dateAfter = this.lastSyncDate == '0' ? '0' : moment(this.lastSyncDate).format('YYYYMM');
        let url = UsageService.requestUrl + resource + 'briteid=' + this.briteID + '&reqType=' + reqType + '&dateAfter=' + dateAfter;
        return this.http.get(url)
            .map(response => {
                let res = response;
                return this.saveMonthlyData(response.json())
            })
            .catch((error: any) => Observable.throw(error || 'Server Error'));
    }

    saveMonthlyData(records: any[]) {
        let sql = 'INSERT INTO ' + 'HILowMonthly' + ' (kWh, KMin,KMax, kMinTemp, kMaxTemp, kDateTime) VALUES(?,?,?,?,?,?)';
        let dateFormat = 'YYYYMM';
        let sqlBatchArray = records.map((record) => {
            return [sql, [
                parseFloat(record.KSum),
                parseFloat(record.KMin),
                parseFloat(record.KMax),
                parseFloat(record.TMin),
                parseFloat(record.TMax),
                moment(record.Ind, dateFormat).format(),
            ]];
        });
        return Observable.fromPromise(this.db.sqlBatch(sqlBatchArray));
    }
    /**
   * @name queryMonthly
   * @description Gets all monthly data from SQLite
   * 
   */
    // TO DO: add parameter for dynamic querying
    //where clause SELECT * FROM HILowMonthly where date(kDateTime) > date('2016-06-06)""
    queryMonthly(query?: string): Observable<any> {
        let q = query ? query : 'SELECT * FROM HILowMonthly';
        return this.getDbInstance()
            .flatMap(() => {
                return Observable.fromPromise(this.db.executeSql(q, [])).map(this.convertFromSQl);
            }).catch((error: any) => Observable.throw(error || 'DB Error'));
    }

    /**
    * @name queryDaily
    * @description Gets all daily data from SQLite
    * 
    */
    // TO DO: add parameter for dynamic querying
    //where clause SELECT * FROM HILowDaily where date(kDateTime) > date('2016-06-06)""
    queryDaily(query?: string) {
        let q = query ? query : 'SELECT * FROM HILowDaily';
        return this.getDbInstance()
            .flatMap(() => {
                return Observable.fromPromise(this.db.executeSql(q, [])).map(this.convertFromSQl);
            }).catch((error: any) => Observable.throw(error || 'DB Error'));
    }

    /**
     * @name queryMin
     * @description Gets all minute data from SQLite
     * 
     */
    // TO DO: add parameter for dynamic querying
    //where clause SELECT * FROM usage where date(kDateTime) > date('2016-06-06)""
    queryMin(query?: string) {
        let q = query ? query : 'SELECT * FROM Usage';
        return this.getDbInstance()
            .flatMap(() => {
                return Observable.fromPromise(this.db.executeSql(q, [])).map(this.convertFromSQl);
            }).catch((error: any) => Observable.throw(error || 'DB Error'));
    }

    /**
     * @name getLatestSyncDate
     * @description Gets the date of the latest record
     * @return 
     */
    getLastSyncDate(): Observable<any> {
        let promise = this.db.executeSql('SELECT * FROM Usage ORDER BY kDateTime DESC LIMIT 1', [])
            .then(usage => {
                if (usage.rows.length != 0) {
                    return Promise.resolve(usage.rows.item(0).kDateTime);
                } else {
                    return Promise.resolve('0');
                }
            })
            .catch(err => console.error(err));

        return Observable.fromPromise(promise);
    }
    isTableEmpty() {
        return this.queryMin('SELECT * FROM Usage').map(res => {
            if (res.length == 0) {
                return true;
            }
            else {
                return false;
            }
        });
    }
    private convertFromSQl(SQLObj): Array<any> {
        let data = [];
        if (SQLObj.rows.length > 0) {
            for (var i = 0; i < SQLObj.rows.length; i++) {
                let item = SQLObj.rows.item(i);
                data.push(item);
            }
        }
        return data;
    }

        /**
     * @name queryBuilder
     * Places proper table name based on viewing mode
     * @param {String} mode - minute, daily, monthly
     * @param {String} query - query string. The table name to be replaced must be formated as such ${{tablename}}
     */
    queryBuilder(mode:string,query:string){
        let tableName = this.tablesDictionary[mode];
        return query.replace('${{tablename}}',tableName);
    }

    /**
     * @name fnSelector
     * @param {String} mode - minute, daily, monthly
     * Function Selector to determine fns calls based on viewing mode.
     * mode correspond as follows:
     * minute - getMin
     * daily  - getDaily
     * monthly - getMonthly
     */
    fnSelector(mode:string){
        return this[this.fnDictionary[mode]];
    }
}