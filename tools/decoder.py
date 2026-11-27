import logging
import subprocess
import threading

import numpy as np

import config

class AudioDecoder:

    def __init__(
            self,
            sample_rate: int = 44100,
            channels: int = 2,
            cache_size: int = 5
        ):
        self.sample_rate = sample_rate
        self.channels = channels

        self.cache_name = []
        self.cache_data = []
        self.cache_hit_index = None
        self.cache_size = cache_size

        self.file_path = None

        self.process = None

    def start(self, file_path: str, start_time: int = 0):

        if file_path in self.cache_name:
            self.cache_hit_index = self.cache_name.index(file_path)
            return

        command = [
            config.FFMPEG_PATH,
            "-nostdin",
            "-v", "error",
            "-i", file_path,

            "-ss", str(start_time),

            "-f", "f32le",
            "-acodec", "pcm_f32le",

            "-ac", str(self.channels),
            "-ar", str(self.sample_rate),
            "pipe:1"
        ]

        self.process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            bufsize=0
        )

        self.file_path = file_path

    def read(self, frames: int) -> np.ndarray | None:
        """
        Read bytes from ffmpeg.
        Every unit in list represent a frame
        """

        if self.process is None:
            return None

        byte_count = (
            frames *
            self.channels *
            4
        )

        data = bytearray()

        while len(data) < byte_count:

            chunk = self.process.stdout.read(
                byte_count - len(data)
            )

            if not chunk:
                break

            data.extend(chunk)

        if len(data) == 0:
            return None

        op_data = np.frombuffer(data, dtype=np.float32).reshape(-1, self.channels)
        return op_data

    def get_cache(self) -> list[np.ndarray] | None:
        if self.cache_hit_index is None:
            return None

        datas = self.cache_data[self.cache_hit_index]
        self.cache_hit_index = None

        return datas

    def put_cache(self, datas: list):
        self.cache_name.append(self.file_path)
        self.cache_data.append(datas)
        if len(self.cache_name) > self.cache_size:
            self.cache_name.pop(0)
            self.cache_data.pop(0)

    def close(self):
        """
        Close ffmpeg subprcess.
        """

        if self.process is None:
            return

        if self.process.poll() is None:
            self.process.terminate()

        self.process.wait()

        if self.process is not None and self.process.stdout is not None:
            self.process.stdout.close()

        self.process = None
        self.file_path = None
        self.cache_hit_index = None
