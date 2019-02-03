var awsIot = require('aws-iot-device-sdk'); 
var rpiDhtSensor = require('rpi-dht-sensor'); 
 
var dht = new rpiDhtSensor.DHT11(2); // `2` => GPIO2 
const NODE_ID = 'PiLumenary'; 
const INIT_DELAY = 15; 
const TAG = '[' + NODE_ID + '] >>>>>>>>> '; 

const Gpio = require('pigpio').Gpio;

// The number of microseconds it takes sound to travel 1cm at 20 degrees celcius
const MICROSECDONDS_PER_CM = 1e6/34321;

const trigger = new Gpio(23, {mode: Gpio.OUTPUT});
const echo = new Gpio(24, {mode: Gpio.INPUT, alert: true});

trigger.digitalWrite(0); // Make sure trigger is low
 
console.log(TAG, 'Connecting...'); 
 
var thingShadow = awsIot.thingShadow({ 
  keyPath: './certs/1494e8e5ee-private.pem.key', 
  certPath: './certs/1494e8e5ee-certificate.pem.crt', 
  caPath: './certs/root-CA.crt', 
  clientId: NODE_ID, 
  host: 'a9f90c69gsnk4-ats.iot.us-east-1.amazonaws.com', 
  port: 8883, 
  region: 'us-east-1', 
  debug: false, // optional to see logs on console 
}); 
 
thingShadow.on('connect', function() { 
  console.log(TAG, 'Connected.'); 
  thingShadow.register(NODE_ID, {}, function() { 
    console.log(TAG, 'Registered.'); 
    console.log(TAG, 'Reading data in ' + INIT_DELAY + ' seconds.'); 
    setTimeout(sendData, INIT_DELAY * 1000); // wait for `INIT_DELAY` seconds before reading the first record 
  }); 
}); 

const watchHCSR04 = () => {
	let startTick;
  
	echo.on('alert', (level, tick) => {
	  if (level == 1) {
		startTick = tick;
	  } else {
		const endTick = tick;
		const diff = (endTick >> 0) - (startTick >> 0); // Unsigned 32 bit arithmetic
		console.log(diff / 2 / MICROSECDONDS_PER_CM);
		var distance = diff / 2/ MICROSECDONDS_PER_CM;
	  }
	});
	return {
		"distance" : distance
	}
  };
  
 
function fetchData() { 
  var readout = dht.read(); 
  var temp = readout.temperature.toFixed(2); 
  var humd = readout.humidity.toFixed(2); 
 
  return { 
    "temp": temp, 
    "humd": humd 
  }; 
} 
 
function sendData() { 
  var DHT11State = { 
    "state": { 
      "distance": watchHCSR04() 
    } 
  }; 
 
  console.log(TAG, 'Sending Data..', DHT11State); 
 
  var clientTokenUpdate = thingShadow.update(NODE_ID, DHT11State); 
  if (clientTokenUpdate === null) { 
    console.log(TAG, 'Shadow update failed, operation still in progress'); 
  } else { 
    console.log(TAG, 'Shadow update success.'); 
  } 
 
  // keep sending the data every 30 seconds 
  console.log(TAG, 'Reading data again in 30 seconds.'); 
  setTimeout(sendData, 30000); // 30,000 ms => 30 seconds 
} 
 
thingShadow.on('status', function(thingName, stat, clientToken, stateObject) { 
  console.log('received ' + stat + ' on ' + thingName + ':', stateObject); 
}); 
 
thingShadow.on('delta', function(thingName, stateObject) { 
  console.log('received delta on ' + thingName + ':', stateObject); 
}); 
 
thingShadow.on('timeout', function(thingName, clientToken) { 
  console.log('received timeout on ' + thingName + ' with token:', clientToken); 
});