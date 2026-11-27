import zhTW from './locales/zh-TW.json';
import enUS from './locales/en-US.json';

export type Locale = 'zh-TW' | 'en-US';
const catalogs: Record<Locale, Record<string, string>> = { 'zh-TW': zhTW, 'en-US': enUS };
let locale: Locale = (localStorage.getItem('music-remote-locale') as Locale) || 'zh-TW';
if (!(locale in catalogs)) locale = 'zh-TW';

export function getLocale(): Locale { return locale; }
export function setLocale(next: Locale): void {
  locale = next; localStorage.setItem('music-remote-locale', next);
  document.documentElement.lang = next === 'zh-TW' ? 'zh-Hant' : 'en';
  translateDOM();
}
export function t(key: string): string {
  return catalogs[locale][key] ?? catalogs['zh-TW'][key] ?? key;
}
export function translateDOM(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n || ''); });
  root.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder || ''); });
  const selector = root.querySelector<HTMLSelectElement>('#language-select');
  if (selector) selector.value = locale;
}
