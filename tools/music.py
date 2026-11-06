import logging
import re
from pathlib import Path

import mutagen
import yt_dlp
from mutagen.id3 import ID3
from thefuzz import fuzz

import config
from classes.song import Song
from tools import rw_file, utils

main_logger = logging.getLogger('main')


albums_to_songs: dict[str, list[dict[str, str]]] = {}
"""{
    "album id": [
        'song id',
        ...
    ],
    ...
}"""

id_to_albums: dict[dict[str, str]] = {}
"""{
    "album id": {'album name', 'albumartist'}
    ...
}"""

songs: dict[str, dict[str, str | int]] = {}
"""{
    "id": {'id', 'title', 'file path', 'album', 'albumartist', 'artist', 'discnumber', 'tracknumber', 'duration', 'year'},
    ...
}"""

def get_album_id(album: str, albumartist: str) -> str | None:
    data = {
        'name': album,
        'albumartist': albumartist
    }

    if album == "Unknown":
        data['albumartist'] = "Unknown"

    if data not in id_to_albums.values():
        return None
    else:
        return list(id_to_albums.keys())[list(id_to_albums.values()).index(data)]


def build_music_list(reload: bool = False):
    global albums_to_songs, id_to_albums, songs

    main_logger.info("Read music index...")

    albums_to_songs.clear()
    songs.clear()
    id_to_albums.clear()

    if not reload:
        albums_to_songs = rw_file.json_file_read('albums_to_songs.json')
        songs = rw_file.json_file_read('songs.json')
        id_to_albums = rw_file.json_file_read('id_to_albums.json')
        if len(albums_to_songs) > 0 and len(songs) > 0 and len(id_to_albums) > 0:
            return

    main_logger.info("Music index not exist, start rebuilding...")

    music_folder = config.MUSIC_DIR
    musics = [
        f for f in list(Path(music_folder).glob('**/*.*'))
        if f.is_file() and f.suffix in config.SUPPORTED_EXTENSIONS
    ]

    scan_music(musics)

    for album in id_to_albums.keys():
        # key: 1. discnumber -> 2. tracknumber
        albums_to_songs[album] = sorted(
            albums_to_songs[album],
            key=lambda x: (songs[x]['discnumber'], songs[x]['tracknumber'])
        )

    rw_file.json_file_write('albums_to_songs.json', albums_to_songs)
    rw_file.json_file_write('songs.json', songs)
    rw_file.json_file_write('id_to_albums.json', id_to_albums)


def scan_music(musics: list[Path]):
    """
    Scan input files' tags.
    """

    main_logger.info("Scan musics...")

    count = 0

    for f in musics:
        try:
            audio = mutagen.File(f, easy=True)
        except:
            audio = None

        if audio is None:
            continue

        album = audio.get("album", ["Unknown"])[0]

        title = audio.get("title", [f.stem])[0]

        album_artist = audio.get("albumartist", ["Unknown"])[0]
        artist = audio.get("artist", ["Unknown"])[0]

        year = audio.get("year", ["Unknown"])[0]
        if year == "Unknown":
            year = audio.get("date", ["Unknown"])[0]
            if year != "Unknown":
                year = year.split('-')[0]


        disknum = utils.int_check(re.sub(r"\D", "", audio.get("discnumber", ["0"])[0]), 0)
        tracknum = utils.int_check(re.sub(r"\D", "", audio.get("tracknumber", ["0"])[0]), 0)

        duration = int(audio.info.length)

        albumid = get_album_id(album, album_artist)
        if albumid is None:
            albumid = f"{len(id_to_albums):09}"
            id_to_albums[albumid] = {
                'name': album,
                'albumartist': album_artist
            }

            albums_to_songs[albumid] = []

        song_id = f"{count:09}"
        count += 1

        song = {
            'id': song_id,
            'title': title,
            'file path': str(f),
            'album': album,
            'albumid': albumid,
            'albumartist': album_artist,
            'artist': artist,
            'discnumber': disknum,
            'tracknumber': tracknum,
            'duration': duration,
            'year': year,
            'thumbnail': None
        }

        albums_to_songs[albumid].append(song_id)
        songs[song_id] = song

        if album == "Unknown":
            continue

        image_path = (config.DATA_STORE_DIR / '.thumbnail' / f'{utils.remove_invalid_chars(album + album_artist)}.jpg')

        if not (config.DATA_STORE_DIR / '.thumbnail').exists():
                (config.DATA_STORE_DIR / '.thumbnail').mkdir()

        has_thumb = False
        if image_path.exists():
            has_thumb = True
        # For FLAC files (FLAC tags)
        elif isinstance(audio, mutagen.flac.FLAC):
            if audio.pictures:
                thumbnail = str(image_path)
                # Save the album art
                with open(thumbnail, "wb") as img_file:
                    img_file.write(audio.pictures[0].data)

                has_thumb = True
        # For MP3 files (ID3 tags)
        elif audio.tags is not None:
            tags = ID3(f)
            if tags.get("APIC:") is not None:
                thumbnail = str(image_path)
                with open(thumbnail, "wb") as img_file:
                    img_file.write(tags.get("APIC:").data)

                has_thumb = True

        if has_thumb:
            songs[song_id]['thumbnail'] = f"/api/covers/{albumid}"


def search(inp: str) -> list[dict]:
    """
    Search Songs by title and artists.
    Return a list of Song.
    """
    results = []

    if len(inp) <= 0:
        return results
    
    for song in songs.values():
        ok = (
            fuzz.partial_token_sort_ratio(inp, song["artist"]) >= 90 or
            fuzz.partial_token_sort_ratio(inp, song["title"]) >= 90
        )

        if ok:
            results.append({
            "id": song["id"],
            "title": song["title"],
            "artist": song["artist"],
            "album": song["album"],
            "album_id": song["albumid"],
            "tracknumber": song["tracknumber"],
            "discnumber": song["discnumber"],
            "duration": song["duration"]
        })

    return results


def search_youtube(inp: str) -> Song | None:
    """
    search title or url from Youtube.
    Return `None` if not found.
    """
    regex = re.compile(
        "http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*(),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+")

    if re.search(regex, inp):
        result = regex.search(inp)
        url = result.group(0)

        if not ("https://www.youtu" in url or "https://youtu.be" in url):
            return None
        
        if "playlist?list=" in url:
            return None
    else:

        options = {
            'format': 'bestaudio/best',
            'default_search': 'auto',
            'noplaylist': True,
            "cookiefile": config.COOKIE_PATH
        }

        with yt_dlp.YoutubeDL(options) as ydl:
            r = ydl.extract_info(inp, download=False)

        if r is None:
            return None

        videocode = r['entries'][0]['id']
        url = f"https://www.youtube.com/watch?v={videocode}"

    options = {
        'format': 'bestaudio',
        'title': True,
        "cookiefile": config.COOKIE_PATH
    }

    with yt_dlp.YoutubeDL(options) as ydl:
        r = ydl.extract_info(url, download=False)
    if r is None:
        return None

    base_url = r.get('url', None)
    duration = r.get('duration', None)

    return utils.song_dict2class({
        'id': "yt",
        'title': r.get('title', "Unknown"),
        'file path': base_url,
        'album': "Unknown",
        'albumid': "Unknown",
        'albumartist': "Unknown",
        'artist': r.get('uploader', "Unkown"),
        'discnumber': "Unkown",
        'tracknumber': "Unkown",
        'duration': duration,
        'year': "Unkown",
        'thumbnail': r.get('thumbnails', [{'url': None}])[0]['url']
    })
