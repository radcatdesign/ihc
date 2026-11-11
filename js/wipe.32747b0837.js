/* Page wipe: a fresh mix of brand colors every time it runs. The last panel keeps its color,
   since it matches the page you're heading to. */
(function () {
  var el = document.getElementById('c-page-transition');
  if (!el) return;
  var blocks = el.querySelectorAll('.c-page-transition__block');
  if (blocks.length < 2) return;
  var PALETTE = ['#1810a0', '#f40c70', '#004fff', '#ff142d', '#ffb728', '#4d25c8', '#95efc9'];
  var rgb = function (hex) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgb(' + (n >> 16) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ')';
  };
  var shuffle = function (a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };
  // colors switch instantly; only the sweep itself animates
  for (var k = 0; k < blocks.length; k++) blocks[k].style.transitionProperty = 'width, height';
  function paint() {
    var last = blocks[blocks.length - 1];
    var end = getComputedStyle(last).backgroundColor;
    var pool = shuffle(PALETTE.filter(function (c) { return rgb(c) !== end; }));
    for (var i = 0; i < blocks.length - 1; i++) blocks[i].style.backgroundColor = pool[i % pool.length];
  }
  paint();
  // the destination color is decided on click, right before the wipe starts
  new MutationObserver(function () { if (el.classList.contains('active')) paint(); })
    .observe(el, { attributes: true, attributeFilter: ['class'] });
})();
