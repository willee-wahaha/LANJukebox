import logging
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

env_logger = logging.getLogger('env')

if not load_dotenv():
    env_logger.warning("沒讀取到環境變數!")


def get_env(key: str) -> Any | None:
    val = os.getenv(key)
    if val is None:
        env_logger.warning(f"環境變數 \"{key}\" 不存在!")

    return val


PORT = int(get_env("PORT"))
MUSIC_DIR = Path(get_env("MUSIC_DIR"))
SUPPORTED_EXTENSIONS = (".mp3", ".flac", ".wav", ".m4a", ".aac", ".ogg", ".wma")
DATA_STORE_DIR = Path(get_env("DATA_STORE_DIR"))
COOKIE_PATH = Path(get_env("COOKIE_PATH"))


if __name__ == '__main__':
    x = get_env("AUDIO_ENSIONS")
    print(x)