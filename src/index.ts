import { setLogVerbosity, Verbosity } from 'node-eufy-api';
import { API, pluginName, platformName } from './interfaces';
import { EufyHome } from './platform';

setLogVerbosity(Verbosity.ERROR);

export = (homebridge: API) => {
    homebridge.registerPlatform(pluginName, platformName, EufyHome, true);
};
