// nyt-noads-shim.js — page-world shim for NYTimes to neutralize ad layers safely
(function(){
  try{
    // Patch adClientUtils so site believes ads are disabled
    var u = window.adClientUtils = window.adClientUtils || {};
    var origHas = u.hasActiveToggle;
    u.hasActiveToggle = function(name){
      try{
        var n = String(name||'');
        if (/(^|_)dfp|geoedge|medianet|amazon|als_toggle|als|adslot|ads?/i.test(n)) return false;
      }catch{}
      return origHas ? origHas.apply(this, arguments) : false;
    };
    var origGet = u.getAdsPurrDirective;
    u.getAdsPurrDirective = function(){ return 'no-ads'; };
    try{ document.documentElement.dataset.optedOutOfAds = 'true'; }catch{}
  }catch(e){}
})();

