# decoding of functionbitmask

|device|decimal|color (514)|level (513)|simple ONOFF (512)|not used|hanfun unit|group|microfon|repeater|steckdose|temp|energie|hkr|AVM button|alert (256)|button (772)|lamp|not used|hanfun device|
|:--------|:--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
|bitmask| |bit 17|bit 16|bit 15|bit 14|bit 13|bit 12|bit 11|bit 10|bit 9|bit 8|bit 7|bit 6|bit 5|bit 4|bit 3|bit 2|bit 1|bit 0|
|wert| |131072|65636|32768|16384|8192|4096|2048|1024|512|256|128|64|32|16|8|4|2|1|
|dect 300|320|0|0|0|0|0|0|0|0|0|256|0|64|0|0|0|0|0|0|
|dect 200|896|0|0|0|0|0|0|0|0|512|256|128|0|0|0|0|0|0|0|
|repeater, dect 100|1280|0|0|0|0|0|0|0|1024|0|256|0|0|0|0|0|0|0|0|
|sgroup|512|0|0|0|0|0|0|0|0|512|0|0|0|0|0|0|0|0|0|
|dect 200|2688|0|0|0|0|0|0|2048|0|512|0|128|0|0|0|0|0|0|0|
|sgroup|6784|0|0|0|0|0|4096|2048|0|512|0|128|0|0|0|0|0|0|0|
|hgroup|4160|0|0|0|0|0|4096|0|0|0|0|0|64|0|0|0|0|0|0|
|dect200|2944|0|0|0|0|0|0|2048|0|512|256|128|0|0|0|0|0|0|0|
|powerline546e|640|0|0|0|0|0|0|0|0|512|0|128|0|0|0|0|0|0|0|
|dect 400|32|0|0|0|0|0|0|0|0|0|0|0|0|32|0|0|0|0|0|
|dect 440|288|0|0|0|0|0|0|0|0|0|256|0|0|32|0|0|0|0|0|
|dect 440|1048864 |0|0 |0|16384|0|0 |2048|0|0|0  |0|64|32|0  |0|4|0|0|

#decoding functionbitmask for HAN-FUN

|device|decimal|color (514)|level (513)|simple ONOFF (512)|not used|hanfun unit|group|microfon|repeater|steckdose|temp|energie|hkr|AVM button|alert (256)|button (772)|lamp|not used|hanfun device|
|:--------|:--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
|bitmask| |bit 17|bit 16|bit 15|bit 14|bit 13|bit 12|bit 11|bit 10|bit 9|bit 8|bit 7|bit 6|bit 5|bit 4|bit 3|bit 2|bit 1|bit 0|
|simple detector (512)|8208|0|0|0|0|8192|0|0|0|0|0|0|0|0|16|0|0|0|0|
|door open detector (513)|8208|0|0|0|0|8192|0|0|0|0|0|0|0|0|16|0|0|0|0|
|window open detector (514)|8208|0|0|0|0|8192|0|0|0|0|0|0|0|0|16|0|0|0|0|
|motion detector (515)|8208|0|0|0|0|8192|0|0|0|0|0|0|0|0|16|0|0|0|0|
|flood detector (518)|8208|0|0|0|0|8192|0|0|0|0|0|0|0|0|16|0|0|0|0|
|glas break detector (519)|8208|0|0|0|0|8192|0|0|0|0|0|0|0|0|16|0|0|0|0|
|vibration detector (520)|8208|0|0|0|0|8192|0|0|0|0|0|0|0|0||0|0|0|0|
|button (273)|8200|0|0|0|0|8192|0|0|0|0|0|0|0|0|0|8|0|0|0|
|dimmable color bulb (278)|237572|131072|65536|32768|0|8192|0|0|0|0|0|0|0|0|0|0|4|0|0|
|blind (281)|*8192*|0|0|0|0|8192|0|0|0|0|0|0|0|0|0|0|0|0|0|
|lamellar (282)|*8192*|0|0|0|0|8192|0|0|0|0|0|0|0|0|0|0|0|0|0|
|dimmable light dect500 (265)|106500|0|65536|32768|0|8192|0|0|0|0|0|0|0|0|0|0|4|0|0|
|dimmer switch (266)|106496|0|65536|32768|0|8192|0|0|0|0|0|0|0|0|0|0|0|0|0|
|simple on/off switch (256/257)|40960|0|0|32768|0|8192|0|0|0|0|0|0|0|0|0|0|0|0|0|
|simple light (264)|40964|0|0|32768|0|8192|0|0|0|0|0|0|0|0|0|0|4|0|0|
|color bulb (278)|172036|131072|0|32768|0|8192|0|0|0|0|0|0|0|0|0|0|4|0|0|

##772 Simple Button
* button lastpressedtimestamp

##256 Alert
* alert state (0/1)

##512 ON_OFF
* simpleonoff state (0/1)

##513 LEVEL_CTRL
* levelcontrol level
* levelcontrol levelpercentage

##514 COLOR_CTRL
* colorcontrol supported_modes
* colorcontrol current_mode
* colorcontrol hue
* colorcontrol saturation
* colorcontrol temperature




