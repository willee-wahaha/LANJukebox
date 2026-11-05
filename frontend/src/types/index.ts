export interface Album {
  id: string;
  name: string;
  albumartist: string;
  year?: number | null;
  song_count: number;
  cover?: string | null;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  album_id?: string;
  tracknumber: number;
  discnumber?: number;
  duration: number;
  cover?: string | null;
}

export type PlayerState = 'playing' | 'paused' | 'stopped';

export interface CurrentSong {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover?: string | null;
}

export type RepeatMode = 'off' | 'one' | 'all';

export interface PlayerMode {
  shuffle: boolean;
  repeat: RepeatMode;
}

export interface AudioDevice {
  id: string;
  name: string;
  is_default?: boolean;
}

export interface PlayerStatus {
  state: PlayerState;
  current_song: CurrentSong | null;
  position: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  output_device?: { id: string; name: string } | null;
}

export interface PlaylistResponse {
  current_index: number;
  songs: Song[];
}

export interface ApiError {
  error?: string;
  message?: string;
}
