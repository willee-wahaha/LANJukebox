import json
from pathlib import Path

from tools import utils

def json_file_read(filename: str | Path, under_folder: bool = True) -> dict:

    if not Path(utils.path_fix(filename, under_folder)).exists():
        return {}

    with open(utils.path_fix(filename, under_folder), 'r', encoding="utf-8") as file:
        my_dict = json.load(file)

    return my_dict


def json_file_write(filename: str | Path, data: dict, indent: int = -1, under_folder: bool = True):
    with open(utils.path_fix(filename, under_folder), 'w', encoding="utf-8") as file:
        if indent >= 0:
            json.dump(data, file, ensure_ascii=False, indent=indent)
        else:
            json.dump(data, file, ensure_ascii=False)