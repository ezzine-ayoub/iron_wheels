@echo off
echo ================================================
echo    RESTART COMPLET - Mobile Iron App
echo ================================================
echo.

echo [1/6] Arret de Metro...
taskkill /F /IM node.exe 2>nul
timeout /t 2 >nul

echo [2/6] Nettoyage du cache Metro...
rd /s /q %TEMP%\metro-* 2>nul
rd /s /q %TEMP%\react-* 2>nul
rd /s /q %TEMP%\haste-* 2>nul

echo [3/6] Nettoyage Android...
cd android
call gradlew.bat clean
cd ..

echo [4/6] Suppression node_modules...
rd /s /q node_modules 2>nul
del package-lock.json 2>nul
del yarn.lock 2>nul

echo [5/6] Reinstallation des dependances...
call npm install

echo [6/6] Demarrage Metro avec reset cache...
echo.
echo ================================================
echo   PRET ! Maintenant execute dans un autre terminal:
echo   npx react-native run-android
echo ================================================
echo.

npx react-native start --reset-cache
