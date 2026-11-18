import logging
import os
from pathlib import Path

from dotenv import load_dotenv

env_logger = logging.getLogger('env')

template = """PORT=5000
MUSIC_DIR=
DATA_STORE_DIR=./Data
COOKIE_PATH=./Data/coockie
FFMPEG_PATH=
"""

if not load_dotenv():
    env_logger.warning("Can't read .env!")
    with open('.env', 'w', encoding='utf-8') as f:
        f.write(template)

    env_logger.warning(".env is created from template, please fill the variables.")


def get_env(key: str, default: str | None = None) -> str | None:
    val = os.getenv(key)

    if val is None or val == "":
        env_logger.warning(f"Enviroment Variable \"{key}\" not exists!")
        return default

    return val


PORT = int(get_env("PORT", "5000"))
MUSIC_DIR = [Path(p) for p in get_env("MUSIC_DIR", "").split("?")]
SUPPORTED_EXTENSIONS = (".mp3", ".flac", ".wav", ".m4a", ".aac", ".ogg", ".wma")
DATA_STORE_DIR = Path(get_env("DATA_STORE_DIR", "./Data"))
COOKIE_PATH = Path(get_env("COOKIE_PATH", "./Data/coockie"))
FFMPEG_PATH = get_env("FFMPEG_PATH", "ffmpeg")


if __name__ == '__main__':
    x = get_env("MUSIC_DIR")
    print(x)