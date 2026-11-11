/* Case study helpers.
   1. Loop videos in the newer pieces play only while on screen; before/after sliders work.
   2. Accordion sections keep the right open height. The page measures each
      section once, a second in, which comes up short when gallery images
      haven't loaded yet. This re-measures as images arrive and on resize. */
(function () {
  document.querySelectorAll('.p-cs__x-media video, .p-cs__x-duo video, .p-cs__x-grid video, .p-cs__x-split video, .p-cs__x-social video').forEach(function (v) {
    if (window.ihcObserveVideo) window.ihcObserveVideo(v);
  });

  // Before and after: the invisible range input drives the divider
  document.querySelectorAll('[data-compare]').forEach(function (frame) {
    var range = frame.querySelector('.p-cs__x-compare__range');
    if (!range) return;
    var set = function () { frame.style.setProperty('--pos', range.value + '%'); };
    range.addEventListener('input', set);
    // stop the page's drag-to-scroll and custom cursor from grabbing the slider
    ['pointerdown', 'touchstart', 'mousedown'].forEach(function (ev) { range.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true }); });
    set();
  });

  // True open height of a section: lift the closed-state clamp for one
  // synchronous measurement (no paint happens in between), then put it back.
  function measure(b, c) {
    var loaded = b.getAttribute('data-loaded');
    c.style.transition = 'none';
    b.removeAttribute('data-loaded');
    c.style.maxHeight = 'none';
    var h = c.offsetHeight;
    c.style.maxHeight = '';
    b.setAttribute('data-loaded', loaded);
    void c.offsetHeight;
    c.style.transition = '';
    return h;
  }

  function fitAll() {
    document.querySelectorAll('.p-cs__block[data-loaded]').forEach(function (b) {
      var c = b.querySelector('.p-cs__block__content');
      if (!c) return;
      var h = measure(b, c);
      if (h > 0 && b.style.getPropertyValue('--block-height') !== h + 'px') b.style.setProperty('--block-height', h + 'px');
    });
  }

  var timer;
  function soon() {
    clearTimeout(timer);
    timer = setTimeout(fitAll, 150);
  }

  document.addEventListener('load', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.closest && t.closest('.p-cs__block__content')) soon();
  }, true);
  window.addEventListener('resize', soon);
  [1300, 2500, 5000].forEach(function (ms) { setTimeout(fitAll, ms); });
})();
