// Minimal IMA3 SDK stub to satisfy player integrations without running ads.
// This is intentionally tiny and may need extensions per site.
(function(){
  try {
    var w = window;
    w.google = w.google || {};
    var g = w.google;
    g.ima = g.ima || {};
    var I = g.ima;
    function noop(){}

    I.AdDisplayContainer = function AdDisplayContainer(){ };
    I.AdDisplayContainer.prototype.initialize = noop;

    I.ImaSdkSettings = function ImaSdkSettings(){ };
    I.ImaSdkSettings.VpaidMode = { DISABLED: 0, ENABLED: 1, INSECURE_MODE: 2 };
    I.ImaSdkSettings.prototype.setVpaidMode = noop;
    I.ImaSdkSettings.prototype.setNumRedirects = noop;

    I.AdsRenderingSettings = function AdsRenderingSettings(){ };

    I.AdsRequest = function AdsRequest(){
      this.adTagUrl = '';
      this.nonLinearAdSlotWidth = 0;
      this.nonLinearAdSlotHeight = 0;
      this.linearAdSlotWidth = 0;
      this.linearAdSlotHeight = 0;
    };

    I.AdsManager = function AdsManager(){ };
    I.AdsManager.prototype.init = noop;
    I.AdsManager.prototype.start = noop;
    I.AdsManager.prototype.stop = noop;
    I.AdsManager.prototype.resume = noop;
    I.AdsManager.prototype.pause = noop;
    I.AdsManager.prototype.destroy = noop;
    I.AdsManager.prototype.addEventListener = noop;

    I.AdsLoader = function AdsLoader(){ };
    I.AdsLoader.prototype.addEventListener = noop;
    I.AdsLoader.prototype.getSettings = function(){ return new I.ImaSdkSettings(); };
    I.AdsLoader.prototype.requestAds = noop;
    I.AdsLoader.prototype.contentComplete = noop;
    I.AdsLoader.prototype.destroy = noop;

    I.AdsManagerLoadedEvent = function(){};
    I.AdsManagerLoadedEvent.Type = { ADS_MANAGER_LOADED: 'adsManagerLoaded' };
    I.AdErrorEvent = function(){};
    I.AdErrorEvent.Type = { AD_ERROR: 'adError' };
  } catch (e) { /* swallow */ }
})();

export {};

