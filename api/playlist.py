import logging

from flask import Blueprint, jsonify, request

from tools import music, utils
from tools.player import player
from tools.playqueue import playqueue
from tools.playcontroller import playcontroller, Task

player_logger = logging.getLogger('player')

playlist_bp = Blueprint("playlist", __name__, url_prefix="/api/playlist")


@playlist_bp.route("", methods=["GET"])
def get():
    playlist = []
    pos, songs = playqueue.get_playlist()
    for song in songs:
        playlist.append({
            "id": song.id,
            "title": song.title,
            "artist": song.artist,
            "album": song.album,
            "album_id": song.album,
            "tracknumber": song.tracknumber,
            "discnumber": song.discnumber,
            "duration": song.duration,
            "cover": song.thumbnail
        })

    return jsonify({
        "current_index": pos,
        "songs": playlist
    })


@playlist_bp.route("", methods=["POST"])
def add():
    data = request.get_json()

    if not data or "song_id" not in data or data["song_id"] not in music.songs:
        return jsonify({"error": "Song Not Exists"}), 400

    player_logger.info(f"Add Song to Queue, id = {data["song_id"]}")

    song = utils.song_dict2class(music.songs[data["song_id"]])

    playcontroller.put_task([Task(playqueue.add, [song])])

    return jsonify({"status": "add success"})


@playlist_bp.route("/play", methods=["POST"])
def play():
    playcontroller.put_task([
        Task(player.stop),
        Task(playqueue.move_pos, [-1]),
        Task(player.next)
    ])

    return jsonify({"status": "play"})


@playlist_bp.route("/play/<index>", methods=["POST"])
def playfrom(index):
    i = utils.int_check(index)
    
    if i is None or i >= len(playqueue) or i < 0:
        return jsonify({"error": "index must be int in range"}), 400

    playcontroller.put_task([
        Task(playqueue.set_index, [i]),
        Task(player.replay)
    ])

    return jsonify({"status": "play"})


@playlist_bp.route("", methods=["DELETE"])
def clear():
    playcontroller.put_task([
        Task(playqueue.clear),
        Task(player.stop)
    ])

    return jsonify({"status": "delete"})


@playlist_bp.route("/<index>", methods=["DELETE"])
def delete(index):
    i = utils.int_check(index)
    if i is None:
        return jsonify({"error": "index must be int"}), 400

    playcontroller.put_task([Task(playqueue.delete, [i])])

    return jsonify({"status": "delete"})
