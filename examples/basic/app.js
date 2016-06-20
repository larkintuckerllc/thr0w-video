(function() {
  'use strict';
  var thr0w = window.thr0w;
  document.addEventListener('DOMContentLoaded', ready);
  function ready() {
    var frameEl = document.getElementById('my_frame');
    // CONFIGURED FOR LOCAL DEVELOPMENT; CHANGE HOSTNAME AS REQUIRED
    thr0w.setBase('http://localhost');
    thr0w.addAdminTools(frameEl,
      connectCallback, messageCallback);
    function connectCallback() {
      var videoEl = document.getElementById('my_video');
      var grid = new thr0w.Grid(
        frameEl,
        document.getElementById('my_content'), [
          [0, 1]
        ]);
      // CREATES A SYNCHRONIZED VIDEO OBJECT
      var video = new thr0w.video.Video(grid, videoEl);
      // ADD LISTENER FOR ENDED
      video.addEventListener('ended', handleEnded);
      // STARTS VIDEO
      video.play();
      function handleEnded() {
        window.console.log('VIDEO ENDED');
      }
    }
    function messageCallback() {}
  }
})();
