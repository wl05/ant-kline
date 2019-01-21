import { NamedObject } from './named_object'
import { CToolManager } from './ctool_manager'
import Kline from './kline'

export class DataSource extends NamedObject {
    
    static UpdateMode = {
        DoNothing : 0,
        Refresh : 1,
        Update : 2,
        Append : 3
    };
    
    constructor (name) {
        super(name);
    }
    
    getUpdateMode () {
        return this._updateMode;
    }
    
    setUpdateMode (mode) {
        this._updateMode = mode;
    }
    
    getCacheSize () {
        return 0;
    }
    
    getDataCount () {
        return 0;
    }
    
    getDataAt (index) {
        return this._dataItems[ index ];
    }
    
}


export class MainDataSource extends DataSource {
    
    constructor (name) {
        super(name);
        this._erasedCount = 0;
        this._dataItems = [];
        this._decimalDigits = 0;
        this.toolManager = new CToolManager(name);
    }
    
    getCacheSize () {
        return this._dataItems.length;
    }
    
    getDataCount () {
        return this._dataItems.length;
    }
    
    getUpdatedCount () {
        return this._updatedCount;
    }
    
    getAppendedCount () {
        return this._appendedCount;
    }
    
    getErasedCount () {
        return this._erasedCount;
    }
    
    getDecimalDigits () {
        return this._decimalDigits;
    }
    
    calcDecimalDigits (v) {
        let str = "" + v;
        let i = str.indexOf('.');
        if (i < 0) {
            return 0;
        }
        return (str.length - 1) - i;
    }
    
    getLastDate () {
        let count = this.getDataCount();
        if (count < 1) {
            return -1;
        }
        return this.getDataAt(count - 1).date;
    }
    
    getDataAt (index) {
        return this._dataItems[ index ];
    }
    
    // 1、当前交易日的最高价与最低价间的波幅
    // 2、前一交易日收盘价与当个交易日最高价间的波幅
    // 　 3、前一交易日收盘价与当个交易日最低价间的波幅
    // 今日振幅、今日最高与昨收差价，今日最低与昨收差价中的最大值，为真实波幅，
    // 　　在有了真实波幅后，就可以利用一段时间的平均值计算ATR了。至于用多久计算，不同的使用者习惯不同，10天、20天乃至65天都有。
    
    // 求真实波幅的N日移动平均
    //  参数：N 天数，一般取14
    //  计算公式：
    //  TR : MAX(MAX((HIGH-LOW),ABS(REF(CLOSE,1)-HIGH)),ABS(REF(CLOSE,1)-LOW));
    //  ATR : MA(TR,N)
    
    getAtr (data) {
        function _atr (arr) {
            let sum = 0
            for (let i = 0; i < arr.length; i++) {
                if (i > 0) {
                    const max1 = arr[ i ].high - arr[ i ].low,
                        max2 = arr[ i - 1 ].close - arr[ i ].high,
                        max3 = arr[ i - 1 ].close - arr[ i ].low
                    sum += Math.max(max1, max2, max3)
                }
            }
            return sum / (arr.length - 1)
        }
        
        for (let i = 0; i < data.length; i++) {
            if (i <= 20) {
                data[ i ].atr = 0;
            } else if (i > 20) {
                data[ i ].atr = _atr(data.slice(i - 20, i + 1))
            }
        }
        
        return data
        
    }
    
    update (data) {
        this._updatedCount = 0;
        this._appendedCount = 0;
        this._erasedCount = 0;
        let len = this._dataItems.length;
        
        if (len > 0) {
            let lastIndex = len - 1;
            let lastItem = this._dataItems[ lastIndex ];
            let e, i, cnt = data.length;
            for (i = 0; i < cnt; i++) {
                e = data[ i ];
                if (e[ 0 ] === lastItem.date) {
                    if (lastItem.open === e[ 1 ] &&
                        lastItem.high === e[ 2 ] &&
                        lastItem.low === e[ 3 ] &&
                        lastItem.close === e[ 4 ] &&
                        lastItem.volume === e[ 5 ] &&
                        lastItem.trade === e[ 6 ]
                    ) {
                        this.setUpdateMode(DataSource.UpdateMode.DoNothing);
                    } else {
                        this.setUpdateMode(DataSource.UpdateMode.Update);
                        this._dataItems[ lastIndex ] = {
                            date : e[ 0 ],
                            open : e[ 1 ],
                            high : e[ 2 ],
                            low : e[ 3 ],
                            close : e[ 4 ],
                            volume : e[ 5 ],
                            trade : e[ 6 ]
                        };
                        this._updatedCount++;
                    }
                    i++;
                    if (i < cnt) {
                        this.setUpdateMode(DataSource.UpdateMode.Append);
                        for (; i < cnt; i++, this._appendedCount++) {
                            e = data[ i ];
                            this._dataItems.push({
                                date : e[ 0 ],
                                open : e[ 1 ],
                                high : e[ 2 ],
                                low : e[ 3 ],
                                close : e[ 4 ],
                                volume : e[ 5 ],
                                trade : e[ 6 ]
                            });
                        }
                    }
                    this.getAtr(this._dataItems)
                    return true;
                }
            }
            if (cnt < Kline.instance.limit) {
                this.setUpdateMode(DataSource.UpdateMode.DoNothing);
                return false;
            }
        }
        this.setUpdateMode(DataSource.UpdateMode.Refresh);
        this._dataItems = [];
        let d, n, e, i, cnt = data.length;
        for (i = 0; i < cnt; i++) {
            e = data[ i ];
            for (n = 1; n <= 4; n++) {
                d = this.calcDecimalDigits(e[ n ]);
                if (this._decimalDigits < d)
                    this._decimalDigits = d;
            }
            this._dataItems.push({
                date : e[ 0 ],
                open : e[ 1 ],
                high : e[ 2 ],
                low : e[ 3 ],
                close : e[ 4 ],
                volume : e[ 5 ],
                trade : e[ 6 ]
            });
        }
        this.getAtr(this._dataItems)
        return true;
    }
    
    select (id) {
        this.toolManager.selecedObject = id;
    }
    
    unselect () {
        this.toolManager.selecedObject = -1;
    }
    
    addToolObject (toolObject) {
        this.toolManager.addToolObject(toolObject);
    }
    
    delToolObject () {
        this.toolManager.delCurrentObject();
    }
    
    getToolObject (index) {
        return this.toolManager.getToolObject(index);
    }
    
    getToolObjectCount () {
        return this.toolManager.toolObjects.length;
    }
    
    getCurrentToolObject () {
        return this.toolManager.getCurrentObject();
    }
    
    getSelectToolObjcet () {
        return this.toolManager.getSelectedObject();
    }
    
    delSelectToolObject () {
        this.toolManager.delSelectedObject();
    }
    
}

