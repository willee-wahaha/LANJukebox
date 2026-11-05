.\venv\Scripts\Activate.ps1

get-content .env | foreach {
    $name, $value = $_.split('=')
    set-content env:\$name $value
}

waitress-serve --host=0.0.0.0 --port="$env:PORT" --call app:create_app