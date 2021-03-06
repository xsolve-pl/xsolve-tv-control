const BraviaRemoteControl = require('sony-bravia-tv-remote');
const SimpleADB = require('simple-adb').SimpleADB;

const config = require('./tvconfig.json');
const appConfig = require('./appconfig.json');

exports.getTvList = function() {
    return config;
};

function resolveTVsCommand(func, args) {
    let [tvList, ...other] = args;

    return new Promise(function(resolve, reject) {
        let elementsNumber = tvList.length;
        let promiseArray = [];

        for (let i = 0; i < elementsNumber; i++) {
            let tvName = tvList[i];
            console.log('for tvName: ' + tvName);
            promiseArray.push(func(tvName, ...other));
        }

        Promise.all(promiseArray).then(function(result) {
            for (let i = 0; i < elementsNumber; i++) {
                if (!result[i]) {
                    resolve(false);
                    return;
                }
            }

            resolve(true);
        });
    });
}

exports.getPowerState = async function(tvList) {
    console.log(`getPowerState: "${tvList}", elements: ${tvList.length}`);

    let elementsNumber = tvList.length;

    for (let i = 0; i < elementsNumber; i++) {
        console.log(`i: ${i}`)
        await this.ll_getPowerState(tvList[i]);
    }
};

exports.powerSet = function(tvList, powerState) {
    return resolveTVsCommand(ll_powerSet, [tvList, powerState]);
};

exports.setVolume = function setVolume(tvList, volume) {
    return resolveTVsCommand(ll_setVolume, [tvList, volume]);
};

exports.runApplication = function(tvList, applicationName) {
    let applicationPackageName = appConfig[applicationName].basic ? appConfig[applicationName].basic : applicationName;

    return resolveTVsCommand(ll_runApplication, [tvList, applicationPackageName]);
};

exports.killApplication = function(tvList, applicationName) {
    let applicationPackageName = appConfig[applicationName].basic ? appConfig[applicationName].basic : applicationName;

    return resolveTVsCommand(ll_killApplication, [tvList, applicationPackageName]);
};

exports.viewPage = function(tvList, pageUrl, browser) {
    let customBrowserPackage = false;

    if (browser) {
        if (appConfig[browser].full) {
            customBrowserPackage = appConfig[browser].full;
        } else {
            console.log(`Browser "${ browser }" full package name is not set in appconfig.json file. ` +
            `You may run default browser by omitting "--browser" option.`);
            process.exit(1);
        }
    }

    return resolveTVsCommand(ll_viewPage, [tvList, pageUrl, customBrowserPackage]);
};

exports.runYoutubeMovie = function(tvList, url) {
    return resolveTVsCommand(ll_runYoutubeMovie, [tvList, url]);
};

function ll_powerSet(tvName, powerState) {
    console.log(`powerSet TV ${ tvName } to state: ${ powerState }`);

    let tvConfig = config[tvName];

    return new BraviaRemoteControl(tvConfig.ip, 80, tvConfig.key).sendAction(powerState ? 'PowerOn' : 'PowerOff');
}

exports.ll_getPowerState = async function(tvName) {
    console.log(`getPowerState for "${ tvName }" TV`);

    let sadb = new SimpleADB();
    let ipAddress = config[tvName].ip;

    return sadb
        .connect(ipAddress)
        .then(function() {
            return sadb.execAdbShellCommandAndCaptureOutput(['dumpsys power|grep "Display Power"'])
                .then(function(output) {
                    if (output == 'Display Power: state=ON') {
                        console.log(`TV ${ tvName } state: TRUE`);
                        return 'on';
                    }

                    console.log(`TV ${ tvName } state: FALSE`);

                    return 'off';
                });
        })
        .catch((e) => {
            console.log('ll_getPowerState failed');

            return 'failed';
        });
};

exports.ll_getRawScreenshot = async function(tvName) {
    let sadb = new SimpleADB();
    let ipAddress = config[tvName].ip;

    console.log(`ll_getRawScreenthot`);

    return sadb
        .connect(ipAddress)
        .then(function() {
            return sadb.execAdbShellCommandAndCaptureOutput(['screencap -p |base64']).then(function(output) {
                return output.join('');//lines must be joined and without "," signs
            });
        })
        .catch((e) => {
            console.log('ll_getRawScreenthot failed');
        });
};

function ll_setVolume(tvName, volume) {
    let sadb = new SimpleADB();
    let ipAddress = config[tvName].ip;

    if (volume < 0 || volume > 100) {
        volume = 0;
    }

    console.log(`Setting volume "${ volume }" on "${ tvName }" TV (${ ipAddress }).`);

    return sadb
        .connect(ipAddress)
        .then(function() {
            return sadb.execAdbShellCommand(`service call audio 3 i32 3 i32 ${ volume } i32 1`); // audio output 3
        })
        .catch((e) => {
            console.log('ll_setVolume failed');
        });
}

function ll_viewPage(tvName, pageUrl, customBrowserPackage) {
    let sadb = new SimpleADB();
    let ipAddress = config[tvName].ip;

    console.log(`Viewing "${ pageUrl }" page on "${ tvName }" TV (${ ipAddress }).`);

    return sadb
        .connect(ipAddress)
        .then(function() {
            if (customBrowserPackage) {
                return sadb.execAdbShellCommand(`am start -n ${ customBrowserPackage } -d "${ pageUrl }"`);
            }

            return sadb.execAdbShellCommand(`am start -a android.intent.action.VIEW "${ pageUrl }"`);// default browser
        })
        .catch((e) => {
            console.log('ll_viewPage failed');
        });
}

function ll_runApplication(tvName, applicationPackageName) {
    let sadb = new SimpleADB();
    let ipAddress = config[tvName].ip;

    console.log(`Running "${ applicationPackageName }" on "${ tvName }" TV (${ ipAddress }).`);

    return sadb
        .connect(ipAddress)
        .then(function() {
            return sadb.execAdbShellCommand(`monkey -p ${ applicationPackageName } -c android.intent.category.LAUNCHER 1`);
        })
        .catch((e) => {
            console.log('ll_runApplication failed');
        });
}

function ll_killApplication(tvName, applicationPackageName) {
    let sadb = new SimpleADB();
    let ipAddress = config[tvName].ip;

    console.log(`Killing "${ applicationPackageName }" on "${ tvName }" TV (${ ipAddress }).`);

    return sadb
        .connect(ipAddress)
        .then(function() {
            return sadb.execAdbShellCommand(`am force-stop ${ applicationPackageName }`);
        })
        .catch((e) => {
            console.log('ll_killApplication failed');
        });
}

function ll_runYoutubeMovie(tvName, url) {
    let sadb = new SimpleADB();
    let ipAddress = config[tvName].ip;

    console.log(`Running Youtube url "${ url }" on "${ tvName }" TV (${ ipAddress }).`);

    return sadb
        .connect(ipAddress)
        .then(function() {
            return sadb.execAdbShellCommand(`am start -a android.intent.action.VIEW "${ url }"`);
        })
        .catch((e) => {
            console.log('ll_runYoutubeMovie failed');
        });
}
