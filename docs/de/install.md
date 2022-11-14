![Logo](../../admin/fritzdect_logo.png)
# Installationshinweise

## FritzBox Einstellungen

es muß ein Benutzer sein, der Zugriff auf die Fritzbox und Smarthome hat

# Passwort
möglicherweise kann es Probleme geben:
- Passwort länger als 32 Zeichen
- Verwendung von Sonderzeichen
- Verwendung von erweiterten ASCII
Falls es Probleme gibt, dann eventuell erstmal ein kürzeres und einfaches PW nehmen um grundsätzlich den login-Mechanismus des Adapters zu testen, dann sukzessive erweitern.

## Adapter Einstellungen

* IP mit vorangestellten "http://" eingeben
* Polling Intervall kann beliebig gewählt werden (Voreinstellung 5min=300sec). Dies ist notwendig um Bedienung ausserhalb von ioBroker nachzuführen, da die FritzBox keine automatischen Updates liefert.


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
Bei der Vorwahl von 0-AUTO wird die letzte Solltemperatur angewählt.

### Temperatur mit Offset
Es besteht die Möglichkeit die gemessene Temperatur in der FritzBox zu korrigieren, dazu gibt man die gemessene Temperatur an und es ergibt sich ein Offset. Dieser Offset wird für den Datenpunkt .temp mit berücksichtigt. Hier erhält man also die interne Temperaturmessung.
Die intern im Heizkörperregler benutzte Ist-Temperatur (actualtemp), wird durch den Offset auch verändert. D.h. der HKR regelt intern auf den korrigierten Wert.
Vergleichbar für den Soll-/Istverlaufs ist demnach atualtemp und targettemp.

## Troubleshooting

Es ist ratsam das log anzuschauen, sofern nicht aussagekräftig oder zu wenig Information ist der debug modus über die Experteneinstellung der Instanz vorzuwählen.
