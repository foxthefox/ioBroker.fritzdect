![Logo](../../admin/fritzdect_logo.png)
# Installationshinweise

## FritzBox Einstellungen

es muß ein Benutzer angelegt sein, der Zugriff auf die DECT Objecte hat


![fritzbox](fritzdect_einstellung.PNG)


## Adapter Einstellungen

* IP mit vorangestellten "http://" eingeben
* Polling Intervall kann beliebig gewählt werden (Voreinstellung 5min=300sec). Dies ist notwendig um Bedienung ausserhalb von ioBroker nachzuführen, da die FritzBox keine automatischen Updates liefert.
![admin](fritzdect_admin.PNG)


## Adapter Start

mit dem Start des Adapters wird folgendes getan:
* die FW der Fritzbox wird abgefragt und im log geschrieben (manche Fritzboxen antworten darauf nicht und dies erzeugt ein Fehler).
* die Datenpunkte (Objekte) werden für Devices angelegt
* die Datenpunkte (Objekte) für Gruppen werden angelegt
* die Objekte werden mit Daten versorgt

Die folgenden Objekte werden nur einmalig beim Start geschrieben:
* id
* fwversion
* manufacturer
* productname
* masterdviceid
* members

## Thermostatfunktion

Das Thermostat kann im Automatikmodus betrieben werden (Temperaturregelung) und hierbei wird auf die Solltemperatur geregelt.
Die Solltemperatur kann die Komfortemperatur, die Absenktemperatur oder eine selbst gewählte Temperatur sein.

Zusätzlich kann das Ventil komplett geschlossen werden und die entspricht dem Zustand OFF.
Die andere Richtung kann mit ON auch vorgewählt werden und würde einem BOOST oder Saunamodus entsprechen (nicht vergessen es wieder regeln zu lassen ;-) ).

Diese derzeitig 3 Betriebsarten sind mit 0, 1 oder 2 im Datenpunkt mode vorwählbar.
Bei der Vorwahl von AUTO wird die letzte Solltemperatur angewählt.


