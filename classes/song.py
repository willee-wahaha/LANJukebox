class Song:
    def __init__(
            self,
            id: str,
            title: str,
            file_path: str,
            album: str,
            albumid: str,
            albumartist: str,
            artist: str,
            discnumber: str,
            tracknumber: str,
            duration: int,
            year: str,
            thumbnail: str | None,
        ):

        self.id = id
        self.title = title
        self.file_path = file_path
        self.album = album
        self.albumid = albumid
        self.albumartist = albumartist
        self.artist = artist
        self.discnumber = discnumber
        self.tracknumber = tracknumber
        self.duration = duration
        self.year = year
        self.thumbnail = thumbnail