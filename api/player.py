import logging
from flask import Blueprint, jsonify, request

from tools import music, utils
from tools.player import player, devices
from tools.playqueue import playqueue
from tools.playcontroller import playcontroller, Task

player_logger = logging.getLogger('player')

player_bp = Blueprint("player", __name__, url_prefix="/api/player")


@player_bp.route("/play", methods=["POST"])
def play():
    data = request.get_json()

    if not data or "song_id" not in data or data["song_id"] not in music.songs.keys():
        return jsonify({"error": "Song Not Exists"}), 400

    song = utils.song_dict2class(music.songs[data["song_id"]])

    tasks = [
        Task(player.stop),
        Task(playqueue.clear),
        Task(player.play, [song])
    ]
    playcontroller.put_task(tasks)

    return jsonify({"status": "playing"})


@player_bp.route("/pause", methods=["POST"])
def pause():
    playcontroller.put_task([Task(player.pause)])
    return jsonify({"status": "paused"})


@player_bp.route("/resume", methods=["POST"])
def resume():
    playcontroller.put_task([Task(player.resume)])
    return jsonify({"status": "playing"})


@player_bp.route("/stop", methods=["POST"])
def stop():
    playcontroller.put_task([Task(player.stop)])
    return jsonify({"status": "stopped"})


@player_bp.route("/next", methods=["POST"])
def next_song():
    playcontroller.put_task([Task(player.next)])
    return jsonify({"status": "next"})


@player_bp.route("/previous", methods=["POST"])
def previous_song():
    playcontroller.put_task([Task(player.prev)])
    return jsonify({"status": "previous"})


@player_bp.route("/volume", methods=["PUT"])
def volume():
    data = request.get_json()
    vol = player.get_volume()

    if data is None:
        return jsonify({ "success": False, "volume": vol })
    
    vol = utils.int_check(data.get("volume", vol))
    if vol is None:
        return jsonify({ "success": False, "volume": player.get_volume() })

    playcontroller.put_task([Task(player.set_volume, [vol])])

    return jsonify({ "success": True, "volume": vol })


@player_bp.route("/seek", methods=["PUT"])
def seek():
    data = request.get_json()
    pos = player.get_position()
    dur = playqueue.nowplay.duration

    if data is None:
        return jsonify({ "success": False, "position": pos, "duration": dur })
    
    pos = utils.int_check(data.get("position", pos))
    if pos is None or pos <= 0 or pos > dur:
        return jsonify({ "success": False, "position": player.get_position(), "duration": dur })

    playcontroller.put_task([Task(player.seek, [pos])])

    return jsonify({ "success": True, "position": player.get_position(), "duration": dur })


@player_bp.route("/devices", methods=["GET"])
def get_device():
    return player.get_devices()


@player_bp.route("/device/<index>", methods=["PUT"])
def set_device(index):    
    device_id = utils.int_check(index)
    if device_id is None:
        return jsonify({
            "success": False,
            "selected_device_id": f"{player.device}",
            "selected_device_name": devices[player.device]["name"]
        })

    playcontroller.put_task([Task(player.set_device, [device_id])])

    return jsonify({
        "success": True,
        "selected_device_id": f"{player.device}",
        "selected_device_name": devices[f"{player.device}"]["name"]
    })


@player_bp.route("/mode", methods=["PUT"])
def set_mode():
    data = request.get_json()
    
    if data is None:
        return jsonify({
            "success": False,
            "shuffle": playqueue.shuffle,
            "repeat": playqueue.repeat
        })
    
    repeat = data.get("repeat", None)
    shuf = data.get("shuffle", None)
    if repeat is None or shuf is None:
        return jsonify({
            "success": False,
            "shuffle": playqueue.shuffle,
            "repeat": playqueue.repeat
        })

    playcontroller.put_task([
        Task(playqueue.set_repeat, [repeat]),
        Task(playqueue.set_shuffle, [shuf])
    ])
    return jsonify({
        "success": True,
        "shuffle": playqueue.shuffle,
        "repeat": playqueue.repeat
    })


@player_bp.route("/status", methods=["GET"])
def status():
    return jsonify(player.status())