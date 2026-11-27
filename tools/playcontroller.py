import ctypes
import queue
import sys
import threading


class Task:
    def __init__(
            self,
            action,
            param: list | None = None
        ):
        self.action = action
        self.param = param
        pass


class PlayController:
    def __init__(self):

        self.taskque = queue.Queue()
        self.newtask_appear = threading.Event()
        self.end_task = threading.Event()
        self.wait_task = False
        self.lock = threading.Lock()

        self.tasker = threading.Thread(
            target=self.exec_task,
            daemon=True
        )
        self.tasker.start()

    def exec_task(self):
        if sys.platform == "win32":
            ctypes.windll.ole32.CoInitialize(None)

        while not self.end_task.is_set():
            try:
                task = self.taskque.get_nowait()
            except queue.Empty:
                with self.lock:
                    self.wait_task = True
                self.newtask_appear.wait()

                self.newtask_appear.clear()
                continue

            for t in task:
                if t.param is None:
                    t.action()
                else:
                    t.action(t.param[0])

        if sys.platform == "win32":
            ctypes.windll.ole32.CoUninitialize()

    def put_task(self, tasks: list[Task]):
        self.taskque.put(tasks)

        if self.wait_task:
            with self.lock:
                self.wait_task = False
            self.newtask_appear.set()

    def clear_queue(self):
        while True:
            try:
                self.taskque.get_nowait()
            except queue.Empty:
                break


playcontroller = PlayController()