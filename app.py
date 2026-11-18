import logging

from flask import Flask

import config
from api import albums, player, playlist, songs, webpage
from tools import music


def create_app() -> Flask:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s %(levelname)s - %(name)s : %(message)s'
    )

    main_logger = logging.getLogger('main')

    app = Flask(
        __name__,
        static_folder="./frontend/dist/assets",
        static_url_path="/assets"
    )

    # 註冊 API
    app.register_blueprint(albums.albums_bp)
    app.register_blueprint(player.player_bp)
    app.register_blueprint(playlist.playlist_bp)
    app.register_blueprint(songs.songs_bp)
    app.register_blueprint(webpage.page_bp)

    for p in config.MUSIC_DIR:
        main_logger.info(f"Music Folder: {str(p)}")
        main_logger.info(f"Exist? {p.exists()}")

    main_logger.info(f"Data Store Folder: {str(config.DATA_STORE_DIR)}")
    main_logger.info(f"Exist? {config.DATA_STORE_DIR.exists()}")
    if not config.DATA_STORE_DIR.exists():
        main_logger.info(f"Create Folder: {str(config.DATA_STORE_DIR)}...")
        config.DATA_STORE_DIR.mkdir()

    music.build_music_list()
    
    main_logger.info(f"URL: http://127.0.0.1:{config.PORT}")

    return app


if __name__ == "__main__":
    app = create_app()

    app.run(
        host="0.0.0.0",
        port=config.PORT,
        debug=False,
    )
