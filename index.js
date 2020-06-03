/******************************************************************
 * homebridge-ghoma
 *
 * a plugin for homebridge to enable G-Homa outlets in homebridge
 *
 * created 11/24/17 by CptMW
 *
 ******************************************************************/

const ghoma = require('ghoma');
const http = require('http');
const path = require('path');
const fs = require('fs');

const heartbeattimeout = 30 * 60; // heartbeat timeout in seconds after which the outlet will be removed from homekit

var host = undefined;

module.exports = function (h) {

    host = h;
    host.registerPlatform("homebridge-ghoma", "GHoma", GHomaPlatform, true);

};


function GHomaPlatform(log, config, api) {

    log.info('------> starting homebridge-ghoma <------');

    this.Accessory = host.platformAccessory;

    this.Service = host.hap.Service;
    this.Characteristic = host.hap.Characteristic;
    this.UUIDgen = host.hap.uuid;

    this.log = log;
    this.hostConfig = config;
    this.api = api;

    this.accessories = [];
    this.HBtimers = [];

    var home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
    this.configPath = path.join(home, '.homebridge/ghoma_conf.json');

    try {
        this.config = require(this.configPath);
    } catch (err) {
        this.config = {};
        this.config['ignoreDevices'] = [];
    }

    // starting server that keeps connection to physical G-Homa outlets
    ghoma.startServer(4196);

    /*
        api.on('didFinishLaunching', function () {
            this.webInterface = require('./lib/WebInterface.js')(this);
        }.bind(this));
    */

    ghoma.onNew = function (plug) {
        console.log('ghoma: Registered    ' + plug.remoteAddress + " " + plug.id);

        this.heartbeatHandler(plug.id);

        // outlet was registered by ghoma server
        // run addNewDevices to assure the outlet is added
        // to homebridge in case it is not in the cache yet
        this.addNewOutlet(plug);

        // set 'OutletInUse' to true
        this.getFromAccessories(plug).getService(this.Service.Outlet).getCharacteristic(this.Characteristic.OutletInUse).updateValue(true);
    }.bind(this);

    ghoma.onStatusChange = function (plug) {
        this.log.info('New state of ' + plug.remoteAddress + ' is ' + plug.state + ' triggered ' + plug.triggered);

        this.heartbeatHandler(plug.id);

        if (this.getFromAccessories(plug)) {
            var srvc = this.getFromAccessories(plug).getService(this.Service.Outlet);

            if (plug.state === 'on')
                srvc.getCharacteristic(this.Characteristic.On).updateValue(1);
            else
                srvc.getCharacteristic(this.Characteristic.On).updateValue(0);
        }

    }.bind(this);

    ghoma.onHeartbeat = function (plug) {
        this.heartbeatHandler(plug.id);
    }.bind(this);
}


GHomaPlatform.prototype.heartbeatHandler = function (id) {

    if (this.HBtimers[id])
        clearTimeout(this.HBtimers[id]);

    this.HBtimers[id] = setTimeout(function (id) {

        this.log.info('missing heartbeat of ', id);
        delete this.HBtimers[id];

        this.removeAccessory(id);
    }.bind(this), heartbeattimeout * 1000, id);
};

/****
 * callback from homebridge
 * 
 * will be called for every cached accessory by host
 ****/
GHomaPlatform.prototype.configureAccessory = function (accessory) {

    this.log.info(accessory.displayName, "Configure Accessory");

    this.registerCallbacks(accessory);

    this.accessories.push(accessory);

    this.heartbeatHandler(accessory.context.plugID);
};


/****
 * adds an outlet to homebridge in case it is new
 *
 * Accessories cached by homebridge are already in the 
 * accessories array. In case plug is in this array it won't
 * be added by this function
 ****/
GHomaPlatform.prototype.addNewOutlet = function (plug, name) {

    // if not yet registered
    if (!this.getFromAccessories(plug)) {

        var accessoryName,
            uuidString = 'Ghoma Outlet' + plug.id;

        if (name)
            accessoryName = name;
        else
            accessoryName = uuidString;

        var uuid = this.UUIDgen.generate(uuidString);

        this.log.info('===================================');
        this.log.info('add outlet with id: ' + plug.id);
        this.log.info('          named it: ' + accessoryName);

        var newAccessory;

        newAccessory = new this.Accessory(accessoryName, uuid);
        newAccessory.addService(this.Service.Outlet, accessoryName);

        // save Outlet ID from ghoma server to homebridge accessory to allow for persistent
        // mapping between plug object of ghora lib and accessory in homebridge
        newAccessory.context.plugID = plug.id;

        this.registerCallbacks(newAccessory);
        this.accessories.push(newAccessory);
        this.api.registerPlatformAccessories("homebridge-ghoma", "GHoma", [newAccessory]);
        this.heartbeatHandler(plug.id);
    }
};

/******
 * sets up all functions required for interaction with homekit
 *
 * also configures information service
 ******/
GHomaPlatform.prototype.registerCallbacks = function (accessory) {

    accessory.on('identify', function (paired, callback) {
        this.log.info(accessory.displayName, "Identify!!!");
        callback();
    });

    var informationService = accessory.getService(this.Service.AccessoryInformation);
    informationService.setCharacteristic(this.Characteristic.Manufacturer, "Hardware by GOA, Software by OpenSource Community")
        .setCharacteristic(this.Characteristic.Model, "G-Homa Outlets")
        .setCharacteristic(this.Characteristic.SerialNumber, "n/a");

    var srvc = accessory.getService(this.Service.Outlet);

    if (srvc) {
        srvc.getCharacteristic(this.Characteristic.On).on('set', function (value, callback) {
            this.log.info(accessory.displayName, " -> ", (value) ? 'On' : 'Off');
            var plug = ghoma.get(accessory.context.plugID);
            if (plug) {
                if (value)
                    plug.on();
                else
                    plug.off();
                callback();
            } else {
                callback('no_response');
            }
            this.heartbeatHandler(plug.id);
        }.bind(this));

        srvc.getCharacteristic(this.Characteristic.On).on('get', function (callback, context) {
            var plug = ghoma.get(accessory.context.plugID);
            if (plug) {
                callback(null, (plug.state === 'on'));
                this.heartbeatHandler(plug.id);
            }
            else
                callback('no_response');
        }.bind(this));

        srvc.getCharacteristic(this.Characteristic.OutletInUse).on('get', function (callback, context) {
            this.log.info(accessory.displayName, "OutletInUse - get");
            callback(null, true);
        }.bind(this));
    }
};

/******
 * maps plugs from ghoma server to accessories 
 ******/
GHomaPlatform.prototype.getFromAccessories = function (plug) {
    for (i = 0; i < this.accessories.length; i++) {
        if (this.accessories[i].context.plugID === plug.id) {
            return this.accessories[i];
        }
    }
    return undefined;
};

/******
 * removes a plug from current homebridge instance
 ******/
GHomaPlatform.prototype.removeAccessory = function (id) {

    var accessory = [];
    accessory.push(this.getFromAccessories(ghoma.get(id)));
    if (accessory.length > 0) {
        this.log.info('remove accessories: ' + accessory[0].displayName);
        this.api.unregisterPlatformAccessories("homebridge-ghoma", "GHoma", accessory);
        var removeIndex = this.accessories.indexOf(accessory[0]);
        if (removeIndex > -1)
            this.accessories.splice(removeIndex, 1);
    }

};

/******
 * store config file
 ******/
GHomaPlatform.prototype.storeConfig = function () {
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, '    '));
};
