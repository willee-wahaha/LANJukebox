# LANJukebox
A personal music player built with Python Flask and Vite + TypeScript.

The application runs on a computer and provides a web-based interface for playing music.

You can contol the player from other devices over local network!

## Requirements

- Python 3.14+
- Node.js 24
- FFmpeg

## Install & Usage

- Install python packages
  ```
  pip install -r requirements.txt
  ```

- Install npm dependecies
  ```
  cd frontend
  npm install
  ```

- Web page

  ```
  # For build static page.
  npm run build

  # For develop
  npm run dev
  ```

- Run
  ```
  python app.py
  ```
  or
  ```
  waitress-serve --host=0.0.0.0 --port=5000 --call app:create_app
  ```

- Access by URL

  http://localhost:5000

  If you are using `npm run dev`, the vite server is at http://localhost:5173

  Replace `localhost` with ip address when using other devices.

On Windows, you can simply run by these scripts.
```
# install dependecies
./install.ps1

# run server
./run.ps1 
```

## Set .env
  A `.env` file will be created if program can't find it.
  
  Leave the variables blank will use the following default values.
  - `PORT`: `5000`
  - `MUSIC_DIR`

    The default folder is current folder.
  
    Use `?` to split different folder.
    e.g. `MUSIC_DIR=D:/music1?D:/music2`

  - `DATA_STORE_DIR`: `./Data`
  - `COOKIE_PAT`: `./Data/coockie`
  - `FFMPEG_PATH`: `ffmpeg`

    If ffmpeg is in your PATH, you can also leave this blank.

## Acknowledgements

- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [mutagen](https://github.com/quodlibet/mutagen)
- [thefuzz](https://github.com/seatgeek/thefuzz)
- [FFmpeg](https://ffmpeg.org/)
- [Flask](https://flask.palletsprojects.com/)
- [Vite](https://vite.dev/)
- [sounddevice](https://python-sounddevice.readthedocs.io/)
