# Frontend

This file is a list of apis that server provide.
You can write yuor own frontend by this document.

Types are describe in `./src/types/index.ts`.

## Common
- GET `/`

  This is Home page.

- GET `/placeholder`

  Return placeholder image file.

- GET `/api/health`
  
  Return
  ```json
  {
      "status": "ok",
      "message": "Music server is running"
  }
  ```
- GET `/api/covers/<path:album_id>`

  Return cover image file.

## Albums

- GET `/api/albums`

  Return `Album[]`
  ```json
  [
    {
      "id": "000000000",
      "name": "XXXX",
      "albumartist": "XXXX",
      "song_count": 10,
      "year": "2026",
      "cover": "/api/covers/000000000"
    }
  ]
  ```

- GET `/api/albums/<path:album_id>/songs`

  Return `Song[]`, duration is in second.
  ```json
  [
    {
      "id": "000000000",
      "title": "XXXX",
      "artist": "XXXX",
      "album": "XXXX",
      "album_id": "000000000",
      "tracknumber": 1,
      "discnumber": 1,
      "duration": 100,
      "cover": "/api/covers/000000000"
    }
  ]
  ```

- POST `/api/albums/refresh`
- POST `/api/albums/order`

  Body:
  ```json
  {
    "key": "year",
    "way": "up"
  }
  ```
  `key`: `'year' | 'name' | 'artist'`, `way`: `'up' | 'down'`

  Return `Album[]`.

## Player
- POST `/api/player/play`

  Body:
  ```json
  { "song_id": "000000000"}
  ```

- POST `/api/player/pause`
- POST `/api/player/resume`
- POST `/api/player/stop`
- POST `/api/player/next`
- POST `/api/player/previous`
- PUT `/api/player/volume`

  Body & Return:
  ```json
  { "volume": 50 }
  ```
  `volume`: int beyween 0~100

- PUT `/api/player/seek`

  Body:
  ```json
  { "position": 10 }
  ```
  Return:
  ```json
  { "position": 10, "duration": 100 }
  ```
  `position`, `duration`: int

- GET `/api/player/devices`

  Return:
  ```json
  [
    { "id": "0", "name": "XXXX", "is_default": true }
  ]
  ```

- PUT `/api/player/device/<index>`

  Return:
  ```json
  {
    "selected_device_id": "0",
    "selected_device_name": "XXXX"
  }
  ```
  `shuffle`: `bool`, `repeat`: `off | one | all`.
- PUT `/api/player/mode`

  Body & Return:
  ```json
  {
    "shuffle": false,
    "repeat": "off"
  }
  ```
  `shuffle`: `bool`, `repeat`: `off | one | all`.

- GET `/api/player/status`
  ```json
  {
    "state": "playing",
    "current_song": {
      "id": "000000000",
      "title": "XXXX",
      "artist": "XXXX",
      "album": "XXXX",
      "cover": "/api/covers/000000000"
    },
    "position": 85,
    "duration": 245,
    "volume": 70,
    "shuffle": false,
    "repeat": "off",
    "output_device": { "id": "0", "name": "XXXX" }
  }
  ```

## Playlist

- GET `/api/playlist`
  ```json
  {
    "current_index": 0,
    "songs": []
  }
  ```
  `songs`: `Song[]`

- POST `/api/playlist`

  Body:
  ```json
  { "song_id": "000000000" }
  ```

- POST `/api/playlist/play`
- DELETE `/api/playlist/{index}`
- DELETE `/api/playlist`

## Songs
Use `?q=XXX`.
- GET `/api/songs/search`

  Return:
  ```json
  { "songs": [] }
  ```
  `songs`: `Song[]`

- GET `/api/songs/searchyoutube`
