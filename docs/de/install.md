![Logo](../../admin/fritzdect_logo.png)
# Installationshinweise

## FritzBox Einstellungen

es muß ein Benutzer angelegt sein, der Zugriff auf die DECT Objecte hat


![fritzbox](fritzdect_einstellung.PNG)


falls ein spezieller user angelegt wurde (also nicht admin für iobroker benutzt wird), dann sind die Berechtigungen zu setzen und die Voreinstellung das sich nur admin anmeldet, muß auf Benutzer umgestellt werden.

![fritzbox](fritz_iobroker_user.PNG)

![fritzbox](fritz_user.PNG)


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
Bei der Vorwahl von 0-AUTO wird die letzte Solltemperatur angewählt.

### Temperatur mit Offset
Es besteht die Möglichkeit die gemessene Temperatur in der FritzBox zu korrigieren, dazu gibt man die gemessene Temperatur an und es ergibt sich ein Offset. Dieser Offset wird für den Datenpunkt .temp mit berücksichtigt. Hier erhält man also die hoffentlich richtig vorherrschende Temperatur.
Die intern im Heizkörperregler benutzte Ist-Temperatur (.tist), ist durch den Offset nicht verändert. D.h. der HKR regelt intern auf dem unkorrigierten zu hohen oder zu niedrigen Wert. Dies ist bei der Vorgabe der Solltemperatur entprchend zu berücksichtigen!
Vergleichbar für den Soll-/Istverlaufs ist demnach tist und tsoll.

## Troubleshooting

Es ist ratsam das log anzuschauen, sofern nicht aussagekräftig oder zu wenig Information ist der debug modus über die Experteneinstellung der Instanz vorzuwählen.
