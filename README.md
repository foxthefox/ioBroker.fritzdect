![Logo](admin/fritzdect_logo.png)
# ioBroker.fritzdect
=================
Fritzbox DECT adapter for ioBroker

Installation:

npm install https://github.com/foxthefox/ioBroker.fritzdect/tarball/master --production

Setup
If IP-adress of Fritzbox is not reachable with fritz.box the IP should be defined in io-package.json.
Password has to be defined in io-package.json.

The decices are detected automatically.

Known Issues:

temperature reading on DECT200 not working

TODO

Energy statistics

http://fritz.box/net/home_auto_query.lua?sid=+sid+'&command=EnergyStats_10&id='+ain+'&xhr=1'

http://fritz.box/net/home_auto_query.lua?sid=+sid+'&command=EnergyStats_24h&id='+ain+'&xhr=1'

Changelog
0.0.2
smartfritz-promise->fritzapi
to be tested with FW=6.51

0.0.1
running version, tested with 1x DECT200 and Fritzbox FW=6.30
