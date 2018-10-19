//server to emulate the musiccast resonses
var http = require('http');
var fs = require('fs');

var content = fs.readFileSync('../test_api_response.xml');
console.log(String(content));

var server;

function setupHttpServer(callback) {
    //We need a function which handles requests and send response
    //Create a server
    server = http.createServer(handleHttpRequest);
    //Lets start our server
    server.listen(3333, function () {
        //Callback triggered when server is successfully listening. Hurray!
        console.log("HTTP-Server listening on: http://localhost:%s", 3333);
        callback();
    });

}

var challenge = '0a355ee5';
var challenge2 = '3148720a';
var password = 'FB-7673'
var challengeResponse = challenge +'-'+require('crypto').createHash('md5').update(Buffer(challenge+'-'+password, 'UTF-16LE')).digest('hex');
var sid = 'e3e154790a412aec';


function handleHttpRequest(request, response) {
    console.log('HTTP-Server: Request: ' + request.method + ' ' + request.url);

    if (request.url == '/login_sid.lua') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/xml' });
        response.write('<?xml version="1.0" encoding="utf-8"?><SessionInfo><SID>0000000000000000</SID><Challenge>'+challenge+'</Challenge><BlockTime>0</BlockTime><Rights></Rights></SessionInfo>');
        response.end(); 
    }
    
    else if (request.url == '/login_sid.lua?username=admin') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/xml' });
        response.write('<?xml version="1.0" encoding="utf-8"?><SessionInfo><SID>0000000000000000</SID><Challenge>'+challenge+'</Challenge><BlockTime>0</BlockTime><Rights></Rights></SessionInfo>');
        response.end(); 
    }

    else if (request.url == '/login_sid.lua?username=admin&response='+challengeResponse) { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/xml' });
        response.write('<?xml version="1.0" encoding="utf-8"?><SessionInfo><SID>'+sid+'</SID><Challenge>'+challenge2+'</Challenge><BlockTime>0</BlockTime><Rights><Name>Dial</Name><Access>2</Access><Name>App</Name><Access>2</Access><Name>HomeAuto</Name><Access>2</Access><Name>BoxAdmin</Name><Access>2</Access><Name>Phone</Name><Access>2</Access><Name>NAS</Name><Access>2</Access></Rights></SessionInfo>');
        response.end(); 
    }
    else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid='+sid+'&switchcmd=getswitchlist') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write(JSON.stringify([ '087610006102', '34:31:C1:AB:68:53', '119600642220', 'EF:C4:CC-900' ]));
        response.end(); 
    }   
    else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid='+sid+'&switchcmd=getdevicelistinfos') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write( String(content) );
        response.end(); 
    }
    else {
        console.log(' not supported call ' + request.url);
        response.statusCode = 403;
        response.end();
    }    
}


setupHttpServer(function() {});
