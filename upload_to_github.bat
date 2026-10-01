@echo off
echo ==============================================
echo   Uploading HarvestLink AI to GitHub
echo ==============================================
echo.

echo Step 1: Adding all changes...
git add .

echo Step 2: Committing changes...
git commit -m "Update HarvestLink AI project"

echo Step 3: Pushing to https://github.com/pca28234-cloud/AiHAck.git...
git push -u origin main

echo.
if %errorlevel% equ 0 (
    echo SUCCESS! Your code is now on GitHub.
    echo Refresh your browser to see it.
) else (
    echo FAILED! Something went wrong. 
    echo Make sure you log in to GitHub when the window pops up.
)
echo.
pause

