import {loadDevices, createDevice, Device, DeviceEvent, DeviceType} from 'node-eufy-api';
import {
    pluginName, platformName,
    Logger, API, APIEvent,
    Accessory, AccessoryEvent, AccessoryCategory,
    Service,
    Characteristic, CharacteristicEvent
} from './interfaces';

export class EufyHome {
    log: Logger;
    api: API;
    eufyEmail: string;
    eufyPassword: string;
    showPlugsAsSwitches: boolean;
    accessories: Accessory[];

    constructor(log: Logger, config: {[key: string]: any}, api: API) {
        log('Eufy initializing');

        this.log = log;
        this.api = api;

        if (typeof config.email !== 'string' || typeof config.password !== 'string') {
            throw new Error('No valid Eufy account email/password provided');
        }

        this.eufyEmail = config.email;
        this.eufyPassword = config.password;
        if (typeof config.showPlugsAsSwitches === 'boolean') {
            this.showPlugsAsSwitches = config.showPlugsAsSwitches;
        } else {
            this.showPlugsAsSwitches = false;

            if (config.showPlugsAsSwitches) {
                this.log('Invalid showPlugsAsSwitches config value - must be boolean value!');
            }
        }

        this.accessories = [];

        // triggered once homebridge finished loading cached accessories.
        // new plugins should only be registered after this event
        this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
            loadDevices(this.eufyEmail, this.eufyPassword).then(devices => {
                devices.forEach(device => this.addAccessory(device));
            });
        });
    }

    configureAccessory(accessory: Accessory) {
        this.log('Configure Accessory:', accessory.displayName);

        if (typeof accessory.context.model !== 'string' ||
            typeof accessory.context.code !== 'string' ||
            typeof accessory.context.ipAddress !== 'string') {
            this.log('Unknown accessory context:', accessory.context);
            return;
        }

        const device = createDevice(
            accessory.context.model,
            accessory.context.code,
            accessory.context.ipAddress,
            accessory.displayName
        );

        this.setUpAccessory(accessory, device);

        this.accessories.push(accessory);
    }

    addAccessory(device: Device) {
        this.log('Add Accessory:', device.name, '-', device.code);

        if (this.accessories.find(accessory => accessory.context.code === device.code)) {
            this.log('Skipping accessory, already registered');
            return;
        }

        const uuid = this.api.hap.uuid.generate(device.code);
        const newAccessory: Accessory = new this.api.platformAccessory(device.name, uuid);

        newAccessory.context = {
            model: device.model,
            code: device.code,
            ipAddress: device.ipAddress
        };

        this.setUpAccessory(newAccessory, device);

        this.accessories.push(newAccessory);
        this.api.registerPlatformAccessories(pluginName, platformName, [newAccessory]);
    }

    getOrAddCharacteristic(service: Service, characteristic: Characteristic): Characteristic {
        return service.getCharacteristic(characteristic) ||
            service.addCharacteristic(characteristic);
    }

    setUpAccessory(accessory: Accessory, device: Device) {
        accessory.getService(this.api.hap.Service.AccessoryInformation)!
            .setCharacteristic(this.api.hap.Characteristic.Manufacturer, 'eufy')
            .setCharacteristic(this.api.hap.Characteristic.Model, device.model)
            .setCharacteristic(this.api.hap.Characteristic.SerialNumber, 'n/a');

        device.connect()
            .catch(error => {
                this.log('Error connecting to accessory:', error);
                this.log('Removing accessory:', device.name);

                this.api.unregisterPlatformAccessories(pluginName, platformName, [accessory]);
                this.accessories = this.accessories.filter(a => a !== accessory);
            });

        accessory.on(AccessoryEvent.IDENTIFY, (paired: boolean, callback: (error?: any) => void) => {
            // this is a button that can be tapped during the setup process
            device.setPowerOn(!device.isPowerOn())
                .then(newPower => {
                    setTimeout(() => {
                        device.setPowerOn(!newPower)
                            .then(() => callback())
                            .catch(error => callback(error));
                    }, 500);
                })
                .catch(error => callback(error));
        });

        let serviceType: Service;
        switch (device.deviceType) {
            case DeviceType.LIGHT_BULB:
                accessory.category = AccessoryCategory.LIGHTBULB;
                serviceType = this.api.hap.Service.Lightbulb;

                break;

            case DeviceType.POWER_PLUG:
                if (this.showPlugsAsSwitches) {
                    accessory.category = AccessoryCategory.SWITCH;
                    serviceType = this.api.hap.Service.Switch;
                } else {
                    accessory.category = AccessoryCategory.OUTLET;
                    serviceType = this.api.hap.Service.Outlet;
                }

                break;

            case DeviceType.SWITCH:
                accessory.category = AccessoryCategory.PROGRAMMABLE_SWITCH;
                serviceType = this.api.hap.Service.Switch;

                break;

            default:
                this.log(`Unknown error setting up accessory of type "${device.deviceType}"`);
                return;
        }

        let service: Service;
        if (accessory.getService(serviceType)) {
            service = accessory.getService(serviceType)!
                .setCharacteristic(this.api.hap.Characteristic.Name, device.name);
        } else {
            service = accessory.addService(serviceType, device.name);
        }

        this.getOrAddCharacteristic(service, this.api.hap.Characteristic.On)
            .on(CharacteristicEvent.SET, (value: boolean, callback: (error?: any) => void) => {
                device.setPowerOn(value)
                    .then(() => callback())
                    .catch(error => {
                        this.log('Error toggling power state on device:', device.name, ' - ', error);
                        callback(error);
                    });
            })
            .on(CharacteristicEvent.GET, (callback: (error?: any, value?: boolean) => void) => {
                device.loadCurrentState()
                    .then(() => callback(null, device.isPowerOn()))
                    .catch(error => {
                        this.log('Error loading power state on device:', device.name, ' - ', error);
                        callback(error);
                    });
            });

        if (device.supportsBrightness()) {
            this.getOrAddCharacteristic(service, this.api.hap.Characteristic.Brightness)
                .on(CharacteristicEvent.SET, (value: number, callback: (error?: any) => void) => {
                    device.setBrightness(value)
                        .then(() => callback())
                        .catch(error => {
                            this.log('Error setting brightness on device:', device.name, ' - ', error);
                            callback(error);
                        });
                })
                .on(CharacteristicEvent.GET, (callback: (error?: any, value?: number) => void) => {
                    device.loadCurrentState()
                        .then(() => callback(null, device.getBrightness()))
                        .catch(error => {
                            this.log('Error getting brightness on device:', device.name, ' - ', error);
                            callback(error);
                        });
                });
        }

        if (device.supportsTemperature()) {
            this.getOrAddCharacteristic(service, this.api.hap.Characteristic.ColorTemperature)
                .on(CharacteristicEvent.SET, (value: number, callback: (error?: any) => void) => {
                    device.setTemperature(value)
                        .then(() => callback())
                        .catch(error => {
                            this.log('Error setting temperature on device:', device.name, ' - ', error);
                            callback(error);
                        });
                })
                .on(CharacteristicEvent.GET, (callback: (error: any, value?: number) => void) => {
                    device.loadCurrentState()
                        .then(() => callback(null, device.getTemperature()))
                        .catch(error => {
                            this.log('Error getting temperature on device:', device.name, ' - ', error);
                            callback(error);
                        });
                });
        }

        if (device.supportsColors()) {
            this.getOrAddCharacteristic(service, this.api.hap.Characteristic.Hue)
                .on(CharacteristicEvent.SET, (value: number, callback: (error?: any) => void) => {
                    device.loadCurrentState()
                        .then(() => device.setHslColors(value, device.getHslColors().saturation, device.getHslColors().lightness))
                        .then(() => callback())
                        .catch(error => {
                            this.log('Error setting color hue on device:', device.name, ' - ', error);
                            callback(error);
                        });
                })
                .on(CharacteristicEvent.GET, (callback: (error: any, value?: number) => void) => {
                    device.loadCurrentState()
                        .then(() => callback(null, device.getHslColors().hue))
                        .catch(error => {
                            this.log('Error getting color hue on device:', device.name, ' - ', error);
                            callback(error);
                        });
                });

            this.getOrAddCharacteristic(service, this.api.hap.Characteristic.Saturation)
                .on(CharacteristicEvent.SET, (value: number, callback: (error?: any) => void) => {
                    device.loadCurrentState()
                        .then(() => device.setHslColors(device.getHslColors().hue, value, device.getHslColors().lightness))
                        .then(() => callback())
                        .catch(error => {
                            this.log('Error setting color saturation on device:', device.name, ' - ', error);
                            callback(error);
                        });
                })
                .on(CharacteristicEvent.GET, (callback: (error: any, value?: number) => void) => {
                    device.loadCurrentState()
                        .then(() => callback(null, device.getHslColors().saturation))
                        .catch(error => {
                            this.log('Error getting color saturation on device:', device.name, ' - ', error);
                            callback(error);
                        });
                });
        }
    }
}
