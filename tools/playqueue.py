import random
from datetime import datetime
import threading

from tools.song import Song

class PlayQueue:
    def __init__(self):
        self.playque = []
        self.pos = -1

        # "off" | "one" | "all"
        self.repeat = "off"
        self.shuffle = False
        self.shuf_map = []

        self.nowplay: Song | None = None
        self.lock = threading.Lock()

    def __len__(self):
        return len(self.playque)

    def add(self, song: Song):
        self.playque.append(song)

    def get_pos(self) -> int:
        if self.shuffle:
            return self.shuf_map[self.pos]
        else:
            return self.pos

    def next(self) -> Song | None:
        if self.pos < len(self.playque) and self.repeat != "one":
            self.pos += 1

        if self.pos < len(self.playque):
            self.nowplay = self.playque[self.get_pos()]
        elif self.repeat == "all":
            self.pos = 0
            self.nowplay = self.playque[self.get_pos()]
        else:
            self.nowplay = None

        return self.nowplay

    def prev(self) -> Song | None:
        if self.pos >= 0 and self.repeat != "one":
            self.pos -= 1

        if self.pos >= 0:
            self.nowplay = self.playque[self.get_pos()]
        elif self.repeat == "all":
            self.pos = len(self.playque) - 1
            self.nowplay = self.playque[self.get_pos()]
        else:
            self.nowplay = None

        return self.nowplay

    def set_index(self, index: int) -> Song | None:
        if index >= len(self.playque) or index < 0:
            return None

        self.pos = index
        self.nowplay = self.playque[self.get_pos()]

        return self.nowplay

    def delete(self, index: int) -> bool:
        """
        Return `False` if fail to delete.
        """
        if index >= len(self.playque) or index < 0 or index == self.pos:
            return False

        try:
            if self.pos > index:
                self.pos -= 1
            self.playque.pop(index)
        except:
            return False

        return True

    def get_playlist(self) -> list[Song]:
        with self.lock:
            if self.pos < 0:
                pos = 0
            elif self.pos >= len(self.playque):
                pos = len(self.playque) - 1
            else:
                pos = self.pos

            if self.shuffle:
                pl = [self.playque[self.shuf_map[i]] for i in range(len(self.playque))]
            else:
                pl = self.playque

        return (pos, pl)

    def set_repeat(self, mode: str) -> bool:
        if mode not in ("off", "one", "all"):
            return False

        self.repeat = mode
        return True

    def set_shuffle(self, shuf: bool) -> bool:
        if not isinstance(shuf, bool):
            return False


        if self.shuffle == shuf:
            return True

        self.shuffle = shuf

        if self.shuffle:
            random.seed(datetime.timestamp(datetime.now()))
            self.shuf_map = [i for i in range(len(self.playque))]
            random.shuffle(self.shuf_map)
            if self.pos >= 0 and self.pos < len(self.playque):
                self.pos = self.shuf_map.index(self.pos)
            else:
                self.pos = 0
        else:
            self.pos = self.shuf_map[self.pos]

        return True

    def move_pos(self, p: int):
        self.pos = p

    def clear(self):
        with self.lock:
            self.pos = -1
            self.nowplay = None
            self.playque.clear()


playqueue = PlayQueue()

