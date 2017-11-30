/***********
 * 
 * Webinterface for homebridge-ghoma
 * 
 ***********/

ghoma = require('ghoma');
fs = require('fs');

function WebInterface(platform) {
    
    this.platform = platform;
    
    var webApp = require('express')();
    
    webApp.listen(19091);
    
    webApp.get('/', this.handleRequest.bind(this));    
    webApp.get('/index.html', this.handleRequest.bind(this));    
    webApp.get('/api/ignore', this.ignore.bind(this));
    //webApp.get('/api/rename', this.rename.bind(this));
    webApp.get('/api/toggle', this.toggle.bind(this));
    webApp.get('/api/outletlist', this.outletlist.bind(this));    
    
}

WebInterface.prototype.ignore = function(req,res) {
    var param = req.url.split('?')[1];
    
    // remove outlet from homebridge
    this.platform.removeAccessory(param);
    
    // add outlet to device to be ignored and store the config
    if (!this.platform.config['ignoreDevices'])
        this.platform.config['ignoreDevices'] = [];
    
    this.platform.config['ignoreDevices'].push(param);
    
    this.platform.storeConfig();
    
    res.redirect('/');
};

WebInterface.prototype.toggle = function(req,res) {    
    var param = req.url.split('?')[1];
    var plug = ghoma.get(param);
    this.platform.log.info(plug.state);
    if (plug.state === 'off')
        plug.on();
    else
        plug.off();
    res.redirect('/');
};

WebInterface.prototype.handleRequest = function (req, res) {       
    res.writeHead(200, {'Content-Type': 'text/html'} );
    var html = fs.readFileSync(__dirname + '/httpfiles/index.html');
    res.write(html);
    res.end();
};

WebInterface.prototype.outletlist = function (req, res) {    
    var outlets = [];
    
    this.platform.accessories.forEach(function(acc) {
        outlets.push({ id: acc.context.plugID, 
                       name: acc.displayName, 
                       state: ghoma.get(acc.context.plugID).state
                     }); 
    });
    
    res.json(outlets);
};

/*
WebInterface.prototype.rename = function(req,res) {
    var rawParams = req.url.split('?')[1].split('&'),
        params = {}; 
    
    this.platform.log.info(rawParams);
    rawParams.forEach(function(item) {
        var tmp = item.split('=');
        params[tmp[0]] = [tmp[1]];
    });

    this.platform.renameAccessory(params.id, params.name);
    
    res.redirect('/');
    
};
*/  

module.exports = function(platform) {
    return new WebInterface(platform);
};