// These are only partial typings of the homebridge API

export const pluginName = 'homebridge-eufy';
export const platformName = 'eufy';

export enum APIEvent {
    DID_FINISH_LAUNCHING = 'didFinishLaunching'
}

export interface API {
    platformAccessory: any;

    hap: {
        Service: {
            Lightbulb: Service,
            AccessoryInformation: Service,
            Switch: Service,
            Outlet: Service
        };
        Characteristic: {
            Name: Characteristic; // available in AccessoryInformation, Switch, Lightbulb
            On: Characteristic; // required for Switch, Lightbulb
            Brightness: Characteristic; // available in Lightbulb
            ColorTemperature: Characteristic; // available in Lightbulb

            Hue: Characteristic; // available in Lightbulb
            Saturation: Characteristic; // available in Lightbulb

            // used in AccessoryInformation
            Identify: Characteristic;
            Manufacturer: Characteristic;
            Model: Characteristic;
            SerialNumber: Characteristic;
            FirmwareRevision: Characteristic;
        };
        uuid: {
            generate(input: string): string;
        };
    };

    registerPlatform(pluginName: string, platformName: string, platform: Function, dynamic: boolean): void;

    on(event: APIEvent.DID_FINISH_LAUNCHING, callback: () => void): void;
    registerPlatformAccessories(pluginName: string, platformName: string, accessories: Accessory[]): void;
    unregisterPlatformAccessories(pluginName: string, platformName: string, accessories: Accessory[]): void;
}

export interface Service {
    getCharacteristic(characteristic: Characteristic): Characteristic | undefined;
    addCharacteristic(characteristic: Characteristic): Characteristic;
    setCharacteristic(characteristic: Characteristic, value: string): Service;
}

// Characteristic
export enum CharacteristicEvent {
    SET = 'set',
    GET = 'get'
}

export interface Characteristic {
    on(event: CharacteristicEvent.SET, handler: (value: any, callback: (error?: any) => void) => void): Characteristic;
    on(event: CharacteristicEvent.GET, handler: (callback: (error?: any, value?: any) => void) => void): Characteristic;
}

export enum AccessoryEvent {
    IDENTIFY = 'identify'
}

export interface Accessory {
    readonly displayName: string;
    reachable: boolean;
    context: {[key: string]: any};
    category: AccessoryCategory;
    services: Service[];

    on(event: AccessoryEvent.IDENTIFY, handler: (value: boolean, callback: (error?: any) => void) => void): void;

    updateReachability(reachable: boolean): void;
    getService(service: Service | string): Service | undefined;
    addService(service: Service, label: string): Service;
};

export type Logger = (message: any, ...additional: any[]) => void;

export enum AccessoryCategory {
    OTHER = 1, // default value
    LIGHTBULB = 5,
    OUTLET = 7,
    SWITCH = 8,
    PROGRAMMABLE_SWITCH = 15
}
