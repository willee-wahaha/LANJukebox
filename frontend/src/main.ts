import './style.css';
import shellTemplate from './templates/shell.html?raw';
import queueTemplate from './templates/queue.html?raw';
import playerTemplate from './templates/player.html?raw';
import homeTemplate from './templates/home.html?raw';
import albumTemplate from './templates/album.html?raw';
import searchTemplate from './templates/search.html?raw';
import albumCardTemplate from './templates/album-card.html?raw';
import songRowTemplate from './templates/song-row.html?raw';
import { fillTemplate } from './utils/template';
import { t, getLang, getLocale, setLocale, translateDOM, type Locale } from './i18n/i18n';
import { getAlbums, getAlbumSongs, refreshDatabase, setAlbumOrder } from './api/albums';
import { searchSongs, searchFromYt } from './api/songs';
import {
  getPlayerStatus, playSong, pausePlayer, resumePlayer, stopPlayer,
  nextSong, previousSong, setPlayerVolume, seekPlayer, setPlayerMode,
  getAudioDevices, setAudioDevice,
} from './api/player';
import {
  getPlaylist, addToPlaylist, playPlaylist, playPlaylistFrom, removeFromPlaylist,
  clearPlaylist,
} from './api/playlist';
import type { 
  Album, Song, PlayerStatus, PlaylistResponse, AudioDevice, RepeatMode ,
  AlbumSortKey, AlbumOrder,
} from './types';
import { Router } from './pages/router';

type View = 'home' | 'album' | 'search';

const app = document.querySelector<HTMLDivElement>('#app')!;
const router = new Router();
const placeholder: string = import.meta.env.DEV ? '/placeholder.svg' : '/placeholder';

let albums: Album[] = [];
let albumOrder: AlbumOrder = { key: 'year', way: 'down'};
let currentView: View = 'home';
let currentAlbum: Album | null = null;
let currentAlbumSongs: Song[] = [];
let playlist: PlaylistResponse = { current_index: -1, songs: [] };
let playerStatus: PlayerStatus = {
  state: 'stopped', current_song: null, position: 0, duration: 0,
  volume: 70, shuffle: false, repeat: 'off',
};
let searchKeyword = '';
let statusTimer: number | undefined;
let queueOpen = false;
let lastPlayerCoverKey = '';
let audioDevices: AudioDevice[] = [];
let seeking = false;

const esc = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const coverUrl = (url?: string | null): string => url || placeholder;
const tpl = fillTemplate;

function renderShell(): void {
  const titleKey = currentView === 'album' ? 'album' : currentView === 'search' ? 'search' : 'library';
  const title = t(`header.${titleKey}`);
  app.innerHTML = tpl(shellTemplate, {
    HOME_ACTIVE: currentView === 'home' ? 'active' : '',
    SEARCH_ACTIVE: currentView === 'search' ? 'active' : '',
    QUEUE_ACTIVE: queueOpen ? 'active' : '',
    TITLE_KEY: titleKey, TITLE: esc(title),
    QUEUE_PANEL: queueOpen ? renderQueuePanel() : '',
    PLAYER_BAR: renderPlayerBar(),
  });
  bindShellEvents();
  translateDOM(app);
  app.querySelector<HTMLSelectElement>('#language-select')?.addEventListener('change', event => {
    setLocale((event.currentTarget as HTMLSelectElement).value as Locale);
    renderShell();
    renderCurrentPage();
  });
}

function renderQueuePanel(): string {
  const items = playlist.songs.length ? 
    playlist.songs.map((song, index) => `
    <div class="queue-row ${index === playlist.current_index ? 'is-current' : ''}">
      <button class="queue-song" data-play-index="${index}">
        <img src="${esc(coverUrl(song.cover))}" alt="">
        <span class="queue-song-info">
          <strong>${esc(song.title)}</strong>
          <small>${esc(song.artist)}</small>
        </span>
      </button>
      <button class="remove-button" data-remove-queue="${index}" aria-label="Remove song">×</button>
    </div>`).join('') : 
    `<div class="empty-state compact">
      <div class="empty-icon">☷</div>
      <p data-i18n="queue.empty">${esc(t('queue.empty'))}</p>
      <small data-i18n="queue.hint">${esc(t('queue.hint'))}</small>
    </div>`;
  return tpl(queueTemplate, { PLAY_DISABLED: playlist.songs.length ? '' : 'disabled', CLEAR_DISABLED: playlist.songs.length ? '' : 'disabled', QUEUE_ITEMS: items });
}

function renderPlayerBar(): string {
  const current = playerStatus.current_song;
  const duration = playerStatus.duration || currentDurationFromQueue();
  const position = Math.min(playerStatus.position || 0, duration || 0);
  const deviceOptions = audioDevices.length ? 
  audioDevices.map(device => `<option value="${esc(device.id)}" ${String(playerStatus.output_device?.id ?? '') === String(device.id) ? 'selected' : ''}>${esc(device.name)}${device.is_default ? "(" + t("player.default") + ")" : ''}</option>`).join('') : 
  `<option value="">${esc(t("player.audioDevice"))}</option>`;
  return tpl(playerTemplate, {
    COVER: esc(coverUrl(current?.cover)), SONG_TITLE: esc(current?.title || t('player.noSong')),
    SONG_ARTIST: esc(current?.artist || t('player.chooseSong')),
    SHUFFLE_SELECTED: playerStatus.shuffle ? 'selected' : '', REPEAT_SELECTED: playerStatus.repeat !== 'off' ? 'selected' : '',
    PLAY_ACTION: playerStatus.state === 'playing' ? 'pause' : 'resume', PLAY_ICON: playerStatus.state === 'playing' ? 'Ⅱ' : '▶',
    REPEAT_ICON: playerStatus.repeat === 'one' ? '⟳1' : '⟳', POSITION: formatTime(position), DURATION: formatTime(duration),
    PROGRESS: String(duration ? position / duration * 100 : 0), QUEUE_SELECTED: queueOpen ? 'selected' : '',
    DEVICE_OPTIONS: deviceOptions, VOLUME: String(Math.round(playerStatus.volume)),
  });
}

function currentDurationFromQueue(): number {
  const current = playerStatus.current_song;
  if (!current) return 0;
  return playlist.songs.find(song => song.id === current.id)?.duration ?? 0;
}

function renderHome(): void {
  const content = document.querySelector<HTMLDivElement>('#content')!;
  const options = (['year', 'name', 'artist'] as AlbumSortKey[]).map(key => 
    `<option value="${key}" ${albumOrder.key === key ? 'selected' : ''}>
      ${key === 'year' ? t("common.year") : 
          key === 'name' ? t("common.name") : t("common.artist")}
    </option>`
  ).join('');
  content.innerHTML = tpl(homeTemplate, { 
    ALBUM_COUNT: String(albums.length), 
    ORDER_WAY: albumOrder.way === 'up' ? t("home.ascending") : t("home.descending"), 
    ORDER_OPTIONS: options, ALBUM_CARDS: albums.length ? albums.map(renderAlbumCard).join('') : `<div class="empty-state"><div class="empty-icon">♫</div><p>${esc(t('home.empty'))}</p></div>`
  });
  bindContentEvents(); translateDOM(content);
}

function renderAlbumCard(album: Album): string {
  return tpl(albumCardTemplate, { ID: esc(album.id), COVER: esc(coverUrl(album.cover)), ALT: esc(`${album.name} ${t("album.cover")}`), NAME: esc(album.name), ARTIST: esc(album.albumartist), SONG_COUNT: String(album.song_count) });
}

async function openAlbum(albumId: string): Promise<void> {
  try {
    const songs = await getAlbumSongs(albumId);
    currentAlbum = albums.find(item => item.id === albumId) || null;
    if (!currentAlbum) return;
    
    currentAlbumSongs = songs;
    currentView = 'album';
    renderShell();
    renderAlbumPage();
  } catch (error) {
    showToast(errorMessage(error));
  }
}

function renderAlbumPage(): void {
  if (!currentAlbum) return;
  const content = document.querySelector<HTMLDivElement>('#content')!;
  const album = currentAlbum;
  content.innerHTML = tpl(
    albumTemplate,
    { 
      COVER: esc(coverUrl(album.cover)),
      ALBUM_ALT: esc(album.name),
      ALBUM_NAME: esc(album.name),
      ARTIST: esc(album.albumartist),
      YEAR_COUNT: `${album.year ? `${album.year} · ` : ''}${currentAlbumSongs.length} ${t("album.utracks")}`,
      SONG_ROWS: currentAlbumSongs.map(renderSongRow).join('') }
  );
  bindContentEvents(); translateDOM(content);
}

function renderSongRow(song: Song, index: number): string {
  return tpl(songRowTemplate, { ID: esc(song.id), TRACK: String(song.tracknumber || index + 1).padStart(2, '0'), TITLE: esc(song.title), ARTIST: esc(song.artist), DURATION: formatTime(song.duration) });
}

async function renderSearch(): Promise<void> {
  const content = document.querySelector<HTMLDivElement>('#content')!;
  content.innerHTML = tpl(searchTemplate, { KEYWORD: esc(searchKeyword) });
  translateDOM(content);
  const input = document.querySelector<HTMLInputElement>('#library-search')!;
  input.placeholder = t('search.placeholder');
  let debounce: number | undefined;
  input.addEventListener('input', () => { searchKeyword = input.value.trim(); window.clearTimeout(debounce); debounce = window.setTimeout(() => void performSearch(searchKeyword), 250); });
  if (searchKeyword) await performSearch(searchKeyword);
}

async function performSearch(keyword: string): Promise<void> {
  const results = document.querySelector<HTMLDivElement>('#search-results');
  if (!results) return;
  if (!keyword) {
    results.innerHTML = `<p class="muted">${esc(t('search.hint'))}</p>`;
    return;
  }
  results.innerHTML = `<p class="muted">${esc(t('search.loading'))}</p>`;
  try {
    const songs = await searchSongs(keyword);
    const matchedAlbums = albums.filter(album =>
      album.name.toLowerCase().includes(keyword.toLowerCase()) ||
      album.albumartist.toLowerCase().includes(keyword.toLowerCase()),
    );
    results.innerHTML = `
      ${matchedAlbums.length ? `<div class="section-heading"><h2>${esc(t('search.albums'))}</h2><span class="muted">${matchedAlbums.length} ${t("search.results")}</span></div><div class="album-grid compact-grid">${matchedAlbums.map(renderAlbumCard).join('')}</div>` : ''}
      <div class="section-heading"><h2>${esc(t('search.songs'))}</h2><span class="muted">${songs.length} ${t("search.results")}</span></div>
      <div class="track-list">${songs.length ? songs.map((song, index) => renderSongRow(song, index)).join('') : `<p class="muted">${esc(t('search.noSongs'))}</p>`}</div>
      <div class="section-heading"><button class="yt-button" data-search-yt="${esc(keyword)}" aria-label="從youtube搜尋">▶</button></div>
    `;
    bindContentEvents();
    translateDOM(results);
  } catch (error) {
    results.innerHTML = `<p class="error-text">${esc(errorMessage(error))}</p>`;
  }
}

function bindImageFallbacks(root: ParentNode): void {
  root.querySelectorAll<HTMLImageElement>('img').forEach(image => {
    image.addEventListener('error', () => {
      if (image.dataset.fallbackApplied) return;
      image.dataset.fallbackApplied = 'true';
      image.src = placeholder;
    }, { once: true });
  });
}

function bindShellEvents(): void {
  bindImageFallbacks(app);
  app.querySelectorAll<HTMLElement>('[data-nav]').forEach(button => {
    button.addEventListener('click', () => {
      const target = button.dataset.nav as View;
      if (target === 'home') router.navigate('/page');
      else if (target === 'search') router.navigate('/page/search');
    });
  });
  app.querySelectorAll<HTMLElement>('[data-action]').forEach(button => {
    if (button.closest('.player-bar')) return;
    button.addEventListener('click', () => void handleAction(button.dataset.action!));
  });
  app.querySelectorAll<HTMLElement>('[data-play-index]').forEach(button => {
    button.addEventListener('click', () => void playFromIndex(Number(button.dataset.playIndex)));
  });
  app.querySelectorAll<HTMLElement>('[data-remove-queue]').forEach(button => {
    button.addEventListener('click', () => void removeQueueItem(Number(button.dataset.removeQueue)));
  });
  bindPlayerControls(app.querySelector<HTMLElement>('.player-bar'));

}

function bindContentEvents(): void {
  bindImageFallbacks(document.querySelector('#content') || document);
  document.querySelectorAll<HTMLElement>('[data-open-album]').forEach(button => {
    button.addEventListener('click', () => router.navigate(`/page/album/${button.dataset.openAlbum}`));
  });
  document.querySelectorAll<HTMLElement>('[data-play-song]').forEach(button => {
    button.addEventListener('click', () => void playSelectedSong(button.dataset.playSong!));
  });
  document.querySelectorAll<HTMLElement>('[data-add-song]').forEach(button => {
    button.addEventListener('click', () => void addSongToQueue(button.dataset.addSong!));
  });
  document.querySelectorAll<HTMLElement>('[data-search-yt]').forEach(button => {
    button.addEventListener('click', () => void searchYt(button.dataset.searchYt!));
  });
  document.querySelectorAll<HTMLElement>('#content [data-action]').forEach(button => {
    button.addEventListener('click', () => void handleAction(button.dataset.action!));
  });
  document.querySelector<HTMLSelectElement>('[data-control="album-order-key"]')?.addEventListener('change', async event => {

    const select = event.currentTarget as HTMLSelectElement;
    if (!select.value) return;
    select.disabled = true;
    try {
      albumOrder.key = select.value as AlbumSortKey;
      albums = await setAlbumOrder(albumOrder);
      renderHome();
    } catch (error) {
      showToast(errorMessage(error));
      renderHome();
    } finally {
      select.disabled = false;
    }
  });
}

async function handleAction(action: string): Promise<void> {
  try {
    switch (action) {
      case 'toggle-queue':
        queueOpen = !queueOpen;
        await refreshQueue();
        renderShell();
        if (currentView === 'home') renderHome();
        else if (currentView === 'album') renderAlbumPage();
        else void renderSearch();
        break;
      case 'back-home':
        router.navigate('/page');
        break;
      case 'play-album':
        if (currentAlbumSongs.length) {
          await clearPlaylist()
          await addSongsToQueue(currentAlbumSongs);
          await playPlaylist();
          await refreshPlayerAndQueue();
          showToast(t('msg.albumPlaying'));
        }
        break;
      case 'add-album':
        await addSongsToQueue(currentAlbumSongs);
        showToast(t('msg.albumAdded'));
        break;
      case 'play-queue':
        await playPlaylist();
        await refreshPlayerAndQueue();
        showToast(t('msg.queuePlaying'));
        break;
      case 'clear-queue':
        await clearPlaylist();
        await refreshQueue();
        renderShell();
        if (currentView === 'home') renderHome();
        else if (currentView === 'album') renderAlbumPage();
        break;
      case 'pause':
        await pausePlayer();
        await refreshPlayer();
        break;
      case 'resume':
        if (playerStatus.current_song) await resumePlayer();
        else if (playlist.songs.length) await playPlaylist();
        await refreshPlayer();
        break;
      case 'stop':
        await stopPlayer();
        await refreshPlayer();
        break;
      case 'next':
        await nextSong();
        await refreshPlayerAndQueue();
        break;
      case 'previous':
        await previousSong();
        await refreshPlayerAndQueue();
        break;
      case 'toggle-shuffle':
        await updateMode({ shuffle: !playerStatus.shuffle, repeat: playerStatus.repeat });
        break;
      case 'cycle-repeat':
        const order: RepeatMode[] = ['off', 'all', 'one'];
        const next = order[(order.indexOf(playerStatus.repeat) + 1) % order.length];
        await updateMode({ shuffle: playerStatus.shuffle, repeat: next });
        break;
      case 'refresh-database':
        await refreshDatabase();
        albums = await getAlbums();
        albumOrder = { key: 'year', way: 'down'};
        await refreshPlayerAndQueue();
        renderHome();
        break;
      case 'album-order-way':
        const way = albumOrder.way === "up" ? "down" : "up";
        albumOrder.way = way
        albums = await setAlbumOrder(albumOrder);
        renderHome();
        break;
    }
  } catch (error) {
    showToast(errorMessage(error));
  }
}

async function playSelectedSong(songId: string): Promise<void> {
  try {
    await playSong(songId);
    await refreshPlayerAndQueue();
    showToast(t('msg.playing'));
  } catch (error) {
    showToast(errorMessage(error));
  }
}

async function addSongToQueue(songId: string): Promise<void> {
  try {
    await addToPlaylist(songId);
    await refreshQueue();
    showToast(t('msg.added'));
    if (queueOpen) {
      renderShell();
      if (currentView === 'home') renderHome();
      else if (currentView === 'album') renderAlbumPage();
    }
  } catch (error) {
    showToast(errorMessage(error));
  }
}

async function addSongsToQueue(songs: Song[]): Promise<void> {
  for (const song of songs) await addToPlaylist(song.id);
  await refreshQueue();
}

async function searchYt(text: string): Promise<void> {
  try {
    if (text){
      await searchFromYt(text)
      await refreshQueue();
      showToast(t('msg.added'));
    }
    showToast(text);
  }
  catch (error) {
    showToast(errorMessage(error));
  }
}

async function playFromIndex(index: number): Promise<void> {
  try {
    await playPlaylistFrom(index);
    await refreshPlayerAndQueue();
    showToast(t('msg.playing'));
  } catch (error) {
    showToast(errorMessage(error));
  }
}

async function removeQueueItem(index: number): Promise<void> {
  try {
    await removeFromPlaylist(index);
    await refreshQueue();
    renderShell();
    if (currentView === 'home') renderHome();
    else if (currentView === 'album') renderAlbumPage();
    else void renderSearch();
  } catch (error) {
    showToast(errorMessage(error));
  }
}

async function refreshQueue(): Promise<void> {
  try {
    playlist = await getPlaylist();
  } catch (error) {
    // Queue API may not have been implemented yet.
    console.warn('播放佇列 API 尚未可用：', error);
  }
}

async function refreshPlayer(): Promise<void> {
  try {
    playerStatus = await getPlayerStatus();
    updatePlayerBar();
  } catch (error) {
    console.warn('播放器狀態 API 尚未可用：', error);
  }
}

async function refreshPlayerAndQueue(): Promise<void> {
  await Promise.all([refreshPlayer(), refreshQueue()]);
  updatePlayerBar();
  if (queueOpen) {
    renderShell();
    if (currentView === 'home') renderHome();
    else if (currentView === 'album') renderAlbumPage();
  }
}

function bindPlayerControls(bar: HTMLElement | null): void {
  if (!bar) return;
  bar.querySelectorAll<HTMLElement>('[data-action]').forEach(button => {
    button.addEventListener('click', () => void handleAction(button.dataset.action!));
  });
  bar.querySelector<HTMLInputElement>('[data-control="volume"]')?.addEventListener('change', event => {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    void setPlayerVolume(value).then(() => {
      playerStatus.volume = value;
      showToast(`${t('msg.volume')} ${value}%`);
    }).catch(error => showToast(errorMessage(error)));
  });
  bar.querySelector<HTMLSelectElement>('[data-control="device"]')?.addEventListener('change', async event => {

    const select = event.currentTarget as HTMLSelectElement;
    if (!select.value) return;
    select.disabled = true;
    try {
      const result = await setAudioDevice(select.value);
      playerStatus.output_device = { id: result.selected_device_id, name: result.selected_device_name };
      showToast(`${t('msg.deviceChanged')}${result.selected_device_name}`);
    } catch (error) {
      showToast(errorMessage(error));
      await loadAudioDevices();
      updatePlayerBar();
    } finally {
      select.disabled = false;
    }
  });
  const track = bar.querySelector<HTMLElement>('[data-action="seek-track"]');
  if (track) {
    track.setAttribute('role', 'slider');
    track.setAttribute('tabindex', '0');
    track.setAttribute('aria-label', '播放進度');
    track.addEventListener('pointerdown', () => { seeking = true; });
    track.addEventListener('pointerup', () => { seeking = false; });
    track.addEventListener('pointercancel', () => { seeking = false; });
    track.addEventListener('click', event => {
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, ((event as PointerEvent).clientX - rect.left) / rect.width));
      const duration = playerStatus.duration || currentDurationFromQueue();
      if (!duration) return showToast(t('player.noSeek'));
      void seekPlayer(Math.round(ratio * duration)).then(async result => {
        playerStatus.position = result.position;
        playerStatus.duration = result.duration;
        await refreshPlayer();
        showToast(`${t('msg.seek')} ${formatTime(result.position)}`);
      }).catch(error => showToast(errorMessage(error)));
    });
    track.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const duration = playerStatus.duration || currentDurationFromQueue();
      const step = event.key === 'ArrowRight' ? 5 : -5;
      void seekPlayer(Math.max(0, Math.min(duration, playerStatus.position + step)))
        .then(() => refreshPlayer()).catch(error => showToast(errorMessage(error)));
    });
  }
}

async function updateMode(mode: { shuffle: boolean; repeat: RepeatMode }): Promise<void> {
  const result = await setPlayerMode(mode);
  playerStatus.shuffle = result.shuffle;
  playerStatus.repeat = result.repeat;
  updatePlayerBar();
  const repeatLabel = result.repeat === 'off' ? t('msg.repeatOff') : result.repeat === 'one' ? t('msg.repeatOne') : t('msg.repeatAll');
  showToast(`${result.shuffle ? t('msg.shuffleOn') : t('msg.shuffleOff')} · ${repeatLabel}`);
}

async function loadAudioDevices(): Promise<void> {
  try {
    const result = await getAudioDevices();
    audioDevices = result.devices;
    if (result.selected_device_id && !playerStatus.output_device) {
      const selected = audioDevices.find(device => String(device.id) === String(result.selected_device_id));
      if (selected) playerStatus.output_device = { id: selected.id, name: selected.name };
    }
  } catch (error) {
    // 後端未提供裝置 API 時，其他播放器功能仍可正常使用。
    console.warn('無法取得音訊輸出裝置：', error);
  }
}

function updatePlayerBar(): void {
  const old = document.querySelector<HTMLElement>('.player-bar');
  if (!old || seeking || 
    old.querySelector('[data-control="volume"]') === document.activeElement ||
    old.querySelector('[data-control="device"]') === document.activeElement
  ) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = renderPlayerBar();
  const newBar = wrapper.firstElementChild as HTMLElement | null;
  if (!newBar) return;

  const current = playerStatus.current_song;
  const coverKey = current ? `${current.id}|${current.cover || ''}` : 'no-song';
  if (coverKey === lastPlayerCoverKey) {
    const oldCover = old.querySelector<HTMLImageElement>('.now-cover');
    const newCover = newBar.querySelector<HTMLImageElement>('.now-cover');
    if (oldCover && newCover) newCover.replaceWith(oldCover);
  } else {
    lastPlayerCoverKey = coverKey;
  }

  old.replaceWith(newBar);
  bindPlayerControls(newBar);

}

function showToast(message: string): void {
  const toast = document.querySelector<HTMLDivElement>('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  window.setTimeout(() => toast.classList.remove('visible'), 2600);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : t('msg.unknown');
}

function renderCurrentPage(): void {
  if (currentView === 'home') renderHome();
  else if (currentView === 'album') renderAlbumPage();
  else void renderSearch();
}

async function setupRouter() {
  // Route 1: HomePage
  router.addRoute('/page', async () => {
    currentView = 'home';
    currentAlbum = null;
    renderShell();
    renderHome();
    window.scrollTo(0, 0);
  });

  // Route 2: SearchPage (Support /search?q=xxx)
  const searchHandler = async (_params: Record<string, string>) => {
    currentView = 'search';
    searchKeyword = new URLSearchParams(window.location.search).get('q') || ''; 
    renderShell();
    await renderSearch();
    window.scrollTo(0, 0);
  };
  router.addRoute('/page/search', searchHandler);

  // Route 3: AlbumPage (Support /album/xxx)
  const albumHandler = async (params: Record<string, string>) => {
    currentView = 'album';
    if (params.id) await openAlbum(params.id);
    window.scrollTo(0, 0);
  };
  router.addRoute('/page/album/:id', albumHandler);

  // Listening Previous & Next Page
  window.addEventListener('popstate', () => router.resolve());

  // 執行初始解析
  await router.resolve();
}


async function initialize(): Promise<void> {
  document.documentElement.lang = getLang(getLocale());
  renderShell();
  const content = document.querySelector<HTMLDivElement>('#content')!;
  content.innerHTML = `<div class="loading-state">${esc(t('home.loading'))}</div>`;
  try {
    albums = await getAlbums();
    renderHome();
  } catch (error) {
    content.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">!</div>
      <p>無法載入音樂庫</p>
      <small>${esc(errorMessage(error))}</small>
      <button class="secondary-button retry-button" id="retry-load">重新載入</button>
    </div>
    `;
    document.querySelector('#retry-load')?.addEventListener('click', () => void initialize());
  }
  await Promise.all([refreshPlayer(), refreshQueue(), loadAudioDevices()]);
  updatePlayerBar();
  if (statusTimer) window.clearInterval(statusTimer);
  statusTimer = window.setInterval(() => {
    void refreshPlayer();
  }, 1000);

  await setupRouter();
}

void initialize();
