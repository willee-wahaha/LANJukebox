import re
from pathlib import Path
from typing import Any

import config
from classes.song import Song


def path_fix(filename: str | Path, under_folder: bool) -> str:
    """
    Set `under_folder` to `True` to add `DATA_STORE_DIR` to path.
    """
    if under_folder:
        return str(config.DATA_STORE_DIR / filename)
    else:
        return filename


def remove_invalid_chars(inp: str) -> str:
    """
    Remove invalid char from string.
    """
    invalid_chars = r'[<>:"/\\|?*]'
    
    return re.sub(invalid_chars, '', inp)


def song_dict2class(s_dict: dict) -> Song:
    return Song(
        id = s_dict["id"],
        title = s_dict["title"],
        file_path = s_dict["file path"],
        album = s_dict["album"],
        albumid = s_dict["albumid"],
        albumartist = s_dict["albumartist"],
        artist = s_dict["artist"],
        discnumber = s_dict["discnumber"],
        tracknumber = s_dict["tracknumber"],
        duration = s_dict["duration"],
        year = s_dict["year"],
        thumbnail = s_dict["thumbnail"],
    )


def song_class2dict(s_class: Song) -> dict:
    return {
        'id': s_class.id,
        'title': s_class.title,
        'file path': s_class.file_path,
        'album': s_class.album,
        'albumid': s_class.albumid,
        'albumartist': s_class.albumartist,
        'artist': s_class.artist,
        'discnumber': s_class.discnumber,
        'tracknumber': s_class.tracknumber,
        'duration': s_class.duration,
        'year': s_class.year,
        'thumbnail': s_class.thumbnail
    }


def int_check(
        inp: Any,
        default: int | None = None
    ) -> int | None:
    try:
        i = int(inp)
    except:
        i = default

    return i
    
