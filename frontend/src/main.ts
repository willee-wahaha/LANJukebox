import './style.css';
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

function renderShell(): void {
  app.innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand"><span class="brand-mark">♫</span><span>Music Remote</span></div>
        <nav class="nav">
          <button class="nav-item ${currentView === 'home' ? 'active' : ''}" data-nav="home">⌂ <span>音樂庫</span></button>
          <button class="nav-item ${currentView === 'search' ? 'active' : ''}" data-nav="search">⌕ <span>搜尋</span></button>
          <button class="nav-item ${queueOpen ? 'active' : ''}" data-action="toggle-queue">☷ <span>播放佇列</span></button>
        </nav>
      </aside>

      <main class="main-area">
        <header class="topbar">
          <div class="topbar-title">${currentView === 'album' ? '專輯' : currentView === 'search' ? '搜尋音樂' : '音樂收藏'}</div>
          <div class="topbar-actions">
            <span class="connection"><i></i> 本機音樂伺服器</span>
          </div>
        </header>
        <section id="content" class="content"></section>
      </main>

      ${queueOpen ? renderQueuePanel() : ''}
      ${renderPlayerBar()}
    </div>
    <div id="toast" class="toast" role="status"></div>
  `;
  bindShellEvents();
}

function renderQueuePanel(): string {
  return `
    <aside class="queue-panel">
      <div class="panel-heading">
        <div><span class="eyebrow">UP NEXT</span><h2>播放佇列</h2></div>
        <button class="icon-button" data-action="toggle-queue" aria-label="關閉">×</button>
      </div>
      <div class="queue-actions">
        <button class="small-button primary" data-action="play-queue" ${playlist.songs.length ? '' : 'disabled'}>播放全部</button>
        <button class="small-button" data-action="clear-queue" ${playlist.songs.length ? '' : 'disabled'}>清空</button>
      </div>
      <div class="queue-list">
        ${playlist.songs.length ? playlist.songs.map((song, index) => `
          <div class="queue-row ${index === playlist.current_index ? 'is-current' : ''}">
            <button class="queue-song" data-play-index="${index}">
              <img src="${esc(coverUrl(song.cover))}" alt="" onerror="this.src=${placeholder}">
              <span class="queue-song-info"><strong>${esc(song.title)}</strong><small>${esc(song.artist)}</small></span>
            </button>
            <button class="remove-button" data-remove-queue="${index}" aria-label="移除歌曲">×</button>
          </div>
        `).join('') : '<div class="empty-state compact"><div class="empty-icon">☷</div><p>播放佇列目前是空的</p><small>在歌曲旁按「加入佇列」即可新增。</small></div>'}
      </div>
    </aside>
  `;
}

function renderPlayerBar(): string {
  const current = playerStatus.current_song;
  const state = playerStatus.state;
  const duration = playerStatus.duration || currentDurationFromQueue();
  const position = Math.min(playerStatus.position || 0, duration || 0);
  return `
    <footer class="player-bar">
      <div class="now-playing">
        <img
          class="now-cover"
          src="${esc(coverUrl(current?.cover))}"
          alt=""
          onerror="this.onerror=null; this.src${placeholder}"
        >
        <div class="now-meta">
          <strong>${esc(current?.title || '尚未播放歌曲')}</strong>
          <small>${esc(current?.artist || '選擇一首歌曲開始播放')}</small>
        </div>
      </div>
      <div class="player-center">
        <div class="player-controls">
          <button class="player-control mode-button ${playerStatus.shuffle ? 'selected' : ''}" data-action="toggle-shuffle" aria-label="${playerStatus.shuffle ? '關閉隨機播放' : '開啟隨機播放'}" title="隨機播放">⤨</button>
          <button class="player-control subtle" data-action="previous" aria-label="上一首">|◀</button>
          <button class="player-control play-button" data-action="${state === 'playing' ? 'pause' : 'resume'}" aria-label="${state === 'playing' ? '暫停' : '播放'}">${state === 'playing' ? 'Ⅱ' : '▶'}</button>
          <button class="player-control subtle" data-action="next" aria-label="下一首">▶|</button>
          <button class="player-control mode-button ${playerStatus.repeat !== 'off' ? 'selected' : ''}" data-action="cycle-repeat" aria-label="循環模式：${playerStatus.repeat}" title="循環：${playerStatus.repeat}">${playerStatus.repeat === 'one' ? '⟳1' : '⟳'}</button>
        </div>
        <div class="progress-row">
          <span id="current-time">${formatTime(position)}</span>
          <div class="progress-track" data-action="seek-track"><div class="progress-fill" style="width:${duration ? position / duration * 100 : 0}%"></div></div>
          <span id="total-time">${formatTime(duration)}</span>
        </div>
      </div>
      <div class="player-right">
        <button class="icon-button ${queueOpen ? 'selected' : ''}" data-action="toggle-queue" aria-label="播放佇列">☷</button>
        <label class="device-picker" title="音訊輸出裝置">
          <span aria-hidden="true">▣</span>
          <select data-control="device" aria-label="音訊輸出裝置" title="音訊輸出裝置">
            ${audioDevices.length ? audioDevices.map(device => `<option value="${esc(device.id)}" ${String(playerStatus.output_device?.id ?? '') === String(device.id) ? 'selected' : ''}>${esc(device.name)}${device.is_default ? '（預設）' : ''}</option>`).join('') : '<option value="">音訊裝置</option>'}
          </select>
        </label>
        <span class="volume-symbol">◖</span>
        <input class="volume-slider" type="range" min="0" max="100" value="${Math.round(playerStatus.volume)}" data-control="volume" aria-label="音量" title="音量 ${Math.round(playerStatus.volume)}%">
      </div>
    </footer>
  `;
}

function currentDurationFromQueue(): number {
  const current = playerStatus.current_song;
  if (!current) return 0;
  return playlist.songs.find(song => song.id === current.id)?.duration ?? 0;
}

function renderHome(): void {
  const content = document.querySelector<HTMLDivElement>('#content')!;
  content.innerHTML = `
    <div class="section-heading">
      <div><span class="eyebrow">COLLECTION</span><h2>所有專輯</h2></div>
      <div class="album-count">
        <span class="muted">${albums.length} 張專輯</span>
        <label class="order-picker" title="專輯排序">
          <button class="back-link" data-action="album-order-way">${albumOrder.way === "up" ? "升序" : "降序"}</button>
          <select data-control="album-order-key" aria-label="專輯排序" title="專輯排序">
            ${['year', 'name', 'artist'].map(key => `<option value="${esc(key)}" ${albumOrder.key === key ? 'selected' : ''}>${esc(key)}</option>`).join('')}
          </select>
        </label>
      </div>
    </div>
    <div class="album-grid">
      ${albums.length ? albums.map(renderAlbumCard).join('') : '<div class="empty-state"><div class="empty-icon">♫</div><p>目前沒有專輯</p></div>'}
    </div>
    <div class="section-heading">
      <button class="small-button" data-action="refresh-database">重新掃描</button>
    </div>
  `;
  bindContentEvents();
}

function renderAlbumCard(album: Album): string {
  return `
    <button class="album-card" data-open-album="${esc(album.id)}">
      <div class="cover-wrap"><img src="${esc(coverUrl(album.cover))}" alt="${esc(album.name)} 封面" loading="lazy" onerror="this.src=${placeholder}"><span class="cover-play">▶</span></div>
      <strong>${esc(album.name)}</strong>
      <small>${esc(album.albumartist)} · ${album.song_count} 首</small>
    </button>
  `;
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
  content.innerHTML = `
    <button class="back-link" data-action="back-home">← 返回音樂庫</button>
    <section class="album-hero">
      <img class="album-large-cover" src="${esc(coverUrl(album.cover))}" alt="${esc(album.name)} 封面" onerror="this.src=${placeholder}">
      <div class="album-info"><span class="eyebrow">ALBUM</span><h1>${esc(album.name)}</h1><p class="album-artist">${esc(album.albumartist)}</p><p class="muted">${album.year ? `${album.year} · ` : ''}${currentAlbumSongs.length} 首歌曲</p>
      <div class="album-actions"><button class="primary-button" data-action="play-album">▶ 播放專輯</button><button class="secondary-button" data-action="add-album">＋ 加入佇列</button></div></div>
    </section>
    <div class="section-heading song-heading"><div><span class="eyebrow">TRACKS</span><h2>歌曲</h2></div></div>
    <div class="track-list">
      <div class="track-header"><span>#</span><span>歌曲</span><span>演唱者</span><span>時間</span><span></span></div>
      ${currentAlbumSongs.map((song, index) => renderSongRow(song, index)).join('')}
    </div>
  `;
  bindContentEvents();
}

function renderSongRow(song: Song, index: number): string {
  return `
    <div class="track-row">
      <button class="track-play" data-add-song="${esc(song.id)}" aria-label="加入播放佇列">${String(song.tracknumber || index + 1).padStart(2, '0')}</button>
      <button class="track-title" data-add-song="${esc(song.id)}"><strong>${esc(song.title)}</strong><small>${esc(song.artist)}</small></button>
      <span class="track-artist">${esc(song.artist)}</span>
      <span class="track-duration">${formatTime(song.duration)}</span>
      <button class="add-track" data-play-song="${esc(song.id)}" aria-label="播放">▶</button>
    </div>
  `;
}

async function renderSearch(): Promise<void> {
  const content = document.querySelector<HTMLDivElement>('#content')!;
  content.innerHTML = `
    <div class="page-intro"><span class="eyebrow">SEARCH</span><h1>搜尋音樂</h1><p>搜尋專輯或歌曲名稱、歌手。</p></div>
    <div class="search-box"><span>⌕</span><input id="library-search" type="search" placeholder="輸入專輯、歌曲或歌手..." value="${esc(searchKeyword)}" autofocus></div>
    <div id="search-results"><p class="muted">輸入關鍵字開始搜尋。</p></div>
  `;
  const input = document.querySelector<HTMLInputElement>('#library-search')!;
  let debounce: number | undefined;
  input.addEventListener('input', () => {
    searchKeyword = input.value.trim();
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => void performSearch(searchKeyword), 250);
  });
  if (searchKeyword) await performSearch(searchKeyword);
}

async function performSearch(keyword: string): Promise<void> {
  const results = document.querySelector<HTMLDivElement>('#search-results');
  if (!results) return;
  if (!keyword) {
    results.innerHTML = '<p class="muted">輸入關鍵字開始搜尋。</p>';
    return;
  }
  results.innerHTML = '<p class="muted">搜尋中...</p>';
  try {
    const songs = await searchSongs(keyword);
    const matchedAlbums = albums.filter(album =>
      album.name.toLowerCase().includes(keyword.toLowerCase()) ||
      album.albumartist.toLowerCase().includes(keyword.toLowerCase()),
    );
    results.innerHTML = `
      ${matchedAlbums.length ? `<div class="section-heading"><h2>專輯</h2><span class="muted">${matchedAlbums.length} 個結果</span></div><div class="album-grid compact-grid">${matchedAlbums.map(renderAlbumCard).join('')}</div>` : ''}
      <div class="section-heading"><h2>歌曲</h2><span class="muted">${songs.length} 個結果</span></div>
      <div class="track-list">${songs.length ? songs.map((song, index) => renderSongRow(song, index)).join('') : '<p class="muted">沒有找到歌曲。</p>'}</div>
      <div class="section-heading"><button class="yt-button" data-search-yt="${esc(keyword)}" aria-label="從youtube搜尋">▶</button></div>
    `;
    bindContentEvents();
  } catch (error) {
    results.innerHTML = `<p class="error-text">${esc(errorMessage(error))}</p>`;
  }
}

function bindShellEvents(): void {
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
          showToast('開始播放專輯');
        }
        break;
      case 'add-album':
        await addSongsToQueue(currentAlbumSongs);
        showToast('已將專輯加入播放佇列');
        break;
      case 'play-queue':
        await playPlaylist();
        await refreshPlayerAndQueue();
        showToast('開始播放佇列');
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
    showToast('正在播放');
  } catch (error) {
    showToast(errorMessage(error));
  }
}

async function addSongToQueue(songId: string): Promise<void> {
  try {
    await addToPlaylist(songId);
    await refreshQueue();
    showToast('已加入播放佇列');
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
      showToast('已加入播放佇列');
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
    showToast('正在播放');
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
      showToast(`音量 ${value}%`);
    }).catch(error => showToast(errorMessage(error)));
  });
  bar.querySelector<HTMLSelectElement>('[data-control="device"]')?.addEventListener('change', async event => {

    const select = event.currentTarget as HTMLSelectElement;
    if (!select.value) return;
    select.disabled = true;
    try {
      const result = await setAudioDevice(select.value);
      playerStatus.output_device = { id: result.selected_device_id, name: result.selected_device_name };
      showToast(`音訊輸出已切換：${result.selected_device_name}`);
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
      if (!duration) return showToast('目前沒有可調整進度的歌曲');
      void seekPlayer(Math.round(ratio * duration)).then(async result => {
        playerStatus.position = result.position;
        playerStatus.duration = result.duration;
        await refreshPlayer();
        showToast(`已跳至 ${formatTime(result.position)}`);
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
  const repeatLabel = result.repeat === 'off' ? '關閉循環' : result.repeat === 'one' ? '單曲循環' : '全部循環';
  showToast(`${result.shuffle ? '隨機播放開啟' : '隨機播放關閉'} · ${repeatLabel}`);
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
  return error instanceof Error ? error.message : '發生未知錯誤';
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
  router.addRoute('/page/search', async (params) => {
    currentView = 'search';
    searchKeyword = params.query || '';
    renderShell();
    await renderSearch();
    window.scrollTo(0, 0);
  });

  // Route 3: AlbumPage (Support /album/xxx)
  router.addRoute('/page/album/:id', async (params) => {
    currentView = 'album';
    if (params.id) await openAlbum(params.id);
    window.scrollTo(0, 0);
  });

  // Listening Previous & Next Page
  window.addEventListener('popstate', () => router.resolve());

  // 執行初始解析
  await router.resolve();
}


async function initialize(): Promise<void> {
  renderShell();
  const content = document.querySelector<HTMLDivElement>('#content')!;
  content.innerHTML = '<div class="loading-state">正在載入音樂收藏…</div>';
  try {
    albums = await getAlbums();
    renderHome();
  } catch (error) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon">!</div><p>無法載入音樂庫</p><small>${esc(errorMessage(error))}</small><button class="secondary-button retry-button" id="retry-load">重新載入</button></div>`;
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
