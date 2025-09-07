// adblock_lists.js — 定义可选的广告过滤列表（名称与下载 URL）

export const FILTER_LISTS = [
  // 全球性
  { id: 'easylist',                group: 'global',  name: 'EasyList',                         url: 'https://easylist.to/easylist/easylist.txt' },
  { id: 'easyprivacy',             group: 'global',  name: 'EasyPrivacy',                      url: 'https://easylist-downloads.adblockplus.org/easyprivacy.txt' },
  { id: 'fanboy_social',           group: 'global',  name: 'Fanboy’s Social Blocking List',    url: 'https://easylist-downloads.adblockplus.org/fanboy-social.txt' },
  { id: 'fanboy_annoyance',        group: 'global',  name: 'Fanboy’s Annoyance List',          url: 'https://easylist.to/easylist/fanboy-annoyance.txt' },
  { id: 'peter_lowe',              group: 'global',  name: "Peter Lowe’s Ad & Tracking",       url: 'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&mimetype=plaintext' },
  { id: 'ubo_ads',                 group: 'global',  name: 'uBlock filters – Ads',             url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt' },
  { id: 'ubo_privacy',             group: 'global',  name: 'uBlock filters – Privacy',         url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt' },
  { id: 'ubo_resource',            group: 'global',  name: 'uBlock filters – Resource abuse',  url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/resource-abuse.txt' },
  { id: 'ubo_unbreak',             group: 'global',  name: 'uBlock filters – Unbreak',         url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/unbreak.txt' },
  { id: 'ubo_quickfix',            group: 'global',  name: 'uBlock filters – Quick fixes',     url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/quick-fixes.txt' },
  { id: 'adguard_url_tracking',    group: 'global',  name: 'AdGuard URL Tracking Protection',  url: 'https://filters.adtidy.org/extension/ublock/filters/17.txt' },

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
