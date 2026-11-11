/*
 * IHC case study renderer.
 * Turns a case study's block data (content/case-studies/<slug>.json) into the
 * page HTML, plus its Work list item and homepage data item.
 * Runs in the browser (window.IHCRender) and in Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.IHCRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SITE = 'https://www.iheartcomix.com';
  // section colors you can pick in the builder (styles in builder/src/cs-blocks.css)
  var TONES = ['red', 'blue', 'violet', 'purple', 'night', 'black', 'yellow', 'pink', 'sky', 'white'];
  var ARROW = '/images/65e54c71f6dbffab76c7798b_Vector-14-.svg';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function attr(s) {
    return esc(s).replace(/"/g, '&quot;');
  }
  function jsq(s) {
    return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/</g, '\\u003c');
  }
  function slugify(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function pad(n) {
    return new Array(n + 1).join(' ');
  }
  // indent a block of lines (array or string) by n spaces
  function ind(n, lines) {
    if (typeof lines === 'string') lines = lines.split('\n');
    return lines.map(function (l) { return l ? pad(n) + l : l; }).join('\n');
  }
  function absUrl(u) {
    if (!u) return '';
    return /^https?:\/\//.test(u) ? u : SITE + (u.charAt(0) === '/' ? '' : '/') + u;
  }

  // ---------- media ----------
  function vimeoSrc(m) {
    return 'https://player.vimeo.com/video/' + m.vimeo + (m.hash ? '?h=' + m.hash : '');
  }
  function ratioPad(w, h) {
    w = +w || 16; h = +h || 9;
    return (h / w * 100).toFixed(4).replace(/\.?0+$/, '') + '%';
  }
  // Vimeo video for galleries (hidden collection, read by the gallery script)
  function galleryVideo(m) {
    if (m.embed) return m.embed;
    return '<div style="padding-top:' + ratioPad(m.w, m.h) + '" class="w-video w-embed"><iframe src="' + attr(vimeoSrc(m)) +
      '" width="' + (+m.w || 1920) + '" height="' + (+m.h || 1080) + '" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen=""' +
      (m.thumb ? ' data-thumb="' + attr(m.thumb) + '"' : '') + ' title="' + attr(m.title || '') + '"></iframe></div>';
  }
  function galleryImage(m) {
    return '<img decoding="async" src="' + attr(m.src) + '" loading="lazy" alt="' + attr(m.alt || '') + '" />';
  }
  function collection(media) {
    var out = (media || []).filter(function (m) { return m && (m.type === 'video' ? (m.embed || m.vimeo) : m.src); })
      .map(function (m) { return m.type === 'video' ? galleryVideo(m) : galleryImage(m); });
    return '<div class="p-cs__layouts__gallery__collections">' + (out.length ? '\n' + ind(2, out) + '\n' : '') + '</div>';
  }

  // ---------- pieces ----------
  function richText(html) {
    return ind(2, String(html || '').trim());
  }
  var P = {};
  P.text = function (p) {
    return [
      '<div class="p-cs__text">',
      '  <div class="c">',
      '    <div data-line-anim-bk="" data-visible-bk="" class="t-xl w-richtext">',
      ind(4, richText(p.html)),
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
  };
  P.text2 = function (p) {
    function col(h) {
      return ['    <div class="p-cs__text__block-col">',
        '      <div data-line-anim-bk="" data-visible-bk="" class="t-xl w-richtext">',
        ind(6, richText(h)),
        '      </div>',
        '    </div>'].join('\n');
    }
    return ['<div class="p-cs__text">', '  <div class="c v--col2">', col(p.left), col(p.right), '  </div>', '</div>'].join('\n');
  };
  P.gallery = function (p) {
    var dc = p.dataClass != null ? p.dataClass : 'vertical';
    return [
      '<div data-class="' + attr(dc) + '" class="p-cs__layouts__gallery vertical">',
      '  <div class="c v--no-pad-mobile">',
      '    <div class="p-cs__layouts__gallery__i">',
      '      <div class="p-cs__layouts__gallery__thumbs">',
      '        <div data-swiper-thumb="" class="swiper v--cs-gal-thumb">',
      '          <div class="swiper-wrapper v--vert"></div>',
      '        </div>',
      '        <div class="p-cs__layouts__gallery__btns"><img decoding="async" src="' + ARROW + '" loading="lazy" data-swiper-prev="" alt="" class="p-cs__layouts__gallery__btn" /><img decoding="async" src="' + ARROW + '" loading="lazy" data-swiper-next="" alt="" class="p-cs__layouts__gallery__btn v--next" /></div>',
      '      </div>',
      '      <div data-custom-mouse-ignore="drag" class="p-cs__layouts__gallery__slide">',
      '        <div data-swiper-main="" class="swiper v--cs-gal">',
      '          <div class="swiper-wrapper"></div>',
      '        </div>',
      '      </div>',
      ind(6, collection(p.media)),
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
  };
  P.fullGallery = function (p) {
    return [
      '<div data-color="' + attr(p.color || '#fcd9eb') + '" class="p-cs__layouts__full-gallery">',
      '  <div class="p-cs__layouts__full-gallery__inner">',
      '    <div class="c v--no-pad-mobile">',
      '      <div data-ignore-custom-mouse="drag" class="p-cs__layouts__gallery__slide">',
      '        <div data-swiper-main="" class="swiper v--cs-f-gal">',
      '          <div class="swiper-wrapper"></div>',
      '        </div>',
      '      </div>',
      '    </div>',
      '    <div class="p-cs__layouts__gallery__thumbs">',
      '      <div data-swiper-thumb="" class="swiper v--cs-gal-thumb">',
      '        <div class="swiper-wrapper"></div>',
      '      </div>',
      '    </div>',
      ind(4, collection(p.media)),
      '  </div>',
      '</div>'
    ].join('\n');
  };
  P.video = function (p) {
    var el = p.embed || ('<div style="padding-top:' + ratioPad(p.w, p.h) + '" class="p-cs__video__el w-video w-embed"><iframe src="' + attr(vimeoSrc(p)) +
      '" width="' + (+p.w || 1920) + '" height="' + (+p.h || 1080) + '" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen="" title="' + attr(p.title || '') + '"></iframe></div>');
    return ['<div class="p-cs__video">', '  <div class="c">', '    <div class="p-cs__video__inner">', ind(6, el), '    </div>', '  </div>', '</div>'].join('\n');
  };
  P.introGallery = function (p) {
    return [
      '<div class="p-cs__intro-gt">',
      '  <div class="c v--no-pad-mobile">',
      '    <div class="p-cs__intro-gt__grid">',
      '      <div data-visible="t" class="p-cs__layouts__full-gallery-intro">',
      '        <div class="p-cs__layouts__full-gallery__inner">',
      '          <div class="p-cs__layouts__gallery__slide v--intro">',
      '            <div data-swiper-intro="t" data-swiper-main="" class="swiper v--cs-f-gt">',
      '              <div class="swiper-wrapper"></div>',
      '            </div>',
      '          </div>',
      '          <div class="p-cs__layouts__gallery__thumbs v--intro">',
      '            <div data-swiper-thumb="" class="swiper v--cs-gal-thumb">',
      '              <div class="swiper-wrapper"></div>',
      '            </div>',
      '          </div>',
      ind(10, collection(p.media)),
      '        </div>',
      '      </div>',
      '      <div data-line-anim-bk="" data-visible-bk="" class="p-cs__intro-gt__text w-richtext">',
      ind(8, richText(p.html)),
      '      </div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
  };
  P.raw = function (p) {
    return String(p.html || '');
  };

  // newer pieces (styles in css/cs-blocks.*.css)
  function figure(m, cls, caption) {
    if (!m || !m.src) return '';
    var dims = (+m.w && +m.h) ? ' width="' + (+m.w) + '" height="' + (+m.h) + '"' : '';
    var inner = m.video
      ? '<video class="' + cls + '__media" muted="" loop="" playsinline="" preload="none" data-io-play="" poster="' + attr(m.src) + '"' + dims + '><source src="' + attr(m.video) + '" type="' + (/\.webm(\?|$)/i.test(m.video) ? 'video/webm' : 'video/mp4') + '" /></video>'
      : '<img class="' + cls + '__media" decoding="async" loading="lazy" src="' + attr(m.src) + '" alt="' + attr(m.alt || '') + '"' + dims + ' />';
    return '<figure class="' + cls + '__fig">' + inner + (caption ? '<figcaption class="p-cs__x-cap">' + esc(caption) + '</figcaption>' : '') + '</figure>';
  }
  P.image = function (p) {
    var fig = figure(p.media, 'p-cs__x-media', p.caption);
    if (!fig) return '';
    return ['<div class="p-cs__x-media' + (p.size === 'full' ? ' v--full' : '') + '">', '  <div class="c' + (p.size === 'full' ? ' v--cs-top' : '') + '">', '    ' + fig, '  </div>', '</div>'].join('\n');
  };
  P.duo = function (p) {
    var items = (p.items || []).slice(0, 2).map(function (m) { return figure(m, 'p-cs__x-duo', m && m.caption); }).filter(Boolean);
    if (!items.length) return '';
    var r = { square: ' v--square', portrait: ' v--portrait', landscape: ' v--landscape' }[p.ratio] || '';
    return ['<div class="p-cs__x-duo' + r + '">', '  <div class="c">', '    <div class="p-cs__x-duo__grid">', ind(6, items), '    </div>', '  </div>', '</div>'].join('\n');
  };
  P.stats = function (p) {
    var items = (p.items || []).filter(function (s) { return s && (s.value || s.label); }).slice(0, 4).map(function (s) {
      return '<div class="p-cs__x-stat"><div class="p-cs__x-stat__v">' + esc(s.value) + '</div><div class="p-cs__x-stat__l">' + esc(s.label) + '</div></div>';
    });
    if (!items.length) return '';
    return ['<div class="p-cs__x-stats">', '  <div class="c">', '    <div class="p-cs__x-stats__grid" data-count="' + items.length + '">', ind(6, items), '    </div>', '  </div>', '</div>'].join('\n');
  };
  P.quote = function (p) {
    if (!p.text) return '';
    return ['<div class="p-cs__x-quote">', '  <div class="c">', '    <blockquote class="p-cs__x-quote__q">',
      '      <p class="p-cs__x-quote__t">' + esc(p.text) + '</p>',
      p.who ? '      <cite class="p-cs__x-quote__who">' + esc(p.who) + '</cite>' : null,
      '    </blockquote>', '  </div>', '</div>'].filter(function (x) { return x !== null; }).join('\n');
  };

  // ---- more pieces ----
  function mediaList(list) {
    return (list || []).filter(function (m) { return m && m.src; });
  }
  P.grid = function (p) {
    var items = mediaList(p.media).slice(0, 12).map(function (m) { return figure(m, 'p-cs__x-grid', m.caption); });
    if (!items.length) return '';
    var v = { four: ' v--l4', mosaic: ' v--mosaic' }[p.layout] || ' v--l3';
    return ['<div class="p-cs__x-grid' + v + '">', '  <div class="c">', '    <div class="p-cs__x-grid__in" data-count="' + items.length + '">', ind(6, items), '    </div>', '  </div>', '</div>'].join('\n');
  };
  P.split = function (p) {
    var fig = figure(p.media, 'p-cs__x-split', p.caption);
    if (!fig && !p.html && !p.title) return '';
    return ['<div class="p-cs__x-split' + (p.side === 'right' ? ' v--right' : '') + '">', '  <div class="c">', '    <div class="p-cs__x-split__in">',
      fig ? '      ' + fig : null,
      '      <div class="p-cs__x-split__txt">',
      p.title ? '        <h3 class="p-cs__x-split__h">' + esc(p.title) + '</h3>' : null,
      p.html ? '        <div class="t-xl w-richtext">\n' + ind(10, String(p.html).trim()) + '\n        </div>' : null,
      '      </div>', '    </div>', '  </div>', '</div>'].filter(function (x) { return x !== null; }).join('\n');
  };
  P.compare = function (p) {
    var a = p.before, b = p.after;
    if (!a || !a.src || !b || !b.src) return '';
    var dims = (+b.w && +b.h) ? ' style="aspect-ratio:' + (+b.w) + ' / ' + (+b.h) + '"' : '';
    return ['<div class="p-cs__x-compare">', '  <div class="c">',
      '    <div class="p-cs__x-compare__frame" data-compare=""' + dims + '>',
      '      <img class="p-cs__x-compare__img" decoding="async" loading="lazy" src="' + attr(b.src) + '" alt="' + attr(b.alt || p.afterLabel || '') + '" />',
      '      <div class="p-cs__x-compare__before"><img class="p-cs__x-compare__img" decoding="async" loading="lazy" src="' + attr(a.src) + '" alt="' + attr(a.alt || p.beforeLabel || '') + '" /></div>',
      '      <span class="p-cs__x-compare__lbl v--before">' + esc(p.beforeLabel || 'Before') + '</span>',
      '      <span class="p-cs__x-compare__lbl v--after">' + esc(p.afterLabel || 'After') + '</span>',
      '      <span class="p-cs__x-compare__handle" aria-hidden="true"></span>',
      '      <input class="p-cs__x-compare__range" type="range" min="0" max="100" value="50" aria-label="Drag to compare ' + attr((p.beforeLabel || 'before') + ' and ' + (p.afterLabel || 'after')) + '" />',
      '    </div>', '  </div>', '</div>'].join('\n');
  };
  P.social = function (p) {
    var items = mediaList(p.media).slice(0, 8).map(function (m) { return figure(m, 'p-cs__x-social', m.caption); });
    if (!items.length) return '';
    return ['<div class="p-cs__x-social">', '  <div class="c">', '    <div class="p-cs__x-social__row" data-count="' + items.length + '">', ind(6, items), '    </div>', '  </div>', '</div>'].join('\n');
  };
  P.marquee = function (p) {
    var t = String(p.text || '').trim();
    if (!t) return '';
    var unit = '<span class="p-cs__x-marquee__unit">' + esc(t) + '</span>';
    var run = [unit, unit, unit, unit].join('');
    var speed = { slow: ' v--slow', fast: ' v--fast' }[p.speed] || '';
    return ['<div class="p-cs__x-marquee' + (p.style === 'outline' ? ' v--outline' : '') + speed + '" role="img" aria-label="' + attr(t) + '">',
      '  <div class="p-cs__x-marquee__track" aria-hidden="true"><div class="p-cs__x-marquee__run">' + run + '</div><div class="p-cs__x-marquee__run">' + run + '</div></div>',
      '</div>'].join('\n');
  };
  P.steps = function (p) {
    var items = (p.items || []).filter(function (s) { return s && (s.title || s.text); }).slice(0, 8);
    if (!items.length) return '';
    var li = items.map(function (s, i) {
      return '<li class="p-cs__x-step"><span class="p-cs__x-step__n">' + String(i + 1).padStart(2, '0') + '</span>' +
        (s.title ? '<h3 class="p-cs__x-step__t">' + esc(s.title) + '</h3>' : '') + (s.text ? '<p class="p-cs__x-step__p">' + esc(s.text) + '</p>' : '') + '</li>';
    });
    return ['<div class="p-cs__x-steps">', '  <div class="c">', '    <ol class="p-cs__x-steps__list" data-count="' + items.length + '">', ind(6, li), '    </ol>', '  </div>', '</div>'].join('\n');
  };
  P.credits = function (p) {
    var items = (p.items || []).filter(function (c) { return c && (c.role || c.name); }).slice(0, 24);
    if (!items.length) return '';
    var rows = items.map(function (c) { return '<div class="p-cs__x-credit"><dt>' + esc(c.role) + '</dt><dd>' + esc(c.name) + '</dd></div>'; });
    return ['<div class="p-cs__x-credits">', '  <div class="c">', '    <dl class="p-cs__x-credits__list">', ind(6, rows), '    </dl>', '  </div>', '</div>'].join('\n');
  };
  P.logos = function (p) {
    var items = mediaList(p.media).slice(0, 24).map(function (m) {
      var dims = (+m.w && +m.h) ? ' width="' + (+m.w) + '" height="' + (+m.h) + '"' : '';
      return '<li class="p-cs__x-logos__item"><img decoding="async" loading="lazy" src="' + attr(m.src) + '" alt="' + attr(m.alt || '') + '"' + dims + ' /></li>';
    });
    if (!items.length) return '';
    return ['<div class="p-cs__x-logos' + (p.tint === 'original' ? '' : ' v--mono') + '">', '  <div class="c">',
      p.title ? '    <h3 class="p-cs__x-logos__h">' + esc(p.title) + '</h3>' : null,
      '    <ul class="p-cs__x-logos__list">', ind(6, items), '    </ul>', '  </div>', '</div>'].filter(function (x) { return x !== null; }).join('\n');
  };

  function piece(p) {
    var f = p && P[p.type];
    return f ? f(p) : '';
  }
  function pieces(list, n) {
    return (list || []).map(piece).filter(Boolean).map(function (h) { return ind(n, h); }).join('\n');
  }

  // ---------- page ----------
  function body(d) {
    var out = [
      '<div class="p-cs__intro">',
      '  <div class="p-cs__layouts__intro">',
      '    <div class="c">',
      '      <div class="p-cs__layouts__intro__i">',
      '        <div class="p-cs__layouts__intro__top-w">',
      d.headline ? '          <h5 data-line-anim-bk="" data-visible-bk="" class="p-cs__layouts__intro__headline">' + d.headline + '</h5>' : null,
      '          <h2 data-line-anim-bk="" data-visible-bk="" class="p-cs__layouts__intro__top__text">' + (d.intro || '') + '</h2>',
      '        </div>',
      '      </div>',
      '    </div>',
      '  </div>'
    ].filter(function (x) { return x !== null; });
    var ip = pieces(d.introPieces, 4);
    out.push(ip ? '  <div class="p-cs__intro__content">\n' + ip + '\n  </div>' : '  <div class="p-cs__intro__content"></div>');
    out.push('</div>');
    var secs = (d.sections || []).map(function (s) {
      var ps = pieces(s.pieces, 4);
      return [
        '<div class="p-cs__block"' + (s.tone && TONES.indexOf(s.tone) >= 0 ? ' data-tone="' + s.tone + '"' : '') + '>',
        '  <div class="p-cs__block__title">',
        '    <h2 data-splitting="" class="p-cs__block__title__text">' + esc(s.title) + '</h2>',
        '    <div class="p-cs__block__title__icon"></div>',
        '  </div>',
        ps ? '  <div class="p-cs__block__content">\n' + ps + '\n  </div>' : '  <div class="p-cs__block__content"></div>',
        '</div>'
      ].join('\n');
    });
    out.push(secs.length ? '<div class="p-cs__layouts">\n' + ind(2, secs) + '\n</div>' : '<div class="p-cs__layouts"></div>');
    return ind(4, out) + '\n';
  }

  function meta(d) {
    var t = d.seoTitle || d.title || '';
    var desc = d.description || '';
    var img = d.heroImage && d.heroImage.src ? absUrl(d.heroImage.src) : '';
    var L = ['<title>' + esc(t) + '</title>'];
    if (desc) L.push('<meta content="' + attr(desc) + '" name="description" />');
    L.push('<meta content="' + attr(t) + '" property="og:title" />');
    if (desc) L.push('<meta content="' + attr(desc) + '" property="og:description" />');
    if (img) L.push('<meta content="' + attr(img) + '" property="og:image" />');
    L.push('<meta content="' + attr(t) + '" name="twitter:title" />');
    if (desc) L.push('<meta content="' + attr(desc) + '" name="twitter:description" />');
    if (img) L.push('<meta content="' + attr(img) + '" name="twitter:image" />');
    L.push('<meta property="og:type" content="website" />');
    L.push('<meta content="summary_large_image" name="twitter:card" />');
    return ind(4, L) + '\n';
  }

  // Hero bubbles: awards first (filled), then services. Both link to the Work page filtered.
  function heroServices(list, awards) {
    list = (awards || []).map(function (a) { return { name: a.name, slug: a.slug, award: true }; }).concat(list || []);
    if (!list.length) {
      return ['            <div class="w-dyn-empty">', '              <div>No items found.</div>', '            </div>', ''].join('\n');
    }
    var items = list.map(function (s) {
      return [
        '<div role="listitem" class="w-dyn-item">',
        '  <div class="w-embed w-script">',
        '    <script>',
        '      window.heroServices = window.heroServices || [];',
        '      window.heroServices.push({',
        "        name: '" + jsq(s.name) + "',",
        "        slug: '" + jsq(s.slug || slugify(s.name)) + "'" + (s.award ? ',' : ''),
        s.award ? '        award: true' : null,
        '      });',
        '    </script>',
        '  </div>',
        '</div>'
      ].filter(function (l) { return l !== null; }).join('\n');
    });
    return '            <div role="list" class="w-dyn-items">\n' + ind(14, items) + '\n            </div>\n';
  }

  function heroImg(img) {
    if (!img || !img.src) return '<img decoding="async" alt="" loading="eager" data-vis="2" id="p-cs__hero__img" src="" class="p-cs__hero__img" />';
    return '<img decoding="async" alt="" loading="eager" data-vis="2" id="p-cs__hero__img" src="' + attr(img.src) + '"' +
      (img.sizes ? ' sizes="' + attr(img.sizes) + '"' : '') + (img.srcset ? ' srcset="' + attr(img.srcset) + '"' : '') + ' class="p-cs__hero__img" />';
  }

  function newPageId() {
    var s = '';
    for (var i = 0; i < 24; i++) s += '0123456789abcdef'.charAt(Math.floor(Math.random() * 16));
    return s;
  }

  function page(template, d) {
    var stats = d.stats || [];
    var vals = {
      pageId: d.pageId || newPageId(),
      meta: meta(d),
      robots: d.noindex ? '    <meta content="noindex" name="robots" />\n' : '',
      services: heroServices(d.services, d.awards),
      title: esc(d.title),
      client: esc(d.client),
      subtitle: esc(d.subtitle),
      heroImg: heroImg(d.heroImage),
      heroVimeo: esc(d.heroVimeo || ''),
      body: body(d)
    };
    for (var i = 0; i < 4; i++) {
      vals['stat' + (i + 1) + 'v'] = esc(stats[i] ? stats[i].value : '');
      vals['stat' + (i + 1) + 'l'] = esc(stats[i] ? stats[i].label : '');
    }
    return template.replace(/\{\{(\w+)\}\}/g, function (m, k) {
      return Object.prototype.hasOwnProperty.call(vals, k) ? vals[k] : m;
    });
  }

  // ---------- listings ----------
  function workItem(d) {
    var w = (d.listing && d.listing.work) || {};
    var name = d.title || '';
    var client = d.client;
    var services = (d.services || []).slice(0, 5); // the Work list shows up to five
    var awards = d.awards || [];
    var href = w.href || '/case-study/' + d.slug;
    var bg = w.bg;
    var cats = services.length || awards.length
      ? '    <div role="list" class="p-home__list__items-link__categories w-dyn-items">\n' + awards.map(function (a) {
        return '      <div data-btn-splitting="" data-filter-award="' + attr(a.slug || slugify(a.name)) + '" data-splitting="" role="listitem" class="p-home__list__items-link__category is-award w-dyn-item">\n        <div>' + esc(a.name) + '</div>\n      </div>';
      }).concat(services.map(function (s) {
        return '      <div data-btn-splitting="" data-filter-cat="' + attr(s.slug || slugify(s.name)) + '" data-splitting="" role="listitem" class="p-home__list__items-link__category w-dyn-item">\n        <div>' + esc(s.name) + '</div>\n      </div>';
      })).join('\n') + '\n    </div>'
      : '    <div class="w-dyn-empty">\n      <div>No items found.</div>\n    </div>';
    var img = '';
    if (bg && bg.src) {
      img = '<img decoding="async"' + (bg['data-bg'] ? ' data-bg="' + attr(bg['data-bg']) + '"' : '') + ' loading="lazy" src="' + attr(bg.src) + '" alt="' + attr(bg.alt || '') + '"' +
        (bg.sizes ? ' sizes="' + attr(bg.sizes) + '"' : '') + (bg.srcset ? ' srcset="' + attr(bg.srcset) + '"' : '') + ' class="p-home__list__items-bg" />';
    }
    var t = esc(name);
    return [
      '<div data-month="' + attr(w.month || '') + '" data-year="' + attr(w.year || '') + '" role="listitem" class="p-home__list__items-item w-dyn-item"><a data-reset-anim-hover="" data-link="' + attr(d.slug) + '" data-page-transition="red" data-page-transition-direction="vertical" data-custom-mouse-bk="view" href="' + attr(href) + '" class="p-home__list__items-link w-inline-block">',
      '    <div class="p-home__list__items-left">',
      '      <h6 class="p-home__list__items-left__client">' + esc(client) + '</h6>',
      '      <div class="p-home__list__items-left__t-w">',
      '        <div data-title-splitting="" data-splitting="" class="t-title">' + t + '</div>',
      '        <div data-marquee="left" class="p-home__list__items-left__title hide">',
      '          <div data-marquee-content="">',
      '            <div data-splitting="" data-marquee-content-bk="" data-title-splitting="" class="t-title no-wrap">' + t + '</div>',
      '          </div>',
      '          <div data-marquee-content="">',
      '            <div data-splitting="" data-marquee-content-bk="" data-title-splitting="" class="t-title no-wrap">' + t + '</div>',
      '          </div>',
      '        </div>',
      '      </div>',
      '    </div>',
      '    <div id="w-node-_79cea740-11e2-0e4a-52fb-259ed91a2f07-a6a8c77e" class="p-home__list__items-summary">',
      w.summary ? '      <div>' + w.summary + '</div>' : '      <div class="w-dyn-bind-empty"></div>',
      '    </div>',
      '    <div id="w-node-f97dafc0-f62a-ba6f-a3f9-891c755a8af0-a6a8c77e" class="p-home__list__items-services"></div>',
      '  </a>',
      '  <div class="hide w-dyn-list">',
      cats,
      '  </div>' + img,
      '</div>'
    ].join('\n');
  }

  function cmsItem(d) {
    var c = (d.listing && d.listing.home) || {};
    var services = d.services || [];
    function q(k, v) { return '    <div class="q-' + k + '">' + esc(v == null ? '' : v) + '</div>'; }
    var svc = services.length
      ? '    <div role="list" class="w-dyn-items">\n' + services.map(function (s) {
        return ['      <div role="listitem" class="w-dyn-item">',
          '        <div class="q-services-item w-embed">',
          '          <div class="q-services-title">' + esc(s.name) + '</div>',
          '          <div class="q-services-slug">' + esc(s.slug || slugify(s.name)) + '</div>',
          '        </div>',
          '      </div>'].join('\n');
      }).join('\n') + '\n    </div>'
      : '    <div class="w-dyn-empty"></div>';
    return [
      '<div role="listitem" class="w-dyn-item">',
      '  <div class="q-item w-embed">',
      q('name', d.title),
      q('slug', d.slug),
      q('show-homepage', c.showHomepage ? 'true' : 'false'),
      q('category', c.category),
      q('image', c.image),
      q('gif', c.gif),
      q('client', d.client),
      q('vimeo', c.vimeo),
      q('ip', c.ip),
      q('is-award', c.award ? 'true' : 'false'),
      q('award-title', c.awardTitle),
      q('award-logo-1', c.awardLogo1),
      q('award-logo-2', c.awardLogo2),
      '  </div>',
      '  ' + (c.video || '<div class="q-video w-dyn-bind-empty w-video w-embed"></div>'),
      '  <div class="w-dyn-list">',
      svc,
      '  </div>',
      '</div>'
    ].join('\n');
  }

  // sort key used by the Work list (alphabetical by name, letters and digits only)
  function sortKey(name) {
    return String(name || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
  }

  function indexEntry(d) {
    var l = d.listing || {};
    var home = l.home || {};
    return {
      slug: d.slug,
      title: d.title || '',
      client: d.client || '',
      listed: !!l.listed,
      homepage: !!(l.listed && home.showHomepage),
      noindex: !!d.noindex,
      thumb: home.image || (d.heroImage && d.heroImage.src) || '',
      updatedAt: d.updatedAt || '',
      // for filtering and sorting the builder's list
      category: home.category || '',
      year: (l.work && l.work.year) || '',
      month: (l.work && l.work.month) || '',
      services: (d.services || []).map(function (x) { return x.name; }).filter(Boolean),
      awards: (d.awards || []).map(function (x) { return x.name; }).filter(Boolean),
      sections: (d.sections || []).length
    };
  }

  // ---------- splicing one case study into the shared list files ----------
  // Each returns the updated file text, or throws if the file's structure isn't recognized.
  function itemRanges(text, listStart, listEnd, startRx) {
    var starts = [];
    var m;
    startRx.lastIndex = listStart;
    while ((m = startRx.exec(text)) && m.index < listEnd) starts.push(m.index);
    return starts.map(function (s, i) { return [s, i + 1 < starts.length ? starts[i + 1] : listEnd]; });
  }

  function spliceWork(text, d) {
    var open = '<div id="p-home__list__items-list" role="list" class="p-home__list__items-list v--padding w-dyn-items">';
    var a = text.indexOf(open);
    if (a < 0) throw new Error('Work list not found in work.html');
    var listStart = a + open.length;
    var listEnd = text.indexOf('\n        </div>', listStart);
    var ranges = itemRanges(text, listStart, listEnd, /\n {10}<div data-month="[^"]*" data-year="[^"]*" role="listitem" class="p-home__list__items-item w-dyn-item">/g);
    if (!ranges.length) throw new Error('No Work items found in work.html');
    var mark = 'data-link="' + d.slug + '"';
    var items = ranges.map(function (r) { return text.slice(r[0], r[1]); });
    var kept = items.filter(function (it) { return it.indexOf(mark) < 0; });
    if (d.listing && d.listing.listed) {
      var html = '\n' + ind(10, workItem(d));
      var key = sortKey(d.title);
      var at = kept.length;
      for (var i = 0; i < kept.length; i++) {
        var t = /class="t-title">([^<]*)</.exec(kept[i]);
        if (t && sortKey(t[1].replace(/&amp;/g, '&').replace(/&#x27;/g, "'")) > key) { at = i; break; }
      }
      kept.splice(at, 0, html);
    }
    return text.slice(0, ranges[0][0]) + kept.join('') + text.slice(listEnd);
  }

  function spliceCms(text, d) {
    var open = '<div class="w-dyn-list">\n      <div role="list" class="w-dyn-items">';
    var a = text.indexOf(open);
    if (a < 0) throw new Error('Project list not found in cms/cs.html');
    var listStart = a + open.length;
    var listEnd = text.indexOf('\n      </div>\n    </div>', listStart);
    var ranges = itemRanges(text, listStart, listEnd, /\n {8}<div role="listitem" class="w-dyn-item">\n {10}<div class="q-item w-embed">/g);
    if (!ranges.length) throw new Error('No projects found in cms/cs.html');
    var mark = '<div class="q-slug">' + d.slug + '</div>';
    var items = ranges.map(function (r) { return text.slice(r[0], r[1]); });
    var pos = -1;
    var kept = [];
    items.forEach(function (it, i) { if (it.indexOf(mark) >= 0) pos = i; else kept.push(it); });
    if (d.listing && d.listing.listed) kept.splice(pos >= 0 ? pos : 0, 0, '\n' + ind(8, cmsItem(d)));
    return text.slice(0, ranges[0][0]) + kept.join('') + text.slice(listEnd);
  }

  function spliceSitemap(text, d) {
    var loc = '  <url><loc>' + SITE + '/case-study/' + d.slug + '</loc></url>\n';
    var has = text.indexOf(loc) >= 0;
    var want = !!(d.listing && d.listing.listed) && !d.noindex;
    if (has && !want) return text.replace(loc, '');
    if (!has && want) {
      var end = text.lastIndexOf('</urlset>');
      if (end < 0) throw new Error('sitemap.xml has no </urlset>');
      return text.slice(0, end) + loc + text.slice(end);
    }
    return text;
  }

  function spliceIndex(text, d) {
    var idx = JSON.parse(text);
    var e = indexEntry(d);
    var i = idx.caseStudies.findIndex(function (c) { return c.slug === d.slug; });
    if (i >= 0) idx.caseStudies[i] = e; else idx.caseStudies.push(e);
    idx.caseStudies.sort(function (a, b) { return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0; });
    (d.services || []).forEach(function (s) {
      if (!idx.services.some(function (x) { return x.slug === s.slug; })) idx.services.push({ name: s.name, slug: s.slug });
    });
    idx.services.sort(function (a, b) { return a.name.localeCompare(b.name); });
    idx.awards = idx.awards || [];
    (d.awards || []).forEach(function (s) {
      if (!idx.awards.some(function (x) { return x.slug === s.slug; })) idx.awards.push({ name: s.name, slug: s.slug });
    });
    idx.awards.sort(function (a, b) { return a.name.localeCompare(b.name); });
    var cat = d.listing && d.listing.home && d.listing.home.category;
    if (cat && idx.categories.indexOf(cat) < 0) { idx.categories.push(cat); idx.categories.sort(); }
    return JSON.stringify(idx, null, 1) + '\n';
  }

  return {
    page: page, body: body, meta: meta, piece: piece, workItem: workItem, cmsItem: cmsItem, TONES: TONES,
    indexEntry: indexEntry, spliceWork: spliceWork, spliceCms: spliceCms, spliceSitemap: spliceSitemap, spliceIndex: spliceIndex,
    esc: esc, attr: attr, slugify: slugify, sortKey: sortKey, newPageId: newPageId, ind: ind, absUrl: absUrl
  };
});
