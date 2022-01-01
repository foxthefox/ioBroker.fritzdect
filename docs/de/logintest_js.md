# (EN) Test login to FB

In order to check the mechanism of login to FB without the WEB-GUI the following can be done alternatively to ioBroker

1. login to raspberry

2. goto folder:
```
/opt/iobroker/node_modules/iobroker.fritzdect/docs/de
```

3. invoke following command with YOUR data
```
node fritz.js -u "YOUR_USER" -p "YOUR_PW" --url "http://YOUR_FB_address" 
```
e.g. node fritz.js -u admin -p 1234 --url http://192.168.178.1 

4. check the result
If the login is sucessful it is reported like that and a session ID is provided as well as the devices, groups and permissions.

# (DE) Test des login auf FB

Um auf einem anderen Weg als die Weboberfläche und ioBroker den Login-Mechanismus zu testen, können die folgenden Schritte ausgeführt werden.

1. auf den raspberry einloggen 

2. in das Verzeichnis wechseln:
```
/opt/iobroker/node_modules/iobroker.fritzdect/docs/de
```

3. den Befehl mit IHREN Daten absetzen
```
node fritz.js -u "YOUR_USER" -p "YOUR_PW" --url "http://YOUR_FB_address" 
```
z.B. node fritz.js -u admin -p 1234 --url http://192.168.178.1 

4. Überprpüfung des Resultats
Wenn das Login erfolgreich ist, dann wird es als solches angezeigt und eine Session ID angezeigt, desweiteren gibt es eine Auflistung der Geräte, Gruppen und Rechte