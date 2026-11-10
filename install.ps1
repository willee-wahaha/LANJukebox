python -m venv venv
.\venv\Scripts\Activate.ps1

pip install -r requirements.txt

cd frontend
npm install

npm run build

cd ..

Write-Host "Done"