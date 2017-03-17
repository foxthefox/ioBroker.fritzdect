![Logo](admin/fritzdect_logo.png)
# ioBroker.fritzdect

[![NPM version](http://img.shields.io/npm/v/iobroker.fritzdect.svg)](https://www.npmjs.com/package/iobroker.fritzdect)
[![Downloads](https://img.shields.io/npm/dm/iobroker.fritzdect.svg)](https://www.npmjs.com/package/iobroker.fritzdect)
[![Build Status](https://travis-ci.org/foxthefox/ioBroker.fritzdect.svg?branch=master)](https://travis-ci.org/foxthefox/ioBroker.fritzdect)

[![NPM](https://nodei.co/npm/iobroker.fritzdect.png?downloads=true)](https://nodei.co/npm/iobroker.fritzdect/)

Fritzbox DECT adapter for ioBroker

## Installation:
released version on npm with 
* npm install iobroker.fritzdect

or the actual version from github with 

* npm install https://github.com/foxthefox/ioBroker.fritzdect/tarball/master --production

## Setup

IP-address and password of Fritzbox should be defined in io-package.json or via admin page, before the first start of the instance.

The devices are detected automatically during startup of fritzdect instance.

the widget requires that also vis-metro and vis-jqui-mfd are installed

## Known Issues:
??

## TODO:
* Energystats

http://fritz.box/net/home_auto_query.lua?sid=+sid+'&command=EnergyStats_10&id='+ain+'&xhr=1'

http://fritz.box/net/home_auto_query.lua?sid=+sid+'&command=EnergyStats_24h&id='+ain+'&xhr=1'

## Changelog

### 0.0.7
* current temp of Comet/DECT300
* cyclic polling GuestWLAN

### 0.0.6
* correction targettemp in DECT200 section

### 0.0.5
* setTemp on COMET
* GuestWlan corrected

###0.0.4
* cyclic status polling

### 0.0.3
* user now configurable

### 0.0.2
* metro widget for Dect200
* smartfritz-promise->fritzapi
* running version, tested with 1x DECT200 and Fritzbox FW=6.51 on Win10 with 4.5.0 and raspberry 4.7.0

### 0.0.1
* running version, tested with 1x DECT200 and Fritzbox FW=6.30
