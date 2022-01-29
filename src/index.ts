import { API } from 'homebridge';
import { setLogVerbosity, Verbosity } from 'node-eufy-api';
import { PLATFORM_NAME } from './settings';
import { EufyHomePlatform } from './platform';

setLogVerbosity(Verbosity.ERROR);

export = (homebridge: API) => {
    homebridge.registerPlatform(PLATFORM_NAME, EufyHomePlatform);
};
