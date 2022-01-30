# homebridge-eufy

EufyHome (Anker) Plugin for [Homebridge](https://homebridge.io), based on [node-eufy-api](https://github.com/sebmos/node-eufy-api)

## 🛑 Warning: Eufy firmware bug

This package does not work reliable for all devices due to a firmware bug, which means the device will, when receiving a message via your local network, simply close the connection.

There is no known workaround for this problem.

## Supported Devices
|Device Code|Device Name|Comment|
|--|--|--|
|T1201|Smart Plug||
|T1202|Smart Plug Mini||
|T1203|Smart WiFi Plug (UK)||
|T1211|Smart Light Switch|Untested|
|T1011|Lumos Smart Bulb - White||
|T1012|Lumos Smart Bulb - Tunable White|Untested|
|T1013|Lumos Smart Bulb - White & Color||

All the devices listed above should work, since they are supported in _python-lakeside_. Because an error might have occurred during the porting process, some are marked as *untested*.

If you own one of these untested devices, or any other devices that are not listed above, please consider running the [_node-eufy-api_ command-line interface](https://github.com/sebmos/node-eufy-api#command-line-interface) and [opening an issue](https://github.com/sebmos/node-eufy-api/issues/new) to confirm whether or not your device works.

### Unsupported Devices
|Device Code|Device Name|
|--|--|
|T1015|Lumos Smart Bulb - Tunable White|
|T1018|Lumos Smart Bulb 2.0 Lite - White & Color|

## Installation

1. [Install Homebridge](https://github.com/nfarina/homebridge#installation)
2. Install this plugin using: `npm install -g homebridge-eufy`
3. Add the configuration below to your Homebridge configuration file

## Configuration

Add the JSON object below to the "platforms" array in your Homebridge configuration file, usually in `~/.homebridge/config.json`.

Replace the dummy email address and password with your EufyHome/Anker account details, which are required to find and connect to your devices. The optional flag `showPlugsAsSwitches` can be used to make the power plugs appear as switches in the Home app.

```json
"platforms": [{
    "platform": "eufy",
    "name": "eufy",
    "email": "email@example.com",
    "password": "s3cr3t"
}]
```

### New devices do not appear in Home app

At the moment, there is no automatic way to detect new devices when they are plugged in/enabled. To see newly added devices, please restart homebridge.

### Device names in Home app

The device names in the Home app will not be updated when you change them in the EufyHome app. This is a [HomeKit limitation](https://github.com/nfarina/homebridge#limitations). You can always rename your device in the Home app, though!

### Troubleshooting

If you get odd issues or error messages, delete your cached data by running these commands:

- `rm -rf ~/.homebridge/accessories`
- `rm -rf ~/.homebridge/persist`

If this does not solve your problem, try other suggestions from the [Homebridge documentation](https://github.com/nfarina/homebridge#common-issues).
