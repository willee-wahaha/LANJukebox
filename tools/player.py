import ctypes
import logging
import subprocess
import threading

import numpy as np
import sounddevice as sd

from classes.song import Song
from tools.playqueue import playqueue

player_logger = logging.getLogger('player')

devices = {}
def get_devices():
    devices.clear()
    all_devices = sd.query_devices()
    for api in sd.query_hostapis():
        devices.update({
            f"{all_devices[d]["index"]}" : {
                "name": f"{api["name"]}: {all_devices[d]["name"]}",
                "is_default": all_devices[d]["index"] == api["default_output_device"],
                "default_samplerate": all_devices[d]["default_samplerate"],
                "max_output_channels": all_devices[d]["max_output_channels"],
                "api": api["name"]
            } 
            for d in api["devices"] if all_devices[d]["max_input_channels"] == 0
        })
get_devices()

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

        self.process = None

    def start(self, file_path: str):

        if file_path in self.cache_name:
            self.cache_hit_index = self.cache_name.index(file_path)
            return

        command = [
            "ffmpeg",
            "-nostdin",
            "-v", "error",
            "-i", file_path,

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

        self.cache_name.append(file_path)

    def readall(self, frames: int) -> list[np.ndarray]:
        """
        Read bytes from ffmpeg.
        Every unit in list represent a frame
        """

        if self.cache_hit_index is not None:
            datas = self.cache_data[self.cache_hit_index]
            self.cache_hit_index = None
            return datas

        if self.process is None:
            return b""

        byte_count = frames * self.channels * 4

        chunk = self.process.stdout.read()
        data = bytearray(chunk)
        datas = [
            np.frombuffer(data[i:i+byte_count], dtype=np.float32).reshape(-1, self.channels)
            for i in range(0, len(data), byte_count)
        ]
        self.close()

        
        self.cache_data.append(datas)
        if len(self.cache_name) > self.cache_size:
            self.cache_name.pop(0) 
            self.cache_data.pop(0) 

        return datas

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


class AudioPlayer:

    def __init__(
        self,
        device: int,
        sample_rate: int = 44100,
        channels: int = 2,
        frame: int = 4096
    ):

        self.device = device
        self.sample_rate = sample_rate
        self.channels = channels
        self.frame = frame

        self.decoder = AudioDecoder(
            sample_rate,
            channels
        )

        self.audio_queue = None
        self.reset_queue()

        # Play position, a.k.a. index of audio_queue
        self.position = 0

        self.volume = 1.0

        self.paused = False
        self.running = False
        self.eof = False

        self.lock = threading.Lock()
        self.song_finished = threading.Event()

        self.manager = threading.Thread(
            target=self.playback_manager,
            daemon=True
        )
        self.manager.start()

        self.stream = None
        self.decode_thread = None

        self.init_count = 0

    def reset_queue(self):
        self.audio_queue = None

    # -------------------------
    # Decode
    # -------------------------
    def decode_once(self):
        self.audio_queue = self.decoder.readall(self.frame)

    # -------------------------
    # Play Callback
    # -------------------------

    def callback(
        self,
        outdata,
        frames,
        time,
        status
    ):

        if status:
            print(status)

        outdata.fill(0)

        with self.lock:
            if self.paused:
                return

        written = 0

        while written < frames:

            with self.lock:
                pos = self.position

            if self.audio_queue is None or pos >= len(self.audio_queue):
                break
            chunk = self.audio_queue[pos]

            remaining = frames - written

            count = min(
                remaining,
                len(chunk)
            )

            with self.lock:
                volume = self.volume
                self.position += 1

            outdata[
                written:written + count
            ] = chunk[:count] * volume

            written += count
                

        if self.audio_queue is None or self.position >= len(self.audio_queue):
            self.song_finished.set()
            with self.lock:
                self.running = False
            raise sd.CallbackStop()

    # -------------------------
    # Player Controls
    # -------------------------
    def reset_player(self):
        self.position = 0
        self.running = False
        self.paused = False
        self.eof = False
        self.reset_queue()

        self.song_finished.clear()

    def _play_file(self, song: Song):

        with self.lock:
            if self.running:
                return

            self.reset_player()
            self.running = True

        file_path = song.file_path

        self.decoder.start(file_path)
        self.decode_once()

        player_logger.info(f"Playing Song, id = {song.id}")

        rc = ctypes.windll.ole32.CoInitialize(None)

        self.stream = sd.OutputStream(
            samplerate=self.sample_rate,
            channels=self.channels,
            dtype="float32",
            blocksize=self.frame,
            device=self.device,
            callback=self.callback,
        )
        self.stream.start()

        if rc in (0, 1):
            ctypes.windll.ole32.CoUninitialize()

    def play(self, song: Song):
        playqueue.add(song)

        player_logger.info(f"Order Song, id = {song.id}")

        with self.lock:
            if self.running:
                return

        self.play_next()

    def play_next(self, prev: bool = False):

        if prev:
            next_song = playqueue.prev()
        else:
            next_song = playqueue.next()

        if next_song is None:
            self.stop()
            return

        self._play_file(next_song)

    def pause(self):
        with self.lock:
            self.paused = True

    def resume(self):
        with self.lock:
            self.paused = False

    def set_volume(self, volume: int) -> int:
        vol = max(
            0,
            min(100, volume)
        )

        self.volume = float(vol) / 100

        return self.get_volume()

    def get_volume(self) -> int:
        return int(100 * self.volume)

    def get_position(self) -> float:
        """
        Return value represent `Second`
        """
        return self.position * self.frame / self.sample_rate

    def stop(self):
        with self.lock:
            if self.stream:

                self.stream.stop()
                self.stream.close()

                self.stream = None

            if self.decode_thread:
                self.decode_thread.join(timeout=2)

                self.decode_thread = None

            self.decoder.close()

            self.reset_player()

    def next(self):
        player_logger.info("Next")

        self.stop()
        self.play_next()

    def prev(self):
        player_logger.info("Previous")

        if self.get_position() > 3:
            self.seek(0)
        else:
            self.stop()

            self.play_next(prev=True)

    def replay(self):
        if playqueue.nowplay is None:
            return
        self.stop()
        self._play_file(playqueue.nowplay)

    def seek(self, sec: int):
        with self.lock:
            self.position = int(sec * self.sample_rate / self.frame)

    def get_devices(self) -> dict[str, str | list]:
        get_devices()
        outputd = [
            { "id": id, "name": info["name"], "is_default": info["is_default"] }
            for id, info in devices.items()
        ]

        return {
            "devices": outputd,
            "selected_device_id": f"{self.device}"
        }

    def set_device(self, index: int) -> bool:
        if str(index) in devices.keys():
            player_logger.info(f"Change Device, id = {index}")
            self.device = index
            pos = self.position
            self.stop()

            self.sample_rate = devices[str(index)]["default_samplerate"]
            self.channels = devices[str(index)]["max_output_channels"]
            self.decoder = AudioDecoder(
                sample_rate=self.sample_rate,
                channels=self.channels
            )

            if playqueue.nowplay is not None:
                self._play_file(playqueue.nowplay)
            self.position = pos
            return True

        return False

    def status(self) -> dict:

        song = {}
        current_song = playqueue.nowplay

        if current_song is None:
            song = {
                "id": None,
                "title": None,
                "artist": None,
                "album": None,
                "cover": None
            }
            duration = 0
        else:
            song = {
                "id": current_song.id,
                "title": current_song.title,
                "artist": current_song.artist,
                "album": current_song.album,
                "cover": current_song.thumbnail
            }
            duration = current_song.duration

        status = {
            "state": "playing",
            "current_song": song,
            "position": self.get_position(),
            "duration": duration,
            "volume": self.volume * 100,
            "shuffle": playqueue.shuffle,
            "repeat": playqueue.repeat,
            "output_device": { "id": f"{self.device}", "name": devices[f"{self.device}"]["name"] }
        }

        if not self.running:
            status['state'] = "stopped"
        if self.paused:
            status['state'] = "paused"

        return status

    def playback_manager(self):
        while True:
            self.song_finished.wait()

            player_logger.info("Music Ends")

            with self.lock:
                self.reset_player()
            self.play_next()

    def close(self):
        self.stop()
        self.manager.join()


player = AudioPlayer(
    device=sd.query_devices(kind="output")['index'],
    sample_rate=sd.query_devices(kind="output")['default_samplerate'],
    channels=sd.query_devices(kind="output")['max_output_channels'],
)
