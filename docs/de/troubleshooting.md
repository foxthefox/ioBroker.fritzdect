# troubleshooting "fritzbox returned this {"msg":"failed to login, wrong user name or password","function":"send_response","error":"0000000000000000"}"

Diese Meldung kann mehrere Ursachen haben und ist nicht zwingend ausschließlich USER/PW. Die FB meldet lediglich "0000000000000000", was ein nicht erfolgreiches login bedeutet.


## mögliche Ursachen
* USER/PW passen nicht zusammen
* keine Berechtigung in der FB für diesen USER gesetzt
* Anmeldung mit Benutzernamen nicht gesetzt
* zu viele Logins zur gleichen Zeit
* Sperrzeit nach erfolglosen login an FB. Die FB sperrt nach mehreren erfolglosen logins den Zugang. Der ablaufende Timer ist anfänglich kurz und verlängert sich, je weiter versucht wird sich anzumelden.
* zu schnelles Polling im Adapter Config eingestellt (Voreinstellung 300s=5min), je nach Umfeld sind < 10s kritisch
* Skripte die ein Feuerwerk an Befehlen absetzen
* andere iobroker Instanzen oder andere smarthome systeme, die auch auf FB zugreifen
* instabiles WLAN oder andere Netzwerkprobleme

## Fehlersuche
* Überprüfung USER/PW FB und ADAPTER
* Überprüfung der Berechtigungen in der FB
* Überprüfung ob bei Zugriff aus dem Heimnetz "Anmeldung mit Fritz!Box-Benutzernamen und Kennwort" gesetzt ist
* über die Weboberfläche sich mit dem USER/PW einloggen
* Überprüfung polling Intervall in der Adapter Config
* adapter im debug-Modus starten und das log anschauen
    * wann passieren die Meldungen, in welchem Abstand (Abstand genau dem des pollings)
    * Meldung, wenn Befehle abgesetzt werden
    * Meldung, wenn Skripte zu einem Ergbenis kamen
    * wird das geloggt, was der Erwartungshaltung entspricht?
* log in der FB anschauen
* alternativ mit python ein login versuchen, Anleitung hier: [logintest](./logintest.md)
* ggf. FB neu starten
