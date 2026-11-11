import json
from pathlib import Path

import config

def path_fix(filename: str | Path, under_folder: bool) -> str:
    """
    Set `under_folder` to `True` to add `DATA_STORE_DIR` to path.
    """
    if under_folder:
        return str(config.DATA_STORE_DIR / filename)
    else:
        return filename


def json_file_read(filename: str | Path, under_folder: bool = True) -> dict:

    if not Path(path_fix(filename, under_folder)).exists():
        return {}

    with open(path_fix(filename, under_folder), 'r', encoding="utf-8") as file:
        my_dict = json.load(file)

    return my_dict


def json_file_write(filename: str | Path, data: dict, indent: int = -1, under_folder: bool = True):
    with open(path_fix(filename, under_folder), 'w', encoding="utf-8") as file:
        if indent >= 0:
            json.dump(data, file, ensure_ascii=False, indent=indent)
        else:
            json.dump(data, file, ensure_ascii=False)