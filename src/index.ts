import {API, pluginName, platformName} from './interfaces';
import {EufyHome} from './platform';

export = (homebridge: API) => {
    homebridge.registerPlatform(pluginName, platformName, EufyHome, true);
};
