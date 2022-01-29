import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { loadDevices, createDevice, Device } from 'node-eufy-api';
import { PLUGIN_NAME, PLATFORM_NAME } from './settings';
import { EufyAccessory } from './platformAccessory';

export class EufyHomePlatform implements DynamicPlatformPlugin {
    public readonly Service: typeof Service = this.api.hap.Service;
    public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

    private eufyEmail: string;
    private eufyPassword: string;
    private showPlugsAsSwitches: boolean;
    private accessories: PlatformAccessory[] = [];

    constructor(
        public readonly log: Logger,
        public readonly config: PlatformConfig,
        public readonly api: API
    ) {
        log.debug('Eufy initializing');

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
                this.log.error('Invalid showPlugsAsSwitches config value - must be boolean value!');
            }
        }

        // triggered once homebridge finished loading cached accessories.
        // new plugins should only be registered after this event
        this.api.on('didFinishLaunching', async () => {
            const devices = await loadDevices(this.eufyEmail, this.eufyPassword);
            devices.forEach(device => this.addAccessory(device));
        });
    }

    configureAccessory(accessory: PlatformAccessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);

        if (typeof accessory.context.model !== 'string' ||
            typeof accessory.context.code !== 'string' ||
            typeof accessory.context.ipAddress !== 'string') {
            this.log.error('Unknown accessory context:', accessory.context);
            return;
        }

        const device = createDevice(
            accessory.context.model,
            accessory.context.code,
            accessory.context.ipAddress,
            accessory.displayName
        );

        new EufyAccessory(this, this.showPlugsAsSwitches, accessory, device);

        this.accessories.push(accessory);
    }

    addAccessory(device: Device) {
        this.log.info('Add Accessory:', device.name, '-', device.code);

        if (this.accessories.find(accessory => accessory.context.code === device.code)) {
            this.log.info('Skipping accessory, already registered');
            return;
        }

        const uuid = this.api.hap.uuid.generate(device.code);
        const newAccessory = new this.api.platformAccessory(device.name, uuid);

        newAccessory.context = {
            name: device.name,
            model: device.model,
            code: device.code,
            ipAddress: device.ipAddress
        };

        new EufyAccessory(this, this.showPlugsAsSwitches, newAccessory, device);

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [newAccessory]);
    }

    removeAccessory(accessory: PlatformAccessory) {
        this.log.info('Removing accessory:', accessory.context.name);

        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

        this.accessories = this.accessories.filter(a => a !== accessory);  
    }
}
