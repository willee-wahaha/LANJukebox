import logging
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

env_logger = logging.getLogger('env')

if not load_dotenv():
    env_logger.warning("Can't read .env!")


def get_env(key: str, default: Any | None = None) -> Any | None:
    val = os.getenv(key)
    if val is None:
        env_logger.warning(f"Enviroment Variable \"{key}\" not exists!")
        return default

    return val


PORT = int(get_env("PORT"))
MUSIC_DIR = Path(get_env("MUSIC_DIR"))
SUPPORTED_EXTENSIONS = (".mp3", ".flac", ".wav", ".m4a", ".aac", ".ogg", ".wma")
DATA_STORE_DIR = Path(get_env("DATA_STORE_DIR"))
COOKIE_PATH = Path(get_env("COOKIE_PATH"))
FFMPEG_PATH = get_env("FFMPEG_PATH", "ffmpeg")


if __name__ == '__main__':
    x = get_env("AUDIO_ENSIONS")
    print(x)