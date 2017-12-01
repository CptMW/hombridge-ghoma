# homberidge-ghoma

Introduction
------------

Homebridge-ghoma is a plugin to [Homebridge][], enables the usage of G-Homa outlets. G-Homa outlets are affordable outlets that connect to your Wireless-Lan. This project does not allow for usage of all features offfered by the outlet, but for simple switching by HomeKit through Homebridge. Most features of the manufacturer's app however you can achieve with HomeKit's features. Presumably that's why you are looking at this project here anyway.

  [homebridge]: https://github.com/nfarina/homebridge
  
The plugin makes use of the work done by rodney42 for the project [node-ghoma][]. Before you can use your G-Homa outlets you need to prepare them. Out of the box they are configured to connect to the manufacturer's control server. To use them with this plugin, you need to change the ip they connect to, to your homebridge server's ip. You can use [node-ghoma][] to set that ip. There is a config.js that allows you setting the ip of the server the outlet should connect to. Refer to that file for detailed instructions.

  [node-ghoma]: https://github.com/rodney42/node-ghoma
  
After you have set the control server ip and installed homebridge-ghoma your outlet(s) should appear in your HomeKit-App (like Apple's Home) for further use and configuration. There is also web server with the plugin. It runs on port 19091. The interface is not of too much use yet. However it allows you to see what outlets have been registered and propagated to homebridge. 
