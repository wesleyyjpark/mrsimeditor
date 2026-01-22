@echo off
REM Simple batch file to copy tracks to Documents/MRSIM/Tracks
REM Just double-click this file to install tracks!

REM If not running in a visible window, restart in one
if "%1" neq "visible" (
    start "" cmd /k "%~f0" visible
    exit /b
)

setlocal enabledelayedexpansion

REM Get script directory and resolve parent directory path
set "SCRIPT_DIR=%~dp0"
cd /d "%~dp0\.." 2>nul
if errorlevel 1 (
    echo ERROR: Could not navigate to parent directory
    echo Script location: %~dp0
    goto :end
)
set "SOURCE_FOLDER=%CD%\tracks"
cd /d "%~dp0" 2>nul

set "DEST_FOLDER=%USERPROFILE%\Documents\MRSIM\Tracks"

echo ========================================
echo MRSIM Track Installer
echo ========================================
echo.
echo Script directory: %SCRIPT_DIR%
echo Source folder: %SOURCE_FOLDER%
echo Destination folder: %DEST_FOLDER%
echo.

REM Check if source folder exists
if not exist "%SOURCE_FOLDER%" (
    echo ERROR: Source folder not found!
    echo Expected: %SOURCE_FOLDER%
    echo.
    echo Please check that the tracks folder exists in the parent directory.
    echo.
    goto :end
)

REM Check if destination folder exists
if not exist "%DEST_FOLDER%" (
    echo ERROR: Destination folder not found!
    echo Expected: %DEST_FOLDER%
    echo.
    echo Please make sure MRSIM is installed and the Tracks folder exists.
    echo.
    goto :end
)

echo Destination folder: %DEST_FOLDER%
echo.
echo Copying XML files...
echo.

REM Copy XML files
set COUNT=0
set OVERWRITTEN=0

for %%f in ("%SOURCE_FOLDER%\*.xml") do (
    set "FILENAME=%%~nxf"
    set "FILEPATH=%%f"
    if exist "%DEST_FOLDER%\!FILENAME!" (
        echo   Overwriting !FILENAME! (already exists)
        copy /Y "!FILEPATH!" "%DEST_FOLDER%\" >nul 2>&1
        set "COPY_RESULT=!errorlevel!"
        if !COPY_RESULT! equ 0 (
            set /a OVERWRITTEN+=1
        )
        if !COPY_RESULT! neq 0 (
            echo   ERROR overwriting !FILENAME!
            copy /Y "!FILEPATH!" "%DEST_FOLDER%\" 
        )
    )
    if not exist "%DEST_FOLDER%\!FILENAME!" (
        copy "!FILEPATH!" "%DEST_FOLDER%\" >nul 2>&1
        set "COPY_RESULT=!errorlevel!"
        if !COPY_RESULT! equ 0 (
            echo   Copied !FILENAME!
            set /a COUNT+=1
        )
        if !COPY_RESULT! neq 0 (
            echo   ERROR copying !FILENAME!
            echo   Showing copy command output:
            copy "!FILEPATH!" "%DEST_FOLDER%\"
        )
    )
)

echo.
echo ========================================
echo Done!
echo Copied: !COUNT! file(s)
echo Overwritten: !OVERWRITTEN! file(s)
echo ========================================
echo.
echo Tracks are now available at:
echo %DEST_FOLDER%
echo.

:end
echo.
echo Press any key to close this window...
pause
exit /b 0

