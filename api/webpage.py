import logging
from flask import Blueprint, send_from_directory

main_logger = logging.getLogger('main')

page_bp = Blueprint("page", __name__, url_prefix="/")


@page_bp.route("/")
def index():
    return send_from_directory(
        "./frontend/dist",
        "index.html"
    )

@page_bp.route("/placeholder.svg")
def placeholder():
    return send_from_directory(
        "./frontend/dist",
        "placeholder.svg"
    )

