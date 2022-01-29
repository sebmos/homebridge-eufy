import { PlatformAccessory, Service, Characteristic, Categories, CharacteristicEventTypes, AccessoryEventTypes } from 'homebridge';
import { Device, DeviceType } from 'node-eufy-api';
import { EufyHomePlatform } from './platform';

const mapRange = (
	inputNumber: number,
	input_start: number,
	input_end: number,
	output_start: number,
	output_end: number
): number => {
  	const input_range = input_end - input_start;
  	const output_range = output_end - output_start;
	
  	return (inputNumber - input_start) * output_range / input_range + output_start;
};

export class EufyAccessory {
    private service: Service;

	constructor(
        private readonly platform: EufyHomePlatform,
        private readonly showPlugAsSwitch: boolean,
        private readonly accessory: PlatformAccessory,
        private readonly device: Device
	) {
        accessory.getService(this.platform.Service.AccessoryInformation)!
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'eufy')
            .setCharacteristic(this.platform.Characteristic.Model, device.model)
            .setCharacteristic(this.platform.Characteristic.SerialNumber, 'n/a');

        device.connect()
            .catch(error => {
                this.platform.log.error('Error connecting to accessory:', error);
                this.platform.removeAccessory(accessory);
            });
        
        accessory.on(AccessoryEventTypes.IDENTIFY, async () => {
            // this is a button that can be tapped during the setup process
            const newPower = await device.setPowerOn(!device.isPowerOn())

            setTimeout(() => {
                device.setPowerOn(!newPower)
            }, 500);
        });
        
        let serviceType;
        switch (device.deviceType) {
            case DeviceType.LIGHT_BULB:
                accessory.category = Categories.LIGHTBULB;
                serviceType = this.platform.Service.Lightbulb;
        
                break;
        
            case DeviceType.POWER_PLUG:
                if (this.showPlugAsSwitch) {
                    accessory.category = Categories.SWITCH;
                    serviceType = this.platform.Service.Switch;
                } else {
                    accessory.category = Categories.OUTLET;
                    serviceType = this.platform.Service.Outlet;
                }
        
                break;
        
            case DeviceType.SWITCH:
                accessory.category = Categories.PROGRAMMABLE_SWITCH;
                serviceType = this.platform.Service.Switch;
        
                break;
        
            default:
                this.platform.log.error(`Unknown error setting up accessory of type "${device.deviceType}"`);
                this.platform.removeAccessory(accessory);
                return;
        }

        this.service = accessory.getService(serviceType) || this.accessory.addService(serviceType);
        this.service.setCharacteristic(this.platform.Characteristic.Name, device.name);

        this.setupOnOffCharacteristic();
        this.setupBrightnessCharacteristic();
        this.setupTemperatureCharacteristic();
        this.setupColorCharacteristic();
	}

	getOrAddCharacteristic(characteristic: any): Characteristic {
		return this.service.getCharacteristic(characteristic) ||
			this.service.addCharacteristic(characteristic);
	}

    private setupOnOffCharacteristic() {
        this.getOrAddCharacteristic(this.platform.Characteristic.On)
            .on(CharacteristicEventTypes.SET, (value: boolean, callback: (error?: any) => void) => {
                this.device.setPowerOn(value)
                    .then(() => callback())
                    .catch(error => {
                        this.platform.log.error('Error toggling power state on device:', this.device.name, ' - ', error);
                        callback(error);
                    });
            })
            .on(CharacteristicEventTypes.GET, (callback: (error?: any, value?: boolean) => void) => {
                this.device.loadCurrentState()
                    .then(() => callback(null, this.device.isPowerOn()))
                    .catch(error => {
                        this.platform.log.error('Error loading power state on device:', this.device.name, ' - ', error);
                        callback(error);
                    });
            });
    }

    private setupBrightnessCharacteristic() {
        if (this.device.supportsBrightness()) {
            this.getOrAddCharacteristic(this.platform.Characteristic.Brightness)
                .on(CharacteristicEventTypes.SET, (value: number, callback: (error?: any) => void) => {
                    this.device.setBrightness(value)
                        .then(() => callback())
                        .catch(error => {
                            this.platform.log.error('Error setting brightness on device:', this.device.name, ' - ', error);
                            callback(error);
                        });
                })
                .on(CharacteristicEventTypes.GET, (callback: (error?: any, value?: number) => void) => {
                    this.device.loadCurrentState()
                        .then(() => callback(null, this.device.getBrightness()))
                        .catch(error => {
                            this.platform.log.error('Error getting brightness on device:', this.device.name, ' - ', error);
                            callback(error);
                        });
                });
        }
    }

    private setupTemperatureCharacteristic() {
        if (this.device.supportsTemperature()) {
            this.getOrAddCharacteristic(this.platform.Characteristic.ColorTemperature)
                .on(CharacteristicEventTypes.SET, (value: number, callback: (error?: any) => void) => {
                    // scale from [140, 500] => [0, 100]
                    const scaledColorTemperature = mapRange(value, 140, 500, 0, 100);
                    this.device.setTemperature(scaledColorTemperature)
                        .then(() => callback())
                        .catch(error => {
                            this.platform.log.error('Error setting temperature on device:', this.device.name, ' - ', error);
                            callback(error);
                        });
                })
                .on(CharacteristicEventTypes.GET, (callback: (error: any, value?: number) => void) => {
                    this.device.loadCurrentState()
                        .then(() => {
                            // scale from [0, 100] => [140, 500]
                            const scaledColorTemperature = mapRange(this.device.getTemperature(), 0, 100, 140, 500);
                            callback(null, scaledColorTemperature);
                        })
                        .catch(error => {
                            this.platform.log.error('Error getting temperature on device:', this.device.name, ' - ', error);
                            callback(error);
                        });
                });
        }
    }
    
    private setupColorCharacteristic() {
        if (this.device.supportsColors()) {
            this.getOrAddCharacteristic(this.platform.Characteristic.Hue)
                .on(CharacteristicEventTypes.SET, (value: number, callback: (error?: any) => void) => {
                    this.device.loadCurrentState()
                        .then(() => this.device.setHslColors(value, this.device.getHslColors().saturation, this.device.getHslColors().lightness))
                        .then(() => callback())
                        .catch(error => {
                            this.platform.log.error('Error setting color hue on device:', this.device.name, ' - ', error);
                            callback(error);
                        });
                })
                .on(CharacteristicEventTypes.GET, (callback: (error: any, value?: number) => void) => {
                    this.device.loadCurrentState()
                        .then(() => callback(null, this.device.getHslColors().hue))
                        .catch(error => {
                            this.platform.log.error('Error getting color hue on device:', this.device.name, ' - ', error);
                            callback(error);
                        });
                });
        
            this.getOrAddCharacteristic(this.platform.Characteristic.Saturation)
                .on(CharacteristicEventTypes.SET, (value: number, callback: (error?: any) => void) => {
                    this.device.loadCurrentState()
                        .then(() => this.device.setHslColors(this.device.getHslColors().hue, value, this.device.getHslColors().lightness))
                        .then(() => callback())
                        .catch(error => {
                            this.platform.log.error('Error setting color saturation on device:', this.device.name, ' - ', error);
                            callback(error);
                        });
                })
                .on(CharacteristicEventTypes.GET, (callback: (error: any, value?: number) => void) => {
                    this.device.loadCurrentState()
                        .then(() => callback(null, this.device.getHslColors().saturation))
                        .catch(error => {
                            this.platform.log.error('Error getting color saturation on device:', this.device.name, ' - ', error);
                            callback(error);
                        });
                });
        }
    }
}
