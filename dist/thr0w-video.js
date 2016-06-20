(function() {
  // jscs:disable
  /**
  * This module provides tools to play synchronized HTML5 video.
  * @module thr0w-video
  */
  // jscs:enable
  'use strict';
  var thr0w = window.thr0w;
  if (thr0w === undefined) {
    throw 400;
  }
  var MAX_DRIFT = 0.03;
  var INITIAL_RESTART_DELAY = 0.1;
  var RESTART_DELAY_SHIFT = 0.01;
  var HAVE_ENOUGH_DATA = 4;
  var CAN_PLAY_STATUS = 0;
  var STANDBY_STATUS = 1;
  var PING_STATUS = 2;
  var PING_MASTER_STATUS = 3;
  var READY_STATUS = 4;
  var PLAY_MESSAGE = 10;
  var SYNC_MESSAGE = 11;
  var PAUSE_MESSAGE = 12;
  var SET_MESSAGE = 13;
  var DESTROY_MESSAGE = 14;
  var service = {};
  service.Video = Video;
  // jscs:disable
  /**
  * This object provides HTML5 video synchronization.
  * @namespace thr0w
  * @class video
  * @static
  */
  // jscs:enable
  thr0w.video = service;
  // jscs:disable
  /**
  * This class is used to play HTML5 video
  * @namespace thr0w.video
  * @class Video
  * @constructor
  * @param grid {Object} The grid, {{#crossLink "thr0w.Grid"}}thr0w.Grid{{/crossLink}}, object.
  * @param videoEl {Object} The HTML5 video object.
  */
  // jscs:enable
  function Video(grid, videoEl) {
    if (!grid || typeof grid !== 'object') {
      throw 400;
    }
    if (!videoEl || typeof videoEl !== 'object') {
      throw 400;
    }
    var iChannel;
    var channel = thr0w.getChannel();
    var channels = [];
    var channelsCanPlay = {};
    var delay;
    var gap;
    var i;
    var id;
    var j;
    var master;
    var matrix = grid.getMatrix();
    var playing = false;
    var ready = false;
    var restartDelay = INITIAL_RESTART_DELAY;
    var self = this;
    var thr0wCanPlayInterval;
    var thr0wSyncInterval;
    id = videoEl.id;
    master = matrix[0][0];
    for (i = 0; i < matrix.length; i++) {
      for (j = 0; j < matrix[i].length; j++) {
        iChannel = matrix[i][j];
        channels.push(iChannel);
        master = iChannel < master ? iChannel : master;
      }
    }
    videoEl.controls = false;
    videoEl.addEventListener('ended', handleEnded);
    thr0w.onMessage(messageCallback);
    checkCanPlay();
    self.play = play;
    self.pause = pause;
    self.setCurrentTime = setCurrentTime;
    self.destroy = destroy;
    self.addEventListener = addCustomEventListener;
    self.removeEventListener = removeCustomEventListener;
    function handleEnded() {
      /**
      * Video ended.
      *
      * @event ended
      */
      // jscs:enable
      document.dispatchEvent(new CustomEvent(
        'thr0w_video_' + id + '_ended',
        {detail: {}}));
    }
    function messageCallback(data) {
      var drift;
      var masterTime;
      var source = data.source;
      if (
        !data.message.thr0w ||
        data.message.thr0w.type !== 'video' ||
        data.message.thr0w.id !== id
      ) {
        return;
      }
      switch (data.message.thr0w.status) {
        case CAN_PLAY_STATUS:
          thr0w.thr0wChannel([source],
            {thr0w: {
              type: 'video',
              id: id,
              status: STANDBY_STATUS
            }}
          );
          channelsCanPlay[source] = true;
          checkChannelsCanPlay();
          break;
        case STANDBY_STATUS:
          window.clearInterval(thr0wCanPlayInterval);
          break;
        case PING_STATUS:
          delay = (new Date()).getTime();
          thr0w.thr0wChannel([master],
            {thr0w: {
              type: 'video',
              id: id,
              status: PING_MASTER_STATUS
            }}
          );
          break;
        case PING_MASTER_STATUS:
          thr0w.thr0wChannel([data.source],
            {thr0w: {
              type: 'video',
              id: id,
              status: READY_STATUS
            }}
          );
          break;
        case READY_STATUS:
          delay = ((new Date()).getTime() - delay) / 1000;
          ready = true;
          if (playing) {
            start();
          }
          break;
        case PLAY_MESSAGE:
          playing = true;
          if (ready) {
            start();
          }
          break;
        case SYNC_MESSAGE:
          if (channel === master) {
            return;
          }
          masterTime = data.message.thr0w.time;
          gap = videoEl.currentTime - masterTime + delay;
          drift = Math.abs(gap);
          if (drift > MAX_DRIFT) {
            restartDelay = gap >= 0 ?
              restartDelay - RESTART_DELAY_SHIFT :
              restartDelay + RESTART_DELAY_SHIFT;
            videoEl.currentTime = masterTime + delay + restartDelay;
          }
          break;
        case PAUSE_MESSAGE:
          if (!playing) {
            return;
          }
          playing = false;
          videoEl.pause();
          if (channel === master) {
            window.clearInterval(thr0wSyncInterval);
          }
          break;
        case SET_MESSAGE:
          videoEl.currentTime = data.message.thr0w.time;
          break;
        case DESTROY_MESSAGE:
          videoEl.pause();
          if (channel === master) {
            window.clearInterval(thr0wSyncInterval);
          }
          thr0w.offMessage(messageCallback);
          break;
        default:
      }
    }
    function checkCanPlay() {
      if (videoEl.readyState !== HAVE_ENOUGH_DATA) {
        videoEl.addEventListener('canplay', handleCanplay);
      } else {
        startThr0wCanPlay();
      }
      function handleCanplay() {
        videoEl.removeEventListener('canplay', handleCanplay);
        startThr0wCanPlay();
      }
    }
    // jscs:disable
    /**
    * This function is used to play the video.
    * @method play
    */
    // jscs:enable
    function play() {
      thr0w.thr0wChannel(channels,
        {thr0w: {
          type: 'video',
          id: id,
          status: PLAY_MESSAGE
        }}
      );
    }
    // jscs:disable
    /**
    * This function is used to pause the video.
    * @method pause
    */
    // jscs:enable
    function pause() {
      thr0w.thr0wChannel(channels,
        {thr0w: {
          type: 'video',
          id: id,
          status: PAUSE_MESSAGE
        }}
      );
    }
    // jscs:disable
    /**
    * This function is used set the video's current time.
    * @method setCurrentTime
    * @param time {Number} The time.
    */
    // jscs:enable
    function setCurrentTime(time) {
      if (time === undefined) {
        throw 400;
      }
      thr0w.thr0wChannel(channels,
        {thr0w: {
          type: 'video',
          id: id,
          status: SET_MESSAGE,
          time: time
        }}
      );
    }
    // jscs:disable
    /**
    * This function is used to destroy the video.
    * @method destroy
    */
    // jscs:enable
    function destroy() {
      thr0w.thr0wChannel(channels,
        {thr0w: {
          type: 'video',
          id: id,
          status: DESTROY_MESSAGE
        }}
      );
    }
    // jscs:disable
    /**
    * This method is used to register listeners
    * @method addEventListener
    * @param type {String} Name of the event.
    * @param listener {Function} Listening function.
    */
    // jscs:enable
    function addCustomEventListener(type, listener) {
      if (type === undefined || typeof type !== 'string') {
        throw 400;
      }
      if (listener === undefined || typeof listener !== 'function') {
        throw 400;
      }
      document.addEventListener(
        'thr0w_video_' + id + '_' + type,
        listener
      );
    }
    // jscs:disable
    /**
    * This method is used to deregister listeners
    * @method removeEventListener
    * @param type {String} Name of the event.
    * @param listener {Function} Listening function.
    */
    // jscs:enable
    function removeCustomEventListener(type, listener) {
      if (type === undefined || typeof type !== 'string') {
        throw 400;
      }
      if (listener === undefined || typeof listener !== 'function') {
        throw 400;
      }
      document.removeEventListener(
        'thr0w_video_' + id + '_' + type,
        listener
      );
    }
    function startThr0wCanPlay() {
      if (channel === master) {
        channelsCanPlay[master] = true;
        checkChannelsCanPlay();
      } else {
        thr0wCanPlayInterval = window.setInterval(thr0wCanPlay, 1000);
      }
    }
    function checkChannelsCanPlay() {
      var i;
      for (i = 0; i < channels.length; i++) {
        if (!channelsCanPlay[channels[i]]) {
          return;
        }
      }
      thr0w.thr0wChannel(channels,
        {thr0w: {
          type: 'video',
          id: id,
          status: PING_STATUS
        }}
      );
    }
    function thr0wCanPlay() {
      thr0w.thr0wChannel([master],
        {thr0w: {
          type: 'video',
          id: id,
          status: CAN_PLAY_STATUS
        }}
      );
    }
    function start() {
      if (channel === master) {
        thr0wSyncInterval =
          window.setInterval(thr0wSync, 1000);
      }
      videoEl.play();
      function thr0wSync() {
        thr0w.thr0wChannel(channels,
          {thr0w: {
            type: 'video',
            id: id,
            status: SYNC_MESSAGE,
            time: videoEl.currentTime
          }}
        );
      }
    }
  }
})();
