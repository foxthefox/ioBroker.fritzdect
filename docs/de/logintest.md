# (EN) Test login to FB

In order to check the mechanism of login to FB without the WEB-GUI the following can be done alternatively to nodejs

Assumption: you are using a raspberry with python3 installed. (the principal is valid also on other machines)

1. login to raspberry

2. goto folder:
```
/opt/iobroker/node_modules/iobroker.fritzdect/docs/de
```

3. invoke following command with YOUR data
```
python3 fritz.py "http://YOUR_FB_address" "YOUR_USER" "YOUR_PW"
```
e.g. python3 fritz.py http://192.168.178.1 admin 1234

4. check the result
If the login is sucessful it is reported like that and a session ID is provided.

# (DE) Test des login auf FB

Um auf einem anderen Weg als die Weboberfläche und nodejs den Login-Mechanismus zu testen, können die folgenden Schritte ausgeführt werden.

Annahme: Sie verwenden einen raspberry mit installiertem python3. (Das Prinzip trifft auch auf anderen Maschinen zu.)

1. auf den raspberry einloggen 

2. in das Verzeichnis wechseln:
```
/opt/iobroker/node_modules/iobroker.fritzdect/docs/de
```

3. den Befehl mit IHREN Daten absetzen
```
python3 fritz.py "http://IHRE_FB_adresse" "IHR_USER" "IHR_PW"
```
e.g. python3 fritz.py http://192.168.178.1 admin 1234

4. Überprpüfung des Resultats
Wenn das Login erfolgreich ist, dann wird es als solches angezeigt und eine Session ID angezeigt