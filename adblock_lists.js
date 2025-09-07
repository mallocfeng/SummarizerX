// adblock_lists.js — 定义可选的广告过滤列表（名称与下载 URL）

export const FILTER_LISTS = [
  // 全球性
  { id: 'easylist',                group: 'global',  name: 'EasyList',                         url: 'https://easylist.to/easylist/easylist.txt' },
  { id: 'easyprivacy',             group: 'global',  name: 'EasyPrivacy',                      url: 'https://easylist.to/easyprivacy/easyprivacy.txt' },
  { id: 'easylist_cookie',         group: 'global',  name: 'EasyList Cookie List',             url: 'https://easylist.to/easylist/easylist-cookie.txt' },
  { id: 'fanboy_annoyance',        group: 'global',  name: 'Fanboy’s Annoyance List',          url: 'https://easylist-downloads.adblockplus.org/fanboy-annoyance.txt' },
  { id: 'fanboy_social',           group: 'global',  name: 'Fanboy’s Social Blocking List',    url: 'https://easylist-downloads.adblockplus.org/fanboy-social.txt' },
  { id: 'anti_circumvention',      group: 'global',  name: 'AdBlock Anti-Circumvention List',  url: 'https://easylist-downloads.adblockplus.org/antiadblock.txt' },

  // 区域性
  { id: 'de',                      group: 'regional', name: 'Germany (EasyList Germany)',                           url: 'https://easylist.to/easylistgermany/easylistgermany.txt' },
  { id: 'de_plus_easylist',        group: 'regional', name: 'Germany (EasyList Germany + EasyList combined)',       url: 'https://easylist-downloads.adblockplus.org/easylistgermany+easylist.txt' },
  { id: 'pl',                      group: 'regional', name: 'Poland (EasyList Polish)',                             url: 'https://easylist-downloads.adblockplus.org/easylistpolish.txt' },
  { id: 'es',                      group: 'regional', name: 'Spanish (EasyList Spanish)',                           url: 'https://easylist-downloads.adblockplus.org/easylistspanish.txt' },
  { id: 'it',                      group: 'regional', name: 'Italy (EasyList Italy)',                                url: 'https://easylist-downloads.adblockplus.org/easylistitaly.txt' },
  { id: 'cn',                      group: 'regional', name: 'China (EasyList China)',                                url: 'https://easylist-downloads.adblockplus.org/easylistchina.txt' },
  { id: 'ru',                      group: 'regional', name: 'Russia (RU Counters / RU AdList)',                      url: 'https://easylist-downloads.adblockplus.org/cntblock.txt' }
];

export const FILTER_DEFAULT_STRENGTH = 'medium'; // 'low' | 'medium' | 'high'

export function getListById(id){ return FILTER_LISTS.find(x => x.id === id); }
export function splitLists(){
  return {
    global: FILTER_LISTS.filter(x => x.group === 'global'),
    regional: FILTER_LISTS.filter(x => x.group === 'regional')
  };
}

