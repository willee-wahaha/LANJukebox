import logging

from flask import Blueprint, jsonify, send_from_directory, abort

import config
from tools import music, utils

albums_bp = Blueprint("albums", __name__, url_prefix="/api")


@albums_bp.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "message": "Music server is running"
    })


@albums_bp.route("/albums", methods=["GET"])
def get_all_albums():

    albums = []

    for album_id, songs in music.albums_to_songs.items():

        if not songs:
            continue

        albums.append({
            "id": album_id,
            "name": music.id_to_albums[album_id]["name"],
            "albumartist": music.songs[songs[0]]["albumartist"],
            "song_count": len(songs),
            "year": music.songs[songs[0]]["year"],
            "cover": music.songs[songs[0]]["thumbnail"]
        })

    return jsonify(albums)


@albums_bp.route("/albums/<path:album_id>/songs", methods=["GET"])
def get_songs(album_id):

    if album_id not in music.id_to_albums.keys():
        abort(404)

    songs = []
    for s in music.albums_to_songs[album_id]:
        song = music.songs[s]
        songs.append({
            "id": song["id"],
            "title": song["title"],
            "artist": song["artist"],
            "album": song["album"],
            "album_id": album_id,
            "tracknumber": song["tracknumber"],
            "discnumber": song["discnumber"],
            "duration": song["duration"],
            "cover": song["thumbnail"]
        })

    return jsonify(songs)


@albums_bp.route("/covers/<path:album_id>", methods=["GET"])
def get_cover(album_id):

    album = music.id_to_albums.get(album_id, None)
    if album is None:
        abort(404)

    album_name = music.id_to_albums[album_id]["name"]
    albumartist = music.id_to_albums[album_id]["albumartist"]

    inp = f"{utils.remove_invalid_chars(album_name + albumartist)}.jpg"
    cover_path = (config.DATA_STORE_DIR / '.thumbnail')

    if album_name is None or not (cover_path / inp).exists():
        abort(404)

    return send_from_directory(
        cover_path,
        inp
    )