$ErrorActionPreference = 'Stop'
$serverPath = Join-Path $env:APP_DIR $env:SERVER_JS
Start-Process -FilePath $env:NODE_EXE -ArgumentList ('"' + $serverPath + '"') -WorkingDirectory $env:APP_DIR -WindowStyle Hidden -RedirectStandardOutput $env:LOG_FILE -RedirectStandardError (Join-Path $env:LOG_DIR 'qisi-server-error.log')