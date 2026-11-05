import logging

from flask import Blueprint, jsonify, request

from tools import music
from tools.playqueue import playqueue
from tools.playcontroller import playcontroller, Task

songs_bp = Blueprint("songs", __name__, url_prefix="/api/songs")


@songs_bp.route("/search", methods=["GET"])
def search():
    query = request.args.get('q', '')
    results = music.search(query)

    return jsonify(results)


@songs_bp.route("/searchyoutube", methods=["GET"])
def search_youtube():
    query = request.args.get('q', '')
    
    song = music.search_youtube(query)
    if song is None:
        return jsonify({"error": "Song Not Exists"}), 400

    playcontroller.put_task([Task(playqueue.add, [song])])

    return jsonify({"status": "add success"})
