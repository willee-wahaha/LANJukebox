# LANJukebox

## Requirements

- Python 3.14+
- Node.js 24
- FFmpeg

Set `FFMPEG_PATH` in `.env` if your ffmpeg is not in global path.

## Run

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

On Windows, you can run by these scripts.
```
# install dependecies
./install.ps1

# run server
./run.ps1 
```

## Acknowledgements

- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [mutagen](https://github.com/quodlibet/mutagen)
- [thefuzz](https://github.com/seatgeek/thefuzz)
- [FFmpeg](https://ffmpeg.org/)
- [Flask](https://flask.palletsprojects.com/)
- [Vite](https://vite.dev/)
- [sounddevice](https://python-sounddevice.readthedocs.io/)
