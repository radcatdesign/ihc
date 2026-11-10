
/*!
 * Front-end site runtime
 * @license MIT
 * Inline scripts may access the api using an async handler:
 *   var SiteJS = SiteJS || [];
 *   SiteJS.push(readyFunction);
 */

(() => { // webpackBootstrap
var __webpack_modules__ = ({
4345: (function (module, __unused_webpack_exports, __webpack_require__) {
"use strict";
/* global window, document */ /**
 * SiteJS: Slider component
 */ 
var SiteJS = __webpack_require__(3949);
var IXEvents = __webpack_require__(5134);
const KEY_CODES = {
    ARROW_LEFT: 37,
    ARROW_UP: 38,
    ARROW_RIGHT: 39,
    ARROW_DOWN: 40,
    SPACE: 32,
    ENTER: 13,
    HOME: 36,
    END: 35
};
const FOCUSABLE_SELECTOR = 'a[href], area[href], [role="button"], input, select, textarea, button, iframe, object, embed, *[tabindex], *[contenteditable]';
SiteJS.define('slider', module.exports = function($, _) {
    var api = {};
    var tram = $.tram;
    var $doc = $(document);
    var $sliders;
    var designer;
    var inApp = SiteJS.env();
    var namespace = '.w-slider';
    var dot = '<div class="w-slider-dot" data-ihc-ignore />';
    var ariaLiveLabelHtml = '<div aria-live="off" aria-atomic="true" class="w-slider-aria-label" data-ihc-ignore />';
    var forceShow = 'w-slider-force-show';
    var ix = IXEvents.triggers;
    var fallback;
    var inRedraw = false;
    // -----------------------------------
    // Module methods
    api.ready = function() {
        designer = SiteJS.env('design');
        init();
    };
    api.design = function() {
        designer = true;
        // Helps slider init on Designer load.
        setTimeout(init, 1000);
    };
    api.preview = function() {
        designer = false;
        init();
    };
    api.redraw = function() {
        inRedraw = true;
        init();
        inRedraw = false;
    };
    api.destroy = removeListeners;
    // -----------------------------------
    // Private methods
    function init() {
        // Find all sliders on the page
        $sliders = $doc.find(namespace);
        if (!$sliders.length) {
            return;
        }
        $sliders.each(build);
        if (fallback) {
            return;
        }
        removeListeners();
        addListeners();
    }
    function removeListeners() {
        SiteJS.resize.off(renderAll);
        SiteJS.redraw.off(api.redraw);
    }
    function addListeners() {
        SiteJS.resize.on(renderAll);
        SiteJS.redraw.on(api.redraw);
    }
    function renderAll() {
        $sliders.filter(':visible').each(render);
    }
    function build(i, el) {
        var $el = $(el);
        // Store slider state in data
        var data = $.data(el, namespace);
        if (!data) {
            data = $.data(el, namespace, {
                index: 0,
                depth: 1,
                hasFocus: {
                    keyboard: false,
                    mouse: false
                },
                el: $el,
                config: {}
            });
        }
        data.mask = $el.children('.w-slider-mask');
        data.left = $el.children('.w-slider-arrow-left');
        data.right = $el.children('.w-slider-arrow-right');
        data.nav = $el.children('.w-slider-nav');
        data.slides = data.mask.children('.w-slide');
        data.slides.each(ix.reset);
        if (inRedraw) {
            data.maskWidth = 0;
        }
        if ($el.attr('role') === undefined) {
            $el.attr('role', 'region');
        }
        if ($el.attr('aria-label') === undefined) {
            $el.attr('aria-label', 'carousel');
        }
        // Store the ID of the slider slide view mask
        var slideViewId = data.mask.attr('id');
        // If user did not provide an ID, set it
        if (!slideViewId) {
            slideViewId = 'w-slider-mask-' + i;
            data.mask.attr('id', slideViewId);
        }
        // Create aria live label
        if (!designer && !data.ariaLiveLabel) {
            data.ariaLiveLabel = $(ariaLiveLabelHtml).appendTo(data.mask);
        }
        // Add attributes to left/right buttons
        data.left.attr('role', 'button');
        data.left.attr('tabindex', '0');
        data.left.attr('aria-controls', slideViewId);
        if (data.left.attr('aria-label') === undefined) {
            data.left.attr('aria-label', 'previous slide');
        }
        data.right.attr('role', 'button');
        data.right.attr('tabindex', '0');
        data.right.attr('aria-controls', slideViewId);
        if (data.right.attr('aria-label') === undefined) {
            data.right.attr('aria-label', 'next slide');
        }
        // Disable in old browsers
        if (!tram.support.transform) {
            data.left.hide();
            data.right.hide();
            data.nav.hide();
            fallback = true;
            return;
        }
        // Remove old events
        data.el.off(namespace);
        data.left.off(namespace);
        data.right.off(namespace);
        data.nav.off(namespace);
        // Set config from data attributes
        configure(data);
        // Add events based on mode
        if (designer) {
            data.el.on('setting' + namespace, handler(data));
            stopTimer(data);
            data.hasTimer = false;
        } else {
            data.el.on('swipe' + namespace, handler(data));
            data.left.on('click' + namespace, previousFunction(data));
            data.right.on('click' + namespace, next(data));
            data.left.on('keydown' + namespace, keyboardSlideButtonsFunction(data, previousFunction));
            data.right.on('keydown' + namespace, keyboardSlideButtonsFunction(data, next));
            // Listen to nav keyboard events
            data.nav.on('keydown' + namespace, '> div', handler(data));
            // Start timer if autoplay is true, only once
            if (data.config.autoplay && !data.hasTimer) {
                data.hasTimer = true;
                data.timerCount = 1;
                startTimer(data);
            }
            data.el.on('mouseenter' + namespace, hasFocus(data, true, 'mouse'));
            data.el.on('focusin' + namespace, hasFocus(data, true, 'keyboard'));
            data.el.on('mouseleave' + namespace, hasFocus(data, false, 'mouse'));
            data.el.on('focusout' + namespace, hasFocus(data, false, 'keyboard'));
        }
        // Listen to nav click events
        data.nav.on('click' + namespace, '> div', handler(data));
        // Remove gaps from formatted html (for inline-blocks)
        if (!inApp) {
            data.mask.contents().filter(function() {
                return this.nodeType === 3;
            }).remove();
        }
        // If slider or any parent is hidden, temporarily show for measurements (upstream issue 24921)
        var $elHidden = $el.filter(':hidden');
        $elHidden.addClass(forceShow);
        var $elHiddenParents = $el.parents(':hidden');
        $elHiddenParents.addClass(forceShow);
        // Run first render
        if (!inRedraw) {
            render(i, el);
        }
        // If slider or any parent is hidden, reset after temporarily showing for measurements
        $elHidden.removeClass(forceShow);
        $elHiddenParents.removeClass(forceShow);
    }
    function configure(data) {
        var config = {};
        config.crossOver = 0;
        // Set config options from data attributes
        config.animation = data.el.attr('data-animation') || 'slide';
        if (config.animation === 'outin') {
            config.animation = 'cross';
            config.crossOver = 0.5;
        }
        config.easing = data.el.attr('data-easing') || 'ease';
        var duration = data.el.attr('data-duration');
        config.duration = duration != null ? parseInt(duration, 10) : 500;
        if (isAttrTrue(data.el.attr('data-infinite'))) {
            config.infinite = true;
        }
        if (isAttrTrue(data.el.attr('data-disable-swipe'))) {
            config.disableSwipe = true;
        }
        if (isAttrTrue(data.el.attr('data-hide-arrows'))) {
            config.hideArrows = true;
        } else if (data.config.hideArrows) {
            data.left.show();
            data.right.show();
        }
        if (isAttrTrue(data.el.attr('data-autoplay'))) {
            config.autoplay = true;
            config.delay = parseInt(data.el.attr('data-delay'), 10) || 2000;
            config.timerMax = parseInt(data.el.attr('data-autoplay-limit'), 10);
            // Disable timer on first touch or mouse down
            var touchEvents = 'mousedown' + namespace + ' touchstart' + namespace;
            if (!designer) {
                data.el.off(touchEvents).one(touchEvents, function() {
                    stopTimer(data);
                });
            }
        }
        // Use edge buffer to help calculate page count
        var arrowWidth = data.right.width();
        config.edge = arrowWidth ? arrowWidth + 40 : 100;
        // Store config in data
        data.config = config;
    }
    function isAttrTrue(value) {
        return value === '1' || value === 'true';
    }
    function hasFocus(data, focusIn, eventType) {
        return function(evt) {
            if (!focusIn) {
                // Prevent Focus Out if moving to another element in the slider
                if ($.contains(data.el.get(0), evt.relatedTarget)) {
                    return;
                }
                data.hasFocus[eventType] = focusIn;
                // Prevent Aria live change if focused by other input
                if (data.hasFocus.mouse && eventType === 'keyboard' || data.hasFocus.keyboard && eventType === 'mouse') {
                    return;
                }
            } else {
                data.hasFocus[eventType] = focusIn;
            }
            if (focusIn) {
                data.ariaLiveLabel.attr('aria-live', 'polite');
                if (data.hasTimer) {
                    stopTimer(data);
                }
            } else {
                data.ariaLiveLabel.attr('aria-live', 'off');
                if (data.hasTimer) {
                    startTimer(data);
                }
            }
            return;
        };
    }
    function keyboardSlideButtonsFunction(data, directionFunction) {
        return function(evt) {
            switch(evt.keyCode){
                case KEY_CODES.SPACE:
                case KEY_CODES.ENTER:
                    {
                        // DirectionFunction returns a function
                        directionFunction(data)();
                        evt.preventDefault();
                        return evt.stopPropagation();
                    }
            }
        };
    }
    function previousFunction(data) {
        return function() {
            change(data, {
                index: data.index - 1,
                vector: -1
            });
        };
    }
    function next(data) {
        return function() {
            change(data, {
                index: data.index + 1,
                vector: 1
            });
        };
    }
    function select(data, value) {
        // Select page based on slide element index
        var found = null;
        if (value === data.slides.length) {
            init();
            layout(data); // Rebuild and find new slides
        }
        _.each(data.anchors, function(anchor, index) {
            $(anchor.els).each(function(i, el) {
                if ($(el).index() === value) {
                    found = index;
                }
            });
        });
        if (found != null) {
            change(data, {
                index: found,
                immediate: true
            });
        }
    }
    function startTimer(data) {
        stopTimer(data);
        var config = data.config;
        var timerMax = config.timerMax;
        if (timerMax && data.timerCount++ > timerMax) {
            return;
        }
        data.timerId = window.setTimeout(function() {
            if (data.timerId == null || designer) {
                return;
            }
            next(data)();
            startTimer(data);
        }, config.delay);
    }
    function stopTimer(data) {
        window.clearTimeout(data.timerId);
        data.timerId = null;
    }
    function handler(data) {
        return function(evt, options) {
            options = options || {};
            var config = data.config;
            // Designer settings
            if (designer && evt.type === 'setting') {
                if (options.select === 'prev') {
                    return previousFunction(data)();
                }
                if (options.select === 'next') {
                    return next(data)();
                }
                configure(data);
                layout(data);
                if (options.select == null) {
                    return;
                }
                select(data, options.select);
                return;
            }
            // Swipe event
            if (evt.type === 'swipe') {
                if (config.disableSwipe) {
                    return;
                }
                if (SiteJS.env('editor')) {
                    return;
                }
                if (options.direction === 'left') {
                    return next(data)();
                }
                if (options.direction === 'right') {
                    return previousFunction(data)();
                }
                return;
            }
            // Page buttons
            if (data.nav.has(evt.target).length) {
                var index = $(evt.target).index();
                if (evt.type === 'click') {
                    change(data, {
                        index
                    });
                }
                if (evt.type === 'keydown') {
                    switch(evt.keyCode){
                        case KEY_CODES.ENTER:
                        case KEY_CODES.SPACE:
                            {
                                change(data, {
                                    index
                                });
                                evt.preventDefault();
                                break;
                            }
                        case KEY_CODES.ARROW_LEFT:
                        case KEY_CODES.ARROW_UP:
                            {
                                focusDot(data.nav, Math.max(index - 1, 0));
                                evt.preventDefault();
                                break;
                            }
                        case KEY_CODES.ARROW_RIGHT:
                        case KEY_CODES.ARROW_DOWN:
                            {
                                focusDot(data.nav, Math.min(index + 1, data.pages));
                                evt.preventDefault();
                                break;
                            }
                        case KEY_CODES.HOME:
                            {
                                focusDot(data.nav, 0);
                                evt.preventDefault();
                                break;
                            }
                        case KEY_CODES.END:
                            {
                                focusDot(data.nav, data.pages);
                                evt.preventDefault();
                                break;
                            }
                        default:
                            {
                                return;
                            }
                    }
                }
            }
        };
    }
    function focusDot($nav, index) {
        // Focus nav dot; don't change class to active
        var $active = $nav.children().eq(index).focus();
        $nav.children().not($active);
    }
    function change(data, options) {
        options = options || {};
        var config = data.config;
        var anchors = data.anchors;
        // Set new index
        data.previous = data.index;
        var index = options.index;
        var shift = {};
        if (index < 0) {
            index = anchors.length - 1;
            if (config.infinite) {
                // Shift first slide to the end
                shift.x = -data.endX;
                shift.from = 0;
                shift.to = anchors[0].width;
            }
        } else if (index >= anchors.length) {
            index = 0;
            if (config.infinite) {
                // Shift last slide to the start
                shift.x = anchors[anchors.length - 1].width;
                shift.from = -anchors[anchors.length - 1].x;
                shift.to = shift.from - shift.x;
            }
        }
        data.index = index;
        // Notify the designer MiniToolbar about slide changes triggered
        // from within the site iframe (e.g. nav-dot clicks). The React
        // hook useSliderControls listens for this event to keep its
        // miniToolbarCurrentSlideId state in sync.
        if (designer) {
            data.el[0].dispatchEvent(new CustomEvent('wf-slider-change', {
                detail: {
                    index
                },
                bubbles: true
            }));
        }
        // Select nav dot; set class active
        var $active = data.nav.children().eq(index).addClass('w-active').attr('aria-pressed', 'true').attr('tabindex', '0');
        data.nav.children().not($active).removeClass('w-active').attr('aria-pressed', 'false').attr('tabindex', '-1');
        // Hide arrows
        if (config.hideArrows) {
            data.index === anchors.length - 1 ? data.right.hide() : data.right.show();
            data.index === 0 ? data.left.hide() : data.left.show();
        }
        // Get page offset from anchors
        var lastOffsetX = data.offsetX || 0;
        var offsetX = data.offsetX = -anchors[data.index].x;
        var resetConfig = {
            x: offsetX,
            opacity: 1,
            visibility: ''
        };
        // Transition slides
        var targets = $(anchors[data.index].els);
        var prevTargs = $(anchors[data.previous] && anchors[data.previous].els);
        var others = data.slides.not(targets);
        var animation = config.animation;
        var easing = config.easing;
        var duration = Math.round(config.duration);
        var vector = options.vector || (data.index > data.previous ? 1 : -1);
        var fadeRule = 'opacity ' + duration + 'ms ' + easing;
        var slideRule = 'transform ' + duration + 'ms ' + easing;
        // Make active slides' content focusable
        targets.find(FOCUSABLE_SELECTOR).removeAttr('tabindex');
        targets.removeAttr('aria-hidden');
        // Voiceover bug: Sometimes descendants are still visible, so hide everything...
        targets.find('*').removeAttr('aria-hidden');
        // Prevent focus on inactive slides' content
        others.find(FOCUSABLE_SELECTOR).attr('tabindex', '-1');
        others.attr('aria-hidden', 'true');
        // Voiceover bug: Sometimes descendants are still visible, so hide everything...
        others.find('*').attr('aria-hidden', 'true');
        // Trigger IX events
        if (!designer) {
            targets.each(ix.intro);
            others.each(ix.outro);
        }
        // Set immediately after layout changes (but not during redraw)
        if (options.immediate && !inRedraw) {
            tram(targets).set(resetConfig);
            resetOthers();
            return;
        }
        // Exit early if index is unchanged
        if (data.index === data.previous) {
            return;
        }
        // Announce slide change to screen reader
        if (!designer) {
            data.ariaLiveLabel.text(`Slide ${index + 1} of ${anchors.length}.`);
        }
        // Cross Fade / Out-In
        if (animation === 'cross') {
            var reduced = Math.round(duration - duration * config.crossOver);
            var wait = Math.round(duration - reduced);
            fadeRule = 'opacity ' + reduced + 'ms ' + easing;
            tram(prevTargs).set({
                visibility: ''
            }).add(fadeRule).start({
                opacity: 0
            });
            tram(targets).set({
                visibility: '',
                x: offsetX,
                opacity: 0,
                zIndex: data.depth++
            }).add(fadeRule).wait(wait).then({
                opacity: 1
            }).then(resetOthers);
            return;
        }
        // Fade Over
        if (animation === 'fade') {
            tram(prevTargs).set({
                visibility: ''
            }).stop();
            tram(targets).set({
                visibility: '',
                x: offsetX,
                opacity: 0,
                zIndex: data.depth++
            }).add(fadeRule).start({
                opacity: 1
            }).then(resetOthers);
            return;
        }
        // Slide Over
        if (animation === 'over') {
            resetConfig = {
                x: data.endX
            };
            tram(prevTargs).set({
                visibility: ''
            }).stop();
            tram(targets).set({
                visibility: '',
                zIndex: data.depth++,
                x: offsetX + anchors[data.index].width * vector
            }).add(slideRule).start({
                x: offsetX
            }).then(resetOthers);
            return;
        }
        // Slide - infinite scroll
        if (config.infinite && shift.x) {
            tram(data.slides.not(prevTargs)).set({
                visibility: '',
                x: shift.x
            }).add(slideRule).start({
                x: offsetX
            });
            tram(prevTargs).set({
                visibility: '',
                x: shift.from
            }).add(slideRule).start({
                x: shift.to
            });
            data.shifted = prevTargs;
        } else {
            if (config.infinite && data.shifted) {
                tram(data.shifted).set({
                    visibility: '',
                    x: lastOffsetX
                });
                data.shifted = null;
            }
            // Slide - basic scroll
            tram(data.slides).set({
                visibility: ''
            }).add(slideRule).start({
                x: offsetX
            });
        }
        // Helper to move others out of view
        function resetOthers() {
            targets = $(anchors[data.index].els);
            others = data.slides.not(targets);
            if (animation !== 'slide') {
                resetConfig.visibility = 'hidden';
            }
            tram(others).set(resetConfig);
        }
    }
    function render(i, el) {
        var data = $.data(el, namespace);
        if (!data) {
            return;
        }
        if (maskChanged(data)) {
            return layout(data);
        }
        if (designer && slidesChanged(data)) {
            layout(data);
        }
    }
    function layout(data) {
        // Determine page count from width of slides
        var pages = 1;
        var offset = 0;
        var anchor = 0;
        var width = 0;
        var maskWidth = data.maskWidth;
        var threshold = maskWidth - data.config.edge;
        if (threshold < 0) {
            threshold = 0;
        }
        data.anchors = [
            {
                els: [],
                x: 0,
                width: 0
            }
        ];
        data.slides.each(function(i, el) {
            if (anchor - offset > threshold) {
                pages++;
                offset += maskWidth;
                // Store page anchor for transition
                data.anchors[pages - 1] = {
                    els: [],
                    x: anchor,
                    width: 0
                };
            }
            // Set next anchor using current width + margin
            width = $(el).outerWidth(true);
            anchor += width;
            data.anchors[pages - 1].width += width;
            data.anchors[pages - 1].els.push(el);
            var ariaLabel = i + 1 + ' of ' + data.slides.length;
            $(el).attr('aria-label', ariaLabel);
            $(el).attr('role', 'group');
        });
        data.endX = anchor;
        // Build dots if nav exists and needs updating
        if (designer) {
            data.pages = null;
        }
        if (data.nav.length && data.pages !== pages) {
            data.pages = pages;
            buildNav(data);
        }
        // Make sure index is still within range and call change handler
        var index = data.index;
        if (index >= pages) {
            index = pages - 1;
        }
        change(data, {
            immediate: true,
            index
        });
    }
    function buildNav(data) {
        var dots = [];
        var $dot;
        var spacing = data.el.attr('data-nav-spacing');
        if (spacing) {
            spacing = parseFloat(spacing) + 'px';
        }
        for(var i = 0, len = data.pages; i < len; i++){
            $dot = $(dot);
            $dot.attr('aria-label', 'Show slide ' + (i + 1) + ' of ' + len).attr('aria-pressed', 'false').attr('role', 'button').attr('tabindex', '-1');
            if (data.nav.hasClass('w-num')) {
                $dot.text(i + 1);
            }
            if (spacing != null) {
                $dot.css({
                    'margin-left': spacing,
                    'margin-right': spacing
                });
            }
            dots.push($dot);
        }
        data.nav.empty().append(dots);
    }
    function maskChanged(data) {
        var maskWidth = data.mask.width();
        if (data.maskWidth !== maskWidth) {
            data.maskWidth = maskWidth;
            return true;
        }
        return false;
    }
    function slidesChanged(data) {
        var slidesWidth = 0;
        data.slides.each(function(i, el) {
            slidesWidth += $(el).outerWidth(true);
        });
        if (data.slidesWidth !== slidesWidth) {
            data.slidesWidth = slidesWidth;
            return true;
        }
        return false;
    }
    // Export module
    return api;
});

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3NoYXJlZC9yZW5kZXIvcGx1Z2lucy9TbGlkZXIvd2ViZmxvdy1zbGlkZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyogZ2xvYmFsIHdpbmRvdywgZG9jdW1lbnQgKi9cblxuLyoqXG4gKiBXZWJmbG93OiBTbGlkZXIgY29tcG9uZW50XG4gKi9cblxudmFyIFdlYmZsb3cgPSByZXF1aXJlKCcuLi9CYXNlU2l0ZU1vZHVsZXMvd2ViZmxvdy1saWInKTtcbnZhciBJWEV2ZW50cyA9IHJlcXVpcmUoJy4uL0Jhc2VTaXRlTW9kdWxlcy93ZWJmbG93LWl4Mi1ldmVudHMnKTtcblxuY29uc3QgS0VZX0NPREVTID0ge1xuICBBUlJPV19MRUZUOiAzNyxcbiAgQVJST1dfVVA6IDM4LFxuICBBUlJPV19SSUdIVDogMzksXG4gIEFSUk9XX0RPV046IDQwLFxuICBTUEFDRTogMzIsXG4gIEVOVEVSOiAxMyxcbiAgSE9NRTogMzYsXG4gIEVORDogMzUsXG59O1xuXG5jb25zdCBGT0NVU0FCTEVfU0VMRUNUT1IgPVxuICAnYVtocmVmXSwgYXJlYVtocmVmXSwgW3JvbGU9XCJidXR0b25cIl0sIGlucHV0LCBzZWxlY3QsIHRleHRhcmVhLCBidXR0b24sIGlmcmFtZSwgb2JqZWN0LCBlbWJlZCwgKlt0YWJpbmRleF0sICpbY29udGVudGVkaXRhYmxlXSc7XG5cbldlYmZsb3cuZGVmaW5lKFxuICAnc2xpZGVyJyxcbiAgKG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCQsIF8pIHtcbiAgICB2YXIgYXBpID0ge307XG4gICAgdmFyIHRyYW0gPSAkLnRyYW07XG4gICAgdmFyICRkb2MgPSAkKGRvY3VtZW50KTtcbiAgICB2YXIgJHNsaWRlcnM7XG4gICAgdmFyIGRlc2lnbmVyO1xuICAgIHZhciBpbkFwcCA9IFdlYmZsb3cuZW52KCk7XG4gICAgdmFyIG5hbWVzcGFjZSA9ICcudy1zbGlkZXInO1xuICAgIHZhciBkb3QgPSAnPGRpdiBjbGFzcz1cInctc2xpZGVyLWRvdFwiIGRhdGEtd2YtaWdub3JlIC8+JztcbiAgICB2YXIgYXJpYUxpdmVMYWJlbEh0bWwgPVxuICAgICAgJzxkaXYgYXJpYS1saXZlPVwib2ZmXCIgYXJpYS1hdG9taWM9XCJ0cnVlXCIgY2xhc3M9XCJ3LXNsaWRlci1hcmlhLWxhYmVsXCIgZGF0YS13Zi1pZ25vcmUgLz4nO1xuICAgIHZhciBmb3JjZVNob3cgPSAndy1zbGlkZXItZm9yY2Utc2hvdyc7XG4gICAgdmFyIGl4ID0gSVhFdmVudHMudHJpZ2dlcnM7XG4gICAgdmFyIGZhbGxiYWNrO1xuICAgIHZhciBpblJlZHJhdyA9IGZhbHNlO1xuXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBNb2R1bGUgbWV0aG9kc1xuXG4gICAgYXBpLnJlYWR5ID0gZnVuY3Rpb24gKCkge1xuICAgICAgZGVzaWduZXIgPSBXZWJmbG93LmVudignZGVzaWduJyk7XG4gICAgICBpbml0KCk7XG4gICAgfTtcblxuICAgIGFwaS5kZXNpZ24gPSBmdW5jdGlvbiAoKSB7XG4gICAgICBkZXNpZ25lciA9IHRydWU7XG4gICAgICAvLyBIZWxwcyBzbGlkZXIgaW5pdCBvbiBEZXNpZ25lciBsb2FkLlxuICAgICAgc2V0VGltZW91dChpbml0LCAxMDAwKTtcbiAgICB9O1xuXG4gICAgYXBpLnByZXZpZXcgPSBmdW5jdGlvbiAoKSB7XG4gICAgICBkZXNpZ25lciA9IGZhbHNlO1xuICAgICAgaW5pdCgpO1xuICAgIH07XG5cbiAgICBhcGkucmVkcmF3ID0gZnVuY3Rpb24gKCkge1xuICAgICAgaW5SZWRyYXcgPSB0cnVlO1xuICAgICAgaW5pdCgpO1xuICAgICAgaW5SZWRyYXcgPSBmYWxzZTtcbiAgICB9O1xuXG4gICAgYXBpLmRlc3Ryb3kgPSByZW1vdmVMaXN0ZW5lcnM7XG5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIFByaXZhdGUgbWV0aG9kc1xuXG4gICAgZnVuY3Rpb24gaW5pdCgpIHtcbiAgICAgIC8vIEZpbmQgYWxsIHNsaWRlcnMgb24gdGhlIHBhZ2VcbiAgICAgICRzbGlkZXJzID0gJGRvYy5maW5kKG5hbWVzcGFjZSk7XG4gICAgICBpZiAoISRzbGlkZXJzLmxlbmd0aCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICAkc2xpZGVycy5lYWNoKGJ1aWxkKTtcbiAgICAgIGlmIChmYWxsYmFjaykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHJlbW92ZUxpc3RlbmVycygpO1xuICAgICAgYWRkTGlzdGVuZXJzKCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVtb3ZlTGlzdGVuZXJzKCkge1xuICAgICAgV2ViZmxvdy5yZXNpemUub2ZmKHJlbmRlckFsbCk7XG4gICAgICBXZWJmbG93LnJlZHJhdy5vZmYoYXBpLnJlZHJhdyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkTGlzdGVuZXJzKCkge1xuICAgICAgV2ViZmxvdy5yZXNpemUub24ocmVuZGVyQWxsKTtcbiAgICAgIFdlYmZsb3cucmVkcmF3Lm9uKGFwaS5yZWRyYXcpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlbmRlckFsbCgpIHtcbiAgICAgICRzbGlkZXJzLmZpbHRlcignOnZpc2libGUnKS5lYWNoKHJlbmRlcik7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYnVpbGQoaSwgZWwpIHtcbiAgICAgIHZhciAkZWwgPSAkKGVsKTtcblxuICAgICAgLy8gU3RvcmUgc2xpZGVyIHN0YXRlIGluIGRhdGFcbiAgICAgIHZhciBkYXRhID0gJC5kYXRhKGVsLCBuYW1lc3BhY2UpO1xuICAgICAgaWYgKCFkYXRhKSB7XG4gICAgICAgIGRhdGEgPSAkLmRhdGEoZWwsIG5hbWVzcGFjZSwge1xuICAgICAgICAgIGluZGV4OiAwLFxuICAgICAgICAgIGRlcHRoOiAxLFxuICAgICAgICAgIGhhc0ZvY3VzOiB7XG4gICAgICAgICAgICBrZXlib2FyZDogZmFsc2UsXG4gICAgICAgICAgICBtb3VzZTogZmFsc2UsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBlbDogJGVsLFxuICAgICAgICAgIGNvbmZpZzoge30sXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZGF0YS5tYXNrID0gJGVsLmNoaWxkcmVuKCcudy1zbGlkZXItbWFzaycpO1xuICAgICAgZGF0YS5sZWZ0ID0gJGVsLmNoaWxkcmVuKCcudy1zbGlkZXItYXJyb3ctbGVmdCcpO1xuICAgICAgZGF0YS5yaWdodCA9ICRlbC5jaGlsZHJlbignLnctc2xpZGVyLWFycm93LXJpZ2h0Jyk7XG4gICAgICBkYXRhLm5hdiA9ICRlbC5jaGlsZHJlbignLnctc2xpZGVyLW5hdicpO1xuICAgICAgZGF0YS5zbGlkZXMgPSBkYXRhLm1hc2suY2hpbGRyZW4oJy53LXNsaWRlJyk7XG4gICAgICBkYXRhLnNsaWRlcy5lYWNoKGl4LnJlc2V0KTtcbiAgICAgIGlmIChpblJlZHJhdykge1xuICAgICAgICBkYXRhLm1hc2tXaWR0aCA9IDA7XG4gICAgICB9XG5cbiAgICAgIGlmICgkZWwuYXR0cigncm9sZScpID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgJGVsLmF0dHIoJ3JvbGUnLCAncmVnaW9uJyk7XG4gICAgICB9XG5cbiAgICAgIGlmICgkZWwuYXR0cignYXJpYS1sYWJlbCcpID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgJGVsLmF0dHIoJ2FyaWEtbGFiZWwnLCAnY2Fyb3VzZWwnKTtcbiAgICAgIH1cblxuICAgICAgLy8gU3RvcmUgdGhlIElEIG9mIHRoZSBzbGlkZXIgc2xpZGUgdmlldyBtYXNrXG4gICAgICB2YXIgc2xpZGVWaWV3SWQgPSBkYXRhLm1hc2suYXR0cignaWQnKTtcblxuICAgICAgLy8gSWYgdXNlciBkaWQgbm90IHByb3ZpZGUgYW4gSUQsIHNldCBpdFxuICAgICAgaWYgKCFzbGlkZVZpZXdJZCkge1xuICAgICAgICBzbGlkZVZpZXdJZCA9ICd3LXNsaWRlci1tYXNrLScgKyBpO1xuICAgICAgICBkYXRhLm1hc2suYXR0cignaWQnLCBzbGlkZVZpZXdJZCk7XG4gICAgICB9XG5cbiAgICAgIC8vIENyZWF0ZSBhcmlhIGxpdmUgbGFiZWxcbiAgICAgIGlmICghZGVzaWduZXIgJiYgIWRhdGEuYXJpYUxpdmVMYWJlbCkge1xuICAgICAgICBkYXRhLmFyaWFMaXZlTGFiZWwgPSAkKGFyaWFMaXZlTGFiZWxIdG1sKS5hcHBlbmRUbyhkYXRhLm1hc2spO1xuICAgICAgfVxuXG4gICAgICAvLyBBZGQgYXR0cmlidXRlcyB0byBsZWZ0L3JpZ2h0IGJ1dHRvbnNcbiAgICAgIGRhdGEubGVmdC5hdHRyKCdyb2xlJywgJ2J1dHRvbicpO1xuICAgICAgZGF0YS5sZWZ0LmF0dHIoJ3RhYmluZGV4JywgJzAnKTtcbiAgICAgIGRhdGEubGVmdC5hdHRyKCdhcmlhLWNvbnRyb2xzJywgc2xpZGVWaWV3SWQpO1xuICAgICAgaWYgKGRhdGEubGVmdC5hdHRyKCdhcmlhLWxhYmVsJykgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBkYXRhLmxlZnQuYXR0cignYXJpYS1sYWJlbCcsICdwcmV2aW91cyBzbGlkZScpO1xuICAgICAgfVxuXG4gICAgICBkYXRhLnJpZ2h0LmF0dHIoJ3JvbGUnLCAnYnV0dG9uJyk7XG4gICAgICBkYXRhLnJpZ2h0LmF0dHIoJ3RhYmluZGV4JywgJzAnKTtcbiAgICAgIGRhdGEucmlnaHQuYXR0cignYXJpYS1jb250cm9scycsIHNsaWRlVmlld0lkKTtcbiAgICAgIGlmIChkYXRhLnJpZ2h0LmF0dHIoJ2FyaWEtbGFiZWwnKSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGRhdGEucmlnaHQuYXR0cignYXJpYS1sYWJlbCcsICduZXh0IHNsaWRlJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIERpc2FibGUgaW4gb2xkIGJyb3dzZXJzXG4gICAgICBpZiAoIXRyYW0uc3VwcG9ydC50cmFuc2Zvcm0pIHtcbiAgICAgICAgZGF0YS5sZWZ0LmhpZGUoKTtcbiAgICAgICAgZGF0YS5yaWdodC5oaWRlKCk7XG4gICAgICAgIGRhdGEubmF2LmhpZGUoKTtcbiAgICAgICAgZmFsbGJhY2sgPSB0cnVlO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFJlbW92ZSBvbGQgZXZlbnRzXG4gICAgICBkYXRhLmVsLm9mZihuYW1lc3BhY2UpO1xuICAgICAgZGF0YS5sZWZ0Lm9mZihuYW1lc3BhY2UpO1xuICAgICAgZGF0YS5yaWdodC5vZmYobmFtZXNwYWNlKTtcbiAgICAgIGRhdGEubmF2Lm9mZihuYW1lc3BhY2UpO1xuXG4gICAgICAvLyBTZXQgY29uZmlnIGZyb20gZGF0YSBhdHRyaWJ1dGVzXG4gICAgICBjb25maWd1cmUoZGF0YSk7XG5cbiAgICAgIC8vIEFkZCBldmVudHMgYmFzZWQgb24gbW9kZVxuICAgICAgaWYgKGRlc2lnbmVyKSB7XG4gICAgICAgIGRhdGEuZWwub24oJ3NldHRpbmcnICsgbmFtZXNwYWNlLCBoYW5kbGVyKGRhdGEpKTtcbiAgICAgICAgc3RvcFRpbWVyKGRhdGEpO1xuICAgICAgICBkYXRhLmhhc1RpbWVyID0gZmFsc2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkYXRhLmVsLm9uKCdzd2lwZScgKyBuYW1lc3BhY2UsIGhhbmRsZXIoZGF0YSkpO1xuICAgICAgICBkYXRhLmxlZnQub24oJ2NsaWNrJyArIG5hbWVzcGFjZSwgcHJldmlvdXNGdW5jdGlvbihkYXRhKSk7XG4gICAgICAgIGRhdGEucmlnaHQub24oJ2NsaWNrJyArIG5hbWVzcGFjZSwgbmV4dChkYXRhKSk7XG5cbiAgICAgICAgZGF0YS5sZWZ0Lm9uKFxuICAgICAgICAgICdrZXlkb3duJyArIG5hbWVzcGFjZSxcbiAgICAgICAgICBrZXlib2FyZFNsaWRlQnV0dG9uc0Z1bmN0aW9uKGRhdGEsIHByZXZpb3VzRnVuY3Rpb24pXG4gICAgICAgICk7XG4gICAgICAgIGRhdGEucmlnaHQub24oXG4gICAgICAgICAgJ2tleWRvd24nICsgbmFtZXNwYWNlLFxuICAgICAgICAgIGtleWJvYXJkU2xpZGVCdXR0b25zRnVuY3Rpb24oZGF0YSwgbmV4dClcbiAgICAgICAgKTtcblxuICAgICAgICAvLyBMaXN0ZW4gdG8gbmF2IGtleWJvYXJkIGV2ZW50c1xuICAgICAgICBkYXRhLm5hdi5vbigna2V5ZG93bicgKyBuYW1lc3BhY2UsICc+IGRpdicsIGhhbmRsZXIoZGF0YSkpO1xuXG4gICAgICAgIC8vIFN0YXJ0IHRpbWVyIGlmIGF1dG9wbGF5IGlzIHRydWUsIG9ubHkgb25jZVxuICAgICAgICBpZiAoZGF0YS5jb25maWcuYXV0b3BsYXkgJiYgIWRhdGEuaGFzVGltZXIpIHtcbiAgICAgICAgICBkYXRhLmhhc1RpbWVyID0gdHJ1ZTtcbiAgICAgICAgICBkYXRhLnRpbWVyQ291bnQgPSAxO1xuICAgICAgICAgIHN0YXJ0VGltZXIoZGF0YSk7XG4gICAgICAgIH1cblxuICAgICAgICBkYXRhLmVsLm9uKCdtb3VzZWVudGVyJyArIG5hbWVzcGFjZSwgaGFzRm9jdXMoZGF0YSwgdHJ1ZSwgJ21vdXNlJykpO1xuICAgICAgICBkYXRhLmVsLm9uKCdmb2N1c2luJyArIG5hbWVzcGFjZSwgaGFzRm9jdXMoZGF0YSwgdHJ1ZSwgJ2tleWJvYXJkJykpO1xuICAgICAgICBkYXRhLmVsLm9uKCdtb3VzZWxlYXZlJyArIG5hbWVzcGFjZSwgaGFzRm9jdXMoZGF0YSwgZmFsc2UsICdtb3VzZScpKTtcbiAgICAgICAgZGF0YS5lbC5vbignZm9jdXNvdXQnICsgbmFtZXNwYWNlLCBoYXNGb2N1cyhkYXRhLCBmYWxzZSwgJ2tleWJvYXJkJykpO1xuICAgICAgfVxuXG4gICAgICAvLyBMaXN0ZW4gdG8gbmF2IGNsaWNrIGV2ZW50c1xuICAgICAgZGF0YS5uYXYub24oJ2NsaWNrJyArIG5hbWVzcGFjZSwgJz4gZGl2JywgaGFuZGxlcihkYXRhKSk7XG5cbiAgICAgIC8vIFJlbW92ZSBnYXBzIGZyb20gZm9ybWF0dGVkIGh0bWwgKGZvciBpbmxpbmUtYmxvY2tzKVxuICAgICAgaWYgKCFpbkFwcCkge1xuICAgICAgICBkYXRhLm1hc2tcbiAgICAgICAgICAuY29udGVudHMoKVxuICAgICAgICAgIC5maWx0ZXIoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubm9kZVR5cGUgPT09IDM7XG4gICAgICAgICAgfSlcbiAgICAgICAgICAucmVtb3ZlKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIElmIHNsaWRlciBvciBhbnkgcGFyZW50IGlzIGhpZGRlbiwgdGVtcG9yYXJpbHkgc2hvdyBmb3IgbWVhc3VyZW1lbnRzIChodHRwczovL2dpdGh1Yi5jb20vd2ViZmxvdy93ZWJmbG93L2lzc3Vlcy8yNDkyMSlcbiAgICAgIHZhciAkZWxIaWRkZW4gPSAkZWwuZmlsdGVyKCc6aGlkZGVuJyk7XG4gICAgICAkZWxIaWRkZW4uYWRkQ2xhc3MoZm9yY2VTaG93KTtcbiAgICAgIHZhciAkZWxIaWRkZW5QYXJlbnRzID0gJGVsLnBhcmVudHMoJzpoaWRkZW4nKTtcbiAgICAgICRlbEhpZGRlblBhcmVudHMuYWRkQ2xhc3MoZm9yY2VTaG93KTtcblxuICAgICAgLy8gUnVuIGZpcnN0IHJlbmRlclxuICAgICAgaWYgKCFpblJlZHJhdykge1xuICAgICAgICByZW5kZXIoaSwgZWwpO1xuICAgICAgfVxuXG4gICAgICAvLyBJZiBzbGlkZXIgb3IgYW55IHBhcmVudCBpcyBoaWRkZW4sIHJlc2V0IGFmdGVyIHRlbXBvcmFyaWx5IHNob3dpbmcgZm9yIG1lYXN1cmVtZW50c1xuICAgICAgJGVsSGlkZGVuLnJlbW92ZUNsYXNzKGZvcmNlU2hvdyk7XG4gICAgICAkZWxIaWRkZW5QYXJlbnRzLnJlbW92ZUNsYXNzKGZvcmNlU2hvdyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY29uZmlndXJlKGRhdGEpIHtcbiAgICAgIHZhciBjb25maWcgPSB7fTtcblxuICAgICAgY29uZmlnLmNyb3NzT3ZlciA9IDA7XG5cbiAgICAgIC8vIFNldCBjb25maWcgb3B0aW9ucyBmcm9tIGRhdGEgYXR0cmlidXRlc1xuICAgICAgY29uZmlnLmFuaW1hdGlvbiA9IGRhdGEuZWwuYXR0cignZGF0YS1hbmltYXRpb24nKSB8fCAnc2xpZGUnO1xuICAgICAgaWYgKGNvbmZpZy5hbmltYXRpb24gPT09ICdvdXRpbicpIHtcbiAgICAgICAgY29uZmlnLmFuaW1hdGlvbiA9ICdjcm9zcyc7XG4gICAgICAgIGNvbmZpZy5jcm9zc092ZXIgPSAwLjU7XG4gICAgICB9XG4gICAgICBjb25maWcuZWFzaW5nID0gZGF0YS5lbC5hdHRyKCdkYXRhLWVhc2luZycpIHx8ICdlYXNlJztcblxuICAgICAgdmFyIGR1cmF0aW9uID0gZGF0YS5lbC5hdHRyKCdkYXRhLWR1cmF0aW9uJyk7XG4gICAgICBjb25maWcuZHVyYXRpb24gPSBkdXJhdGlvbiAhPSBudWxsID8gcGFyc2VJbnQoZHVyYXRpb24sIDEwKSA6IDUwMDtcblxuICAgICAgaWYgKGlzQXR0clRydWUoZGF0YS5lbC5hdHRyKCdkYXRhLWluZmluaXRlJykpKSB7XG4gICAgICAgIGNvbmZpZy5pbmZpbml0ZSA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChpc0F0dHJUcnVlKGRhdGEuZWwuYXR0cignZGF0YS1kaXNhYmxlLXN3aXBlJykpKSB7XG4gICAgICAgIGNvbmZpZy5kaXNhYmxlU3dpcGUgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoaXNBdHRyVHJ1ZShkYXRhLmVsLmF0dHIoJ2RhdGEtaGlkZS1hcnJvd3MnKSkpIHtcbiAgICAgICAgY29uZmlnLmhpZGVBcnJvd3MgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChkYXRhLmNvbmZpZy5oaWRlQXJyb3dzKSB7XG4gICAgICAgIGRhdGEubGVmdC5zaG93KCk7XG4gICAgICAgIGRhdGEucmlnaHQuc2hvdygpO1xuICAgICAgfVxuXG4gICAgICBpZiAoaXNBdHRyVHJ1ZShkYXRhLmVsLmF0dHIoJ2RhdGEtYXV0b3BsYXknKSkpIHtcbiAgICAgICAgY29uZmlnLmF1dG9wbGF5ID0gdHJ1ZTtcbiAgICAgICAgY29uZmlnLmRlbGF5ID0gcGFyc2VJbnQoZGF0YS5lbC5hdHRyKCdkYXRhLWRlbGF5JyksIDEwKSB8fCAyMDAwO1xuICAgICAgICBjb25maWcudGltZXJNYXggPSBwYXJzZUludChkYXRhLmVsLmF0dHIoJ2RhdGEtYXV0b3BsYXktbGltaXQnKSwgMTApO1xuICAgICAgICAvLyBEaXNhYmxlIHRpbWVyIG9uIGZpcnN0IHRvdWNoIG9yIG1vdXNlIGRvd25cbiAgICAgICAgdmFyIHRvdWNoRXZlbnRzID0gJ21vdXNlZG93bicgKyBuYW1lc3BhY2UgKyAnIHRvdWNoc3RhcnQnICsgbmFtZXNwYWNlO1xuICAgICAgICBpZiAoIWRlc2lnbmVyKSB7XG4gICAgICAgICAgZGF0YS5lbC5vZmYodG91Y2hFdmVudHMpLm9uZSh0b3VjaEV2ZW50cywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc3RvcFRpbWVyKGRhdGEpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFVzZSBlZGdlIGJ1ZmZlciB0byBoZWxwIGNhbGN1bGF0ZSBwYWdlIGNvdW50XG4gICAgICB2YXIgYXJyb3dXaWR0aCA9IGRhdGEucmlnaHQud2lkdGgoKTtcbiAgICAgIGNvbmZpZy5lZGdlID0gYXJyb3dXaWR0aCA/IGFycm93V2lkdGggKyA0MCA6IDEwMDtcblxuICAgICAgLy8gU3RvcmUgY29uZmlnIGluIGRhdGFcbiAgICAgIGRhdGEuY29uZmlnID0gY29uZmlnO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzQXR0clRydWUodmFsdWUpIHtcbiAgICAgIHJldHVybiB2YWx1ZSA9PT0gJzEnIHx8IHZhbHVlID09PSAndHJ1ZSc7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaGFzRm9jdXMoZGF0YSwgZm9jdXNJbiwgZXZlbnRUeXBlKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKGV2dCkge1xuICAgICAgICBpZiAoIWZvY3VzSW4pIHtcbiAgICAgICAgICAvLyBQcmV2ZW50IEZvY3VzIE91dCBpZiBtb3ZpbmcgdG8gYW5vdGhlciBlbGVtZW50IGluIHRoZSBzbGlkZXJcbiAgICAgICAgICBpZiAoJC5jb250YWlucyhkYXRhLmVsLmdldCgwKSwgZXZ0LnJlbGF0ZWRUYXJnZXQpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZGF0YS5oYXNGb2N1c1tldmVudFR5cGVdID0gZm9jdXNJbjtcblxuICAgICAgICAgIC8vIFByZXZlbnQgQXJpYSBsaXZlIGNoYW5nZSBpZiBmb2N1c2VkIGJ5IG90aGVyIGlucHV0XG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgKGRhdGEuaGFzRm9jdXMubW91c2UgJiYgZXZlbnRUeXBlID09PSAna2V5Ym9hcmQnKSB8fFxuICAgICAgICAgICAgKGRhdGEuaGFzRm9jdXMua2V5Ym9hcmQgJiYgZXZlbnRUeXBlID09PSAnbW91c2UnKVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBkYXRhLmhhc0ZvY3VzW2V2ZW50VHlwZV0gPSBmb2N1c0luO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZvY3VzSW4pIHtcbiAgICAgICAgICBkYXRhLmFyaWFMaXZlTGFiZWwuYXR0cignYXJpYS1saXZlJywgJ3BvbGl0ZScpO1xuICAgICAgICAgIGlmIChkYXRhLmhhc1RpbWVyKSB7XG4gICAgICAgICAgICBzdG9wVGltZXIoZGF0YSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRhdGEuYXJpYUxpdmVMYWJlbC5hdHRyKCdhcmlhLWxpdmUnLCAnb2ZmJyk7XG4gICAgICAgICAgaWYgKGRhdGEuaGFzVGltZXIpIHtcbiAgICAgICAgICAgIHN0YXJ0VGltZXIoZGF0YSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBrZXlib2FyZFNsaWRlQnV0dG9uc0Z1bmN0aW9uKGRhdGEsIGRpcmVjdGlvbkZ1bmN0aW9uKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKGV2dCkge1xuICAgICAgICBzd2l0Y2ggKGV2dC5rZXlDb2RlKSB7XG4gICAgICAgICAgY2FzZSBLRVlfQ09ERVMuU1BBQ0U6XG4gICAgICAgICAgY2FzZSBLRVlfQ09ERVMuRU5URVI6IHtcbiAgICAgICAgICAgIC8vIERpcmVjdGlvbkZ1bmN0aW9uIHJldHVybnMgYSBmdW5jdGlvblxuICAgICAgICAgICAgZGlyZWN0aW9uRnVuY3Rpb24oZGF0YSkoKTtcblxuICAgICAgICAgICAgZXZ0LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICByZXR1cm4gZXZ0LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwcmV2aW91c0Z1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNoYW5nZShkYXRhLCB7aW5kZXg6IGRhdGEuaW5kZXggLSAxLCB2ZWN0b3I6IC0xfSk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG5leHQoZGF0YSkge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY2hhbmdlKGRhdGEsIHtpbmRleDogZGF0YS5pbmRleCArIDEsIHZlY3RvcjogMX0pO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzZWxlY3QoZGF0YSwgdmFsdWUpIHtcbiAgICAgIC8vIFNlbGVjdCBwYWdlIGJhc2VkIG9uIHNsaWRlIGVsZW1lbnQgaW5kZXhcbiAgICAgIHZhciBmb3VuZCA9IG51bGw7XG4gICAgICBpZiAodmFsdWUgPT09IGRhdGEuc2xpZGVzLmxlbmd0aCkge1xuICAgICAgICBpbml0KCk7XG4gICAgICAgIGxheW91dChkYXRhKTsgLy8gUmVidWlsZCBhbmQgZmluZCBuZXcgc2xpZGVzXG4gICAgICB9XG4gICAgICBfLmVhY2goZGF0YS5hbmNob3JzLCBmdW5jdGlvbiAoYW5jaG9yLCBpbmRleCkge1xuICAgICAgICAkKGFuY2hvci5lbHMpLmVhY2goZnVuY3Rpb24gKGksIGVsKSB7XG4gICAgICAgICAgaWYgKCQoZWwpLmluZGV4KCkgPT09IHZhbHVlKSB7XG4gICAgICAgICAgICBmb3VuZCA9IGluZGV4O1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICAgIGlmIChmb3VuZCAhPSBudWxsKSB7XG4gICAgICAgIGNoYW5nZShkYXRhLCB7aW5kZXg6IGZvdW5kLCBpbW1lZGlhdGU6IHRydWV9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzdGFydFRpbWVyKGRhdGEpIHtcbiAgICAgIHN0b3BUaW1lcihkYXRhKTtcbiAgICAgIHZhciBjb25maWcgPSBkYXRhLmNvbmZpZztcbiAgICAgIHZhciB0aW1lck1heCA9IGNvbmZpZy50aW1lck1heDtcbiAgICAgIGlmICh0aW1lck1heCAmJiBkYXRhLnRpbWVyQ291bnQrKyA+IHRpbWVyTWF4KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGRhdGEudGltZXJJZCA9IHdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKGRhdGEudGltZXJJZCA9PSBudWxsIHx8IGRlc2lnbmVyKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIG5leHQoZGF0YSkoKTtcbiAgICAgICAgc3RhcnRUaW1lcihkYXRhKTtcbiAgICAgIH0sIGNvbmZpZy5kZWxheSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc3RvcFRpbWVyKGRhdGEpIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQoZGF0YS50aW1lcklkKTtcbiAgICAgIGRhdGEudGltZXJJZCA9IG51bGw7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaGFuZGxlcihkYXRhKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKGV2dCwgb3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgICAgdmFyIGNvbmZpZyA9IGRhdGEuY29uZmlnO1xuXG4gICAgICAgIC8vIERlc2lnbmVyIHNldHRpbmdzXG4gICAgICAgIGlmIChkZXNpZ25lciAmJiBldnQudHlwZSA9PT0gJ3NldHRpbmcnKSB7XG4gICAgICAgICAgaWYgKG9wdGlvbnMuc2VsZWN0ID09PSAncHJldicpIHtcbiAgICAgICAgICAgIHJldHVybiBwcmV2aW91c0Z1bmN0aW9uKGRhdGEpKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChvcHRpb25zLnNlbGVjdCA9PT0gJ25leHQnKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV4dChkYXRhKSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25maWd1cmUoZGF0YSk7XG4gICAgICAgICAgbGF5b3V0KGRhdGEpO1xuICAgICAgICAgIGlmIChvcHRpb25zLnNlbGVjdCA9PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHNlbGVjdChkYXRhLCBvcHRpb25zLnNlbGVjdCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3dpcGUgZXZlbnRcbiAgICAgICAgaWYgKGV2dC50eXBlID09PSAnc3dpcGUnKSB7XG4gICAgICAgICAgaWYgKGNvbmZpZy5kaXNhYmxlU3dpcGUpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKFdlYmZsb3cuZW52KCdlZGl0b3InKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAob3B0aW9ucy5kaXJlY3Rpb24gPT09ICdsZWZ0Jykge1xuICAgICAgICAgICAgcmV0dXJuIG5leHQoZGF0YSkoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKG9wdGlvbnMuZGlyZWN0aW9uID09PSAncmlnaHQnKSB7XG4gICAgICAgICAgICByZXR1cm4gcHJldmlvdXNGdW5jdGlvbihkYXRhKSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBQYWdlIGJ1dHRvbnNcbiAgICAgICAgaWYgKGRhdGEubmF2LmhhcyhldnQudGFyZ2V0KS5sZW5ndGgpIHtcbiAgICAgICAgICB2YXIgaW5kZXggPSAkKGV2dC50YXJnZXQpLmluZGV4KCk7XG4gICAgICAgICAgaWYgKGV2dC50eXBlID09PSAnY2xpY2snKSB7XG4gICAgICAgICAgICBjaGFuZ2UoZGF0YSwge2luZGV4fSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGV2dC50eXBlID09PSAna2V5ZG93bicpIHtcbiAgICAgICAgICAgIHN3aXRjaCAoZXZ0LmtleUNvZGUpIHtcbiAgICAgICAgICAgICAgY2FzZSBLRVlfQ09ERVMuRU5URVI6XG4gICAgICAgICAgICAgIGNhc2UgS0VZX0NPREVTLlNQQUNFOiB7XG4gICAgICAgICAgICAgICAgY2hhbmdlKGRhdGEsIHtpbmRleH0pO1xuICAgICAgICAgICAgICAgIGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY2FzZSBLRVlfQ09ERVMuQVJST1dfTEVGVDpcbiAgICAgICAgICAgICAgY2FzZSBLRVlfQ09ERVMuQVJST1dfVVA6IHtcbiAgICAgICAgICAgICAgICBmb2N1c0RvdChkYXRhLm5hdiwgTWF0aC5tYXgoaW5kZXggLSAxLCAwKSk7XG4gICAgICAgICAgICAgICAgZXZ0LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjYXNlIEtFWV9DT0RFUy5BUlJPV19SSUdIVDpcbiAgICAgICAgICAgICAgY2FzZSBLRVlfQ09ERVMuQVJST1dfRE9XTjoge1xuICAgICAgICAgICAgICAgIGZvY3VzRG90KGRhdGEubmF2LCBNYXRoLm1pbihpbmRleCArIDEsIGRhdGEucGFnZXMpKTtcbiAgICAgICAgICAgICAgICBldnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNhc2UgS0VZX0NPREVTLkhPTUU6IHtcbiAgICAgICAgICAgICAgICBmb2N1c0RvdChkYXRhLm5hdiwgMCk7XG4gICAgICAgICAgICAgICAgZXZ0LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjYXNlIEtFWV9DT0RFUy5FTkQ6IHtcbiAgICAgICAgICAgICAgICBmb2N1c0RvdChkYXRhLm5hdiwgZGF0YS5wYWdlcyk7XG4gICAgICAgICAgICAgICAgZXZ0LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGZvY3VzRG90KCRuYXYsIGluZGV4KSB7XG4gICAgICAvLyBGb2N1cyBuYXYgZG90OyBkb24ndCBjaGFuZ2UgY2xhc3MgdG8gYWN0aXZlXG4gICAgICB2YXIgJGFjdGl2ZSA9ICRuYXYuY2hpbGRyZW4oKS5lcShpbmRleCkuZm9jdXMoKTtcblxuICAgICAgJG5hdi5jaGlsZHJlbigpLm5vdCgkYWN0aXZlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjaGFuZ2UoZGF0YSwgb3B0aW9ucykge1xuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgICB2YXIgY29uZmlnID0gZGF0YS5jb25maWc7XG4gICAgICB2YXIgYW5jaG9ycyA9IGRhdGEuYW5jaG9ycztcblxuICAgICAgLy8gU2V0IG5ldyBpbmRleFxuICAgICAgZGF0YS5wcmV2aW91cyA9IGRhdGEuaW5kZXg7XG4gICAgICB2YXIgaW5kZXggPSBvcHRpb25zLmluZGV4O1xuICAgICAgdmFyIHNoaWZ0ID0ge307XG4gICAgICBpZiAoaW5kZXggPCAwKSB7XG4gICAgICAgIGluZGV4ID0gYW5jaG9ycy5sZW5ndGggLSAxO1xuICAgICAgICBpZiAoY29uZmlnLmluZmluaXRlKSB7XG4gICAgICAgICAgLy8gU2hpZnQgZmlyc3Qgc2xpZGUgdG8gdGhlIGVuZFxuICAgICAgICAgIHNoaWZ0LnggPSAtZGF0YS5lbmRYO1xuICAgICAgICAgIHNoaWZ0LmZyb20gPSAwO1xuICAgICAgICAgIHNoaWZ0LnRvID0gYW5jaG9yc1swXS53aWR0aDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChpbmRleCA+PSBhbmNob3JzLmxlbmd0aCkge1xuICAgICAgICBpbmRleCA9IDA7XG4gICAgICAgIGlmIChjb25maWcuaW5maW5pdGUpIHtcbiAgICAgICAgICAvLyBTaGlmdCBsYXN0IHNsaWRlIHRvIHRoZSBzdGFydFxuICAgICAgICAgIHNoaWZ0LnggPSBhbmNob3JzW2FuY2hvcnMubGVuZ3RoIC0gMV0ud2lkdGg7XG4gICAgICAgICAgc2hpZnQuZnJvbSA9IC1hbmNob3JzW2FuY2hvcnMubGVuZ3RoIC0gMV0ueDtcbiAgICAgICAgICBzaGlmdC50byA9IHNoaWZ0LmZyb20gLSBzaGlmdC54O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBkYXRhLmluZGV4ID0gaW5kZXg7XG5cbiAgICAgIC8vIE5vdGlmeSB0aGUgZGVzaWduZXIgTWluaVRvb2xiYXIgYWJvdXQgc2xpZGUgY2hhbmdlcyB0cmlnZ2VyZWRcbiAgICAgIC8vIGZyb20gd2l0aGluIHRoZSBzaXRlIGlmcmFtZSAoZS5nLiBuYXYtZG90IGNsaWNrcykuIFRoZSBSZWFjdFxuICAgICAgLy8gaG9vayB1c2VTbGlkZXJDb250cm9scyBsaXN0ZW5zIGZvciB0aGlzIGV2ZW50IHRvIGtlZXAgaXRzXG4gICAgICAvLyBtaW5pVG9vbGJhckN1cnJlbnRTbGlkZUlkIHN0YXRlIGluIHN5bmMuXG4gICAgICBpZiAoZGVzaWduZXIpIHtcbiAgICAgICAgZGF0YS5lbFswXS5kaXNwYXRjaEV2ZW50KFxuICAgICAgICAgIG5ldyBDdXN0b21FdmVudCgnd2Ytc2xpZGVyLWNoYW5nZScsIHtkZXRhaWw6IHtpbmRleH0sIGJ1YmJsZXM6IHRydWV9KVxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICAvLyBTZWxlY3QgbmF2IGRvdDsgc2V0IGNsYXNzIGFjdGl2ZVxuICAgICAgdmFyICRhY3RpdmUgPSBkYXRhLm5hdlxuICAgICAgICAuY2hpbGRyZW4oKVxuICAgICAgICAuZXEoaW5kZXgpXG4gICAgICAgIC5hZGRDbGFzcygndy1hY3RpdmUnKVxuICAgICAgICAuYXR0cignYXJpYS1wcmVzc2VkJywgJ3RydWUnKVxuICAgICAgICAuYXR0cigndGFiaW5kZXgnLCAnMCcpO1xuXG4gICAgICBkYXRhLm5hdlxuICAgICAgICAuY2hpbGRyZW4oKVxuICAgICAgICAubm90KCRhY3RpdmUpXG4gICAgICAgIC5yZW1vdmVDbGFzcygndy1hY3RpdmUnKVxuICAgICAgICAuYXR0cignYXJpYS1wcmVzc2VkJywgJ2ZhbHNlJylcbiAgICAgICAgLmF0dHIoJ3RhYmluZGV4JywgJy0xJyk7XG5cbiAgICAgIC8vIEhpZGUgYXJyb3dzXG4gICAgICBpZiAoY29uZmlnLmhpZGVBcnJvd3MpIHtcbiAgICAgICAgZGF0YS5pbmRleCA9PT0gYW5jaG9ycy5sZW5ndGggLSAxXG4gICAgICAgICAgPyBkYXRhLnJpZ2h0LmhpZGUoKVxuICAgICAgICAgIDogZGF0YS5yaWdodC5zaG93KCk7XG4gICAgICAgIGRhdGEuaW5kZXggPT09IDAgPyBkYXRhLmxlZnQuaGlkZSgpIDogZGF0YS5sZWZ0LnNob3coKTtcbiAgICAgIH1cblxuICAgICAgLy8gR2V0IHBhZ2Ugb2Zmc2V0IGZyb20gYW5jaG9yc1xuICAgICAgdmFyIGxhc3RPZmZzZXRYID0gZGF0YS5vZmZzZXRYIHx8IDA7XG4gICAgICB2YXIgb2Zmc2V0WCA9IChkYXRhLm9mZnNldFggPSAtYW5jaG9yc1tkYXRhLmluZGV4XS54KTtcbiAgICAgIHZhciByZXNldENvbmZpZyA9IHt4OiBvZmZzZXRYLCBvcGFjaXR5OiAxLCB2aXNpYmlsaXR5OiAnJ307XG5cbiAgICAgIC8vIFRyYW5zaXRpb24gc2xpZGVzXG4gICAgICB2YXIgdGFyZ2V0cyA9ICQoYW5jaG9yc1tkYXRhLmluZGV4XS5lbHMpO1xuICAgICAgdmFyIHByZXZUYXJncyA9ICQoYW5jaG9yc1tkYXRhLnByZXZpb3VzXSAmJiBhbmNob3JzW2RhdGEucHJldmlvdXNdLmVscyk7XG4gICAgICB2YXIgb3RoZXJzID0gZGF0YS5zbGlkZXMubm90KHRhcmdldHMpO1xuICAgICAgdmFyIGFuaW1hdGlvbiA9IGNvbmZpZy5hbmltYXRpb247XG4gICAgICB2YXIgZWFzaW5nID0gY29uZmlnLmVhc2luZztcbiAgICAgIHZhciBkdXJhdGlvbiA9IE1hdGgucm91bmQoY29uZmlnLmR1cmF0aW9uKTtcbiAgICAgIHZhciB2ZWN0b3IgPSBvcHRpb25zLnZlY3RvciB8fCAoZGF0YS5pbmRleCA+IGRhdGEucHJldmlvdXMgPyAxIDogLTEpO1xuICAgICAgdmFyIGZhZGVSdWxlID0gJ29wYWNpdHkgJyArIGR1cmF0aW9uICsgJ21zICcgKyBlYXNpbmc7XG4gICAgICB2YXIgc2xpZGVSdWxlID0gJ3RyYW5zZm9ybSAnICsgZHVyYXRpb24gKyAnbXMgJyArIGVhc2luZztcblxuICAgICAgLy8gTWFrZSBhY3RpdmUgc2xpZGVzJyBjb250ZW50IGZvY3VzYWJsZVxuICAgICAgdGFyZ2V0cy5maW5kKEZPQ1VTQUJMRV9TRUxFQ1RPUikucmVtb3ZlQXR0cigndGFiaW5kZXgnKTtcbiAgICAgIHRhcmdldHMucmVtb3ZlQXR0cignYXJpYS1oaWRkZW4nKTtcbiAgICAgIC8vIFZvaWNlb3ZlciBidWc6IFNvbWV0aW1lcyBkZXNjZW5kYW50cyBhcmUgc3RpbGwgdmlzaWJsZSwgc28gaGlkZSBldmVyeXRoaW5nLi4uXG4gICAgICB0YXJnZXRzLmZpbmQoJyonKS5yZW1vdmVBdHRyKCdhcmlhLWhpZGRlbicpO1xuICAgICAgLy8gUHJldmVudCBmb2N1cyBvbiBpbmFjdGl2ZSBzbGlkZXMnIGNvbnRlbnRcbiAgICAgIG90aGVycy5maW5kKEZPQ1VTQUJMRV9TRUxFQ1RPUikuYXR0cigndGFiaW5kZXgnLCAnLTEnKTtcbiAgICAgIG90aGVycy5hdHRyKCdhcmlhLWhpZGRlbicsICd0cnVlJyk7XG4gICAgICAvLyBWb2ljZW92ZXIgYnVnOiBTb21ldGltZXMgZGVzY2VuZGFudHMgYXJlIHN0aWxsIHZpc2libGUsIHNvIGhpZGUgZXZlcnl0aGluZy4uLlxuICAgICAgb3RoZXJzLmZpbmQoJyonKS5hdHRyKCdhcmlhLWhpZGRlbicsICd0cnVlJyk7XG5cbiAgICAgIC8vIFRyaWdnZXIgSVggZXZlbnRzXG4gICAgICBpZiAoIWRlc2lnbmVyKSB7XG4gICAgICAgIHRhcmdldHMuZWFjaChpeC5pbnRybyk7XG4gICAgICAgIG90aGVycy5lYWNoKGl4Lm91dHJvKTtcbiAgICAgIH1cblxuICAgICAgLy8gU2V0IGltbWVkaWF0ZWx5IGFmdGVyIGxheW91dCBjaGFuZ2VzIChidXQgbm90IGR1cmluZyByZWRyYXcpXG4gICAgICBpZiAob3B0aW9ucy5pbW1lZGlhdGUgJiYgIWluUmVkcmF3KSB7XG4gICAgICAgIHRyYW0odGFyZ2V0cykuc2V0KHJlc2V0Q29uZmlnKTtcbiAgICAgICAgcmVzZXRPdGhlcnMoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBFeGl0IGVhcmx5IGlmIGluZGV4IGlzIHVuY2hhbmdlZFxuICAgICAgaWYgKGRhdGEuaW5kZXggPT09IGRhdGEucHJldmlvdXMpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBBbm5vdW5jZSBzbGlkZSBjaGFuZ2UgdG8gc2NyZWVuIHJlYWRlclxuICAgICAgaWYgKCFkZXNpZ25lcikge1xuICAgICAgICBkYXRhLmFyaWFMaXZlTGFiZWwudGV4dChgU2xpZGUgJHtpbmRleCArIDF9IG9mICR7YW5jaG9ycy5sZW5ndGh9LmApO1xuICAgICAgfVxuICAgICAgLy8gQ3Jvc3MgRmFkZSAvIE91dC1JblxuICAgICAgaWYgKGFuaW1hdGlvbiA9PT0gJ2Nyb3NzJykge1xuICAgICAgICB2YXIgcmVkdWNlZCA9IE1hdGgucm91bmQoZHVyYXRpb24gLSBkdXJhdGlvbiAqIGNvbmZpZy5jcm9zc092ZXIpO1xuICAgICAgICB2YXIgd2FpdCA9IE1hdGgucm91bmQoZHVyYXRpb24gLSByZWR1Y2VkKTtcbiAgICAgICAgZmFkZVJ1bGUgPSAnb3BhY2l0eSAnICsgcmVkdWNlZCArICdtcyAnICsgZWFzaW5nO1xuICAgICAgICB0cmFtKHByZXZUYXJncykuc2V0KHt2aXNpYmlsaXR5OiAnJ30pLmFkZChmYWRlUnVsZSkuc3RhcnQoe29wYWNpdHk6IDB9KTtcbiAgICAgICAgdHJhbSh0YXJnZXRzKVxuICAgICAgICAgIC5zZXQoe3Zpc2liaWxpdHk6ICcnLCB4OiBvZmZzZXRYLCBvcGFjaXR5OiAwLCB6SW5kZXg6IGRhdGEuZGVwdGgrK30pXG4gICAgICAgICAgLmFkZChmYWRlUnVsZSlcbiAgICAgICAgICAud2FpdCh3YWl0KVxuICAgICAgICAgIC50aGVuKHtvcGFjaXR5OiAxfSlcbiAgICAgICAgICAudGhlbihyZXNldE90aGVycyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gRmFkZSBPdmVyXG4gICAgICBpZiAoYW5pbWF0aW9uID09PSAnZmFkZScpIHtcbiAgICAgICAgdHJhbShwcmV2VGFyZ3MpLnNldCh7dmlzaWJpbGl0eTogJyd9KS5zdG9wKCk7XG4gICAgICAgIHRyYW0odGFyZ2V0cylcbiAgICAgICAgICAuc2V0KHt2aXNpYmlsaXR5OiAnJywgeDogb2Zmc2V0WCwgb3BhY2l0eTogMCwgekluZGV4OiBkYXRhLmRlcHRoKyt9KVxuICAgICAgICAgIC5hZGQoZmFkZVJ1bGUpXG4gICAgICAgICAgLnN0YXJ0KHtvcGFjaXR5OiAxfSlcbiAgICAgICAgICAudGhlbihyZXNldE90aGVycyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gU2xpZGUgT3ZlclxuICAgICAgaWYgKGFuaW1hdGlvbiA9PT0gJ292ZXInKSB7XG4gICAgICAgIHJlc2V0Q29uZmlnID0ge3g6IGRhdGEuZW5kWH07XG4gICAgICAgIHRyYW0ocHJldlRhcmdzKS5zZXQoe3Zpc2liaWxpdHk6ICcnfSkuc3RvcCgpO1xuICAgICAgICB0cmFtKHRhcmdldHMpXG4gICAgICAgICAgLnNldCh7XG4gICAgICAgICAgICB2aXNpYmlsaXR5OiAnJyxcbiAgICAgICAgICAgIHpJbmRleDogZGF0YS5kZXB0aCsrLFxuICAgICAgICAgICAgeDogb2Zmc2V0WCArIGFuY2hvcnNbZGF0YS5pbmRleF0ud2lkdGggKiB2ZWN0b3IsXG4gICAgICAgICAgfSlcbiAgICAgICAgICAuYWRkKHNsaWRlUnVsZSlcbiAgICAgICAgICAuc3RhcnQoe3g6IG9mZnNldFh9KVxuICAgICAgICAgIC50aGVuKHJlc2V0T3RoZXJzKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBTbGlkZSAtIGluZmluaXRlIHNjcm9sbFxuICAgICAgaWYgKGNvbmZpZy5pbmZpbml0ZSAmJiBzaGlmdC54KSB7XG4gICAgICAgIHRyYW0oZGF0YS5zbGlkZXMubm90KHByZXZUYXJncykpXG4gICAgICAgICAgLnNldCh7dmlzaWJpbGl0eTogJycsIHg6IHNoaWZ0Lnh9KVxuICAgICAgICAgIC5hZGQoc2xpZGVSdWxlKVxuICAgICAgICAgIC5zdGFydCh7eDogb2Zmc2V0WH0pO1xuICAgICAgICB0cmFtKHByZXZUYXJncylcbiAgICAgICAgICAuc2V0KHt2aXNpYmlsaXR5OiAnJywgeDogc2hpZnQuZnJvbX0pXG4gICAgICAgICAgLmFkZChzbGlkZVJ1bGUpXG4gICAgICAgICAgLnN0YXJ0KHt4OiBzaGlmdC50b30pO1xuICAgICAgICBkYXRhLnNoaWZ0ZWQgPSBwcmV2VGFyZ3M7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoY29uZmlnLmluZmluaXRlICYmIGRhdGEuc2hpZnRlZCkge1xuICAgICAgICAgIHRyYW0oZGF0YS5zaGlmdGVkKS5zZXQoe3Zpc2liaWxpdHk6ICcnLCB4OiBsYXN0T2Zmc2V0WH0pO1xuICAgICAgICAgIGRhdGEuc2hpZnRlZCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTbGlkZSAtIGJhc2ljIHNjcm9sbFxuICAgICAgICB0cmFtKGRhdGEuc2xpZGVzKVxuICAgICAgICAgIC5zZXQoe3Zpc2liaWxpdHk6ICcnfSlcbiAgICAgICAgICAuYWRkKHNsaWRlUnVsZSlcbiAgICAgICAgICAuc3RhcnQoe3g6IG9mZnNldFh9KTtcbiAgICAgIH1cblxuICAgICAgLy8gSGVscGVyIHRvIG1vdmUgb3RoZXJzIG91dCBvZiB2aWV3XG4gICAgICBmdW5jdGlvbiByZXNldE90aGVycygpIHtcbiAgICAgICAgdGFyZ2V0cyA9ICQoYW5jaG9yc1tkYXRhLmluZGV4XS5lbHMpO1xuICAgICAgICBvdGhlcnMgPSBkYXRhLnNsaWRlcy5ub3QodGFyZ2V0cyk7XG4gICAgICAgIGlmIChhbmltYXRpb24gIT09ICdzbGlkZScpIHtcbiAgICAgICAgICByZXNldENvbmZpZy52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XG4gICAgICAgIH1cbiAgICAgICAgdHJhbShvdGhlcnMpLnNldChyZXNldENvbmZpZyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVuZGVyKGksIGVsKSB7XG4gICAgICB2YXIgZGF0YSA9ICQuZGF0YShlbCwgbmFtZXNwYWNlKTtcbiAgICAgIGlmICghZGF0YSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAobWFza0NoYW5nZWQoZGF0YSkpIHtcbiAgICAgICAgcmV0dXJuIGxheW91dChkYXRhKTtcbiAgICAgIH1cbiAgICAgIGlmIChkZXNpZ25lciAmJiBzbGlkZXNDaGFuZ2VkKGRhdGEpKSB7XG4gICAgICAgIGxheW91dChkYXRhKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsYXlvdXQoZGF0YSkge1xuICAgICAgLy8gRGV0ZXJtaW5lIHBhZ2UgY291bnQgZnJvbSB3aWR0aCBvZiBzbGlkZXNcbiAgICAgIHZhciBwYWdlcyA9IDE7XG4gICAgICB2YXIgb2Zmc2V0ID0gMDtcbiAgICAgIHZhciBhbmNob3IgPSAwO1xuICAgICAgdmFyIHdpZHRoID0gMDtcbiAgICAgIHZhciBtYXNrV2lkdGggPSBkYXRhLm1hc2tXaWR0aDtcbiAgICAgIHZhciB0aHJlc2hvbGQgPSBtYXNrV2lkdGggLSBkYXRhLmNvbmZpZy5lZGdlO1xuICAgICAgaWYgKHRocmVzaG9sZCA8IDApIHtcbiAgICAgICAgdGhyZXNob2xkID0gMDtcbiAgICAgIH1cbiAgICAgIGRhdGEuYW5jaG9ycyA9IFt7ZWxzOiBbXSwgeDogMCwgd2lkdGg6IDB9XTtcbiAgICAgIGRhdGEuc2xpZGVzLmVhY2goZnVuY3Rpb24gKGksIGVsKSB7XG4gICAgICAgIGlmIChhbmNob3IgLSBvZmZzZXQgPiB0aHJlc2hvbGQpIHtcbiAgICAgICAgICBwYWdlcysrO1xuICAgICAgICAgIG9mZnNldCArPSBtYXNrV2lkdGg7XG4gICAgICAgICAgLy8gU3RvcmUgcGFnZSBhbmNob3IgZm9yIHRyYW5zaXRpb25cbiAgICAgICAgICBkYXRhLmFuY2hvcnNbcGFnZXMgLSAxXSA9IHtlbHM6IFtdLCB4OiBhbmNob3IsIHdpZHRoOiAwfTtcbiAgICAgICAgfVxuICAgICAgICAvLyBTZXQgbmV4dCBhbmNob3IgdXNpbmcgY3VycmVudCB3aWR0aCArIG1hcmdpblxuICAgICAgICB3aWR0aCA9ICQoZWwpLm91dGVyV2lkdGgodHJ1ZSk7XG4gICAgICAgIGFuY2hvciArPSB3aWR0aDtcbiAgICAgICAgZGF0YS5hbmNob3JzW3BhZ2VzIC0gMV0ud2lkdGggKz0gd2lkdGg7XG4gICAgICAgIGRhdGEuYW5jaG9yc1twYWdlcyAtIDFdLmVscy5wdXNoKGVsKTtcblxuICAgICAgICB2YXIgYXJpYUxhYmVsID0gaSArIDEgKyAnIG9mICcgKyBkYXRhLnNsaWRlcy5sZW5ndGg7XG4gICAgICAgICQoZWwpLmF0dHIoJ2FyaWEtbGFiZWwnLCBhcmlhTGFiZWwpO1xuICAgICAgICAkKGVsKS5hdHRyKCdyb2xlJywgJ2dyb3VwJyk7XG4gICAgICB9KTtcbiAgICAgIGRhdGEuZW5kWCA9IGFuY2hvcjtcblxuICAgICAgLy8gQnVpbGQgZG90cyBpZiBuYXYgZXhpc3RzIGFuZCBuZWVkcyB1cGRhdGluZ1xuICAgICAgaWYgKGRlc2lnbmVyKSB7XG4gICAgICAgIGRhdGEucGFnZXMgPSBudWxsO1xuICAgICAgfVxuICAgICAgaWYgKGRhdGEubmF2Lmxlbmd0aCAmJiBkYXRhLnBhZ2VzICE9PSBwYWdlcykge1xuICAgICAgICBkYXRhLnBhZ2VzID0gcGFnZXM7XG4gICAgICAgIGJ1aWxkTmF2KGRhdGEpO1xuICAgICAgfVxuXG4gICAgICAvLyBNYWtlIHN1cmUgaW5kZXggaXMgc3RpbGwgd2l0aGluIHJhbmdlIGFuZCBjYWxsIGNoYW5nZSBoYW5kbGVyXG4gICAgICB2YXIgaW5kZXggPSBkYXRhLmluZGV4O1xuICAgICAgaWYgKGluZGV4ID49IHBhZ2VzKSB7XG4gICAgICAgIGluZGV4ID0gcGFnZXMgLSAxO1xuICAgICAgfVxuICAgICAgY2hhbmdlKGRhdGEsIHtpbW1lZGlhdGU6IHRydWUsIGluZGV4fSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYnVpbGROYXYoZGF0YSkge1xuICAgICAgdmFyIGRvdHMgPSBbXTtcbiAgICAgIHZhciAkZG90O1xuICAgICAgdmFyIHNwYWNpbmcgPSBkYXRhLmVsLmF0dHIoJ2RhdGEtbmF2LXNwYWNpbmcnKTtcbiAgICAgIGlmIChzcGFjaW5nKSB7XG4gICAgICAgIHNwYWNpbmcgPSBwYXJzZUZsb2F0KHNwYWNpbmcpICsgJ3B4JztcbiAgICAgIH1cbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBkYXRhLnBhZ2VzOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgJGRvdCA9ICQoZG90KTtcbiAgICAgICAgJGRvdFxuICAgICAgICAgIC5hdHRyKCdhcmlhLWxhYmVsJywgJ1Nob3cgc2xpZGUgJyArIChpICsgMSkgKyAnIG9mICcgKyBsZW4pXG4gICAgICAgICAgLmF0dHIoJ2FyaWEtcHJlc3NlZCcsICdmYWxzZScpXG4gICAgICAgICAgLmF0dHIoJ3JvbGUnLCAnYnV0dG9uJylcbiAgICAgICAgICAuYXR0cigndGFiaW5kZXgnLCAnLTEnKTtcbiAgICAgICAgaWYgKGRhdGEubmF2Lmhhc0NsYXNzKCd3LW51bScpKSB7XG4gICAgICAgICAgJGRvdC50ZXh0KGkgKyAxKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3BhY2luZyAhPSBudWxsKSB7XG4gICAgICAgICAgJGRvdC5jc3Moe1xuICAgICAgICAgICAgJ21hcmdpbi1sZWZ0Jzogc3BhY2luZyxcbiAgICAgICAgICAgICdtYXJnaW4tcmlnaHQnOiBzcGFjaW5nLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGRvdHMucHVzaCgkZG90KTtcbiAgICAgIH1cbiAgICAgIGRhdGEubmF2LmVtcHR5KCkuYXBwZW5kKGRvdHMpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG1hc2tDaGFuZ2VkKGRhdGEpIHtcbiAgICAgIHZhciBtYXNrV2lkdGggPSBkYXRhLm1hc2sud2lkdGgoKTtcbiAgICAgIGlmIChkYXRhLm1hc2tXaWR0aCAhPT0gbWFza1dpZHRoKSB7XG4gICAgICAgIGRhdGEubWFza1dpZHRoID0gbWFza1dpZHRoO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzbGlkZXNDaGFuZ2VkKGRhdGEpIHtcbiAgICAgIHZhciBzbGlkZXNXaWR0aCA9IDA7XG4gICAgICBkYXRhLnNsaWRlcy5lYWNoKGZ1bmN0aW9uIChpLCBlbCkge1xuICAgICAgICBzbGlkZXNXaWR0aCArPSAkKGVsKS5vdXRlcldpZHRoKHRydWUpO1xuICAgICAgfSk7XG4gICAgICBpZiAoZGF0YS5zbGlkZXNXaWR0aCAhPT0gc2xpZGVzV2lkdGgpIHtcbiAgICAgICAgZGF0YS5zbGlkZXNXaWR0aCA9IHNsaWRlc1dpZHRoO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBFeHBvcnQgbW9kdWxlXG4gICAgcmV0dXJuIGFwaTtcbiAgfSlcbik7XG4iXSwibmFtZXMiOlsiV2ViZmxvdyIsInJlcXVpcmUiLCJJWEV2ZW50cyIsIktFWV9DT0RFUyIsIkFSUk9XX0xFRlQiLCJBUlJPV19VUCIsIkFSUk9XX1JJR0hUIiwiQVJST1dfRE9XTiIsIlNQQUNFIiwiRU5URVIiLCJIT01FIiwiRU5EIiwiRk9DVVNBQkxFX1NFTEVDVE9SIiwiZGVmaW5lIiwibW9kdWxlIiwiZXhwb3J0cyIsIiQiLCJfIiwiYXBpIiwidHJhbSIsIiRkb2MiLCJkb2N1bWVudCIsIiRzbGlkZXJzIiwiZGVzaWduZXIiLCJpbkFwcCIsImVudiIsIm5hbWVzcGFjZSIsImRvdCIsImFyaWFMaXZlTGFiZWxIdG1sIiwiZm9yY2VTaG93IiwiaXgiLCJ0cmlnZ2VycyIsImZhbGxiYWNrIiwiaW5SZWRyYXciLCJyZWFkeSIsImluaXQiLCJkZXNpZ24iLCJzZXRUaW1lb3V0IiwicHJldmlldyIsInJlZHJhdyIsImRlc3Ryb3kiLCJyZW1vdmVMaXN0ZW5lcnMiLCJmaW5kIiwibGVuZ3RoIiwiZWFjaCIsImJ1aWxkIiwiYWRkTGlzdGVuZXJzIiwicmVzaXplIiwib2ZmIiwicmVuZGVyQWxsIiwib24iLCJmaWx0ZXIiLCJyZW5kZXIiLCJpIiwiZWwiLCIkZWwiLCJkYXRhIiwiaW5kZXgiLCJkZXB0aCIsImhhc0ZvY3VzIiwia2V5Ym9hcmQiLCJtb3VzZSIsImNvbmZpZyIsIm1hc2siLCJjaGlsZHJlbiIsImxlZnQiLCJyaWdodCIsIm5hdiIsInNsaWRlcyIsInJlc2V0IiwibWFza1dpZHRoIiwiYXR0ciIsInVuZGVmaW5lZCIsInNsaWRlVmlld0lkIiwiYXJpYUxpdmVMYWJlbCIsImFwcGVuZFRvIiwic3VwcG9ydCIsInRyYW5zZm9ybSIsImhpZGUiLCJjb25maWd1cmUiLCJoYW5kbGVyIiwic3RvcFRpbWVyIiwiaGFzVGltZXIiLCJwcmV2aW91c0Z1bmN0aW9uIiwibmV4dCIsImtleWJvYXJkU2xpZGVCdXR0b25zRnVuY3Rpb24iLCJhdXRvcGxheSIsInRpbWVyQ291bnQiLCJzdGFydFRpbWVyIiwiY29udGVudHMiLCJub2RlVHlwZSIsInJlbW92ZSIsIiRlbEhpZGRlbiIsImFkZENsYXNzIiwiJGVsSGlkZGVuUGFyZW50cyIsInBhcmVudHMiLCJyZW1vdmVDbGFzcyIsImNyb3NzT3ZlciIsImFuaW1hdGlvbiIsImVhc2luZyIsImR1cmF0aW9uIiwicGFyc2VJbnQiLCJpc0F0dHJUcnVlIiwiaW5maW5pdGUiLCJkaXNhYmxlU3dpcGUiLCJoaWRlQXJyb3dzIiwic2hvdyIsImRlbGF5IiwidGltZXJNYXgiLCJ0b3VjaEV2ZW50cyIsIm9uZSIsImFycm93V2lkdGgiLCJ3aWR0aCIsImVkZ2UiLCJ2YWx1ZSIsImZvY3VzSW4iLCJldmVudFR5cGUiLCJldnQiLCJjb250YWlucyIsImdldCIsInJlbGF0ZWRUYXJnZXQiLCJkaXJlY3Rpb25GdW5jdGlvbiIsImtleUNvZGUiLCJwcmV2ZW50RGVmYXVsdCIsInN0b3BQcm9wYWdhdGlvbiIsImNoYW5nZSIsInZlY3RvciIsInNlbGVjdCIsImZvdW5kIiwibGF5b3V0IiwiYW5jaG9ycyIsImFuY2hvciIsImVscyIsImltbWVkaWF0ZSIsInRpbWVySWQiLCJ3aW5kb3ciLCJjbGVhclRpbWVvdXQiLCJvcHRpb25zIiwidHlwZSIsImRpcmVjdGlvbiIsImhhcyIsInRhcmdldCIsImZvY3VzRG90IiwiTWF0aCIsIm1heCIsIm1pbiIsInBhZ2VzIiwiJG5hdiIsIiRhY3RpdmUiLCJlcSIsImZvY3VzIiwibm90IiwicHJldmlvdXMiLCJzaGlmdCIsIngiLCJlbmRYIiwiZnJvbSIsInRvIiwiZGlzcGF0Y2hFdmVudCIsIkN1c3RvbUV2ZW50IiwiZGV0YWlsIiwiYnViYmxlcyIsImxhc3RPZmZzZXRYIiwib2Zmc2V0WCIsInJlc2V0Q29uZmlnIiwib3BhY2l0eSIsInZpc2liaWxpdHkiLCJ0YXJnZXRzIiwicHJldlRhcmdzIiwib3RoZXJzIiwicm91bmQiLCJmYWRlUnVsZSIsInNsaWRlUnVsZSIsInJlbW92ZUF0dHIiLCJpbnRybyIsIm91dHJvIiwic2V0IiwicmVzZXRPdGhlcnMiLCJ0ZXh0IiwicmVkdWNlZCIsIndhaXQiLCJhZGQiLCJzdGFydCIsInpJbmRleCIsInRoZW4iLCJzdG9wIiwic2hpZnRlZCIsIm1hc2tDaGFuZ2VkIiwic2xpZGVzQ2hhbmdlZCIsIm9mZnNldCIsInRocmVzaG9sZCIsIm91dGVyV2lkdGgiLCJwdXNoIiwiYXJpYUxhYmVsIiwiYnVpbGROYXYiLCJkb3RzIiwiJGRvdCIsInNwYWNpbmciLCJwYXJzZUZsb2F0IiwibGVuIiwiaGFzQ2xhc3MiLCJjc3MiLCJlbXB0eSIsImFwcGVuZCIsInNsaWRlc1dpZHRoIl0sIm1hcHBpbmdzIjoiQUFBQSwyQkFBMkIsR0FFM0I7O0NBRUM7QUFFRCxJQUFJQSxVQUFVQyxRQUFRO0FBQ3RCLElBQUlDLFdBQVdELFFBQVE7QUFFdkIsTUFBTUUsWUFBWTtJQUNoQkMsWUFBWTtJQUNaQyxVQUFVO0lBQ1ZDLGFBQWE7SUFDYkMsWUFBWTtJQUNaQyxPQUFPO0lBQ1BDLE9BQU87SUFDUEMsTUFBTTtJQUNOQyxLQUFLO0FBQ1A7QUFFQSxNQUFNQyxxQkFDSjtBQUVGWixRQUFRYSxNQUFNLENBQ1osVUFDQ0MsT0FBT0MsT0FBTyxHQUFHLFNBQVVDLENBQUMsRUFBRUMsQ0FBQztJQUM5QixJQUFJQyxNQUFN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

}),
6206: (function (__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {
__webpack_require__(9461);__webpack_require__(7624);__webpack_require__(286);__webpack_require__(8334);__webpack_require__(2338);__webpack_require__(3695);__webpack_require__(322);__webpack_require__(941);__webpack_require__(5134);__webpack_require__(7527);__webpack_require__(2444);__webpack_require__(4345);__webpack_require__(9139);

}),

});
/************************************************************************/
// The module cache
var __webpack_module_cache__ = {};

// The require function
function __webpack_require__(moduleId) {

// Check if module is in cache
var cachedModule = __webpack_module_cache__[moduleId];
if (cachedModule !== undefined) {
return cachedModule.exports;
}
// Create a new module (and put it into the cache)
var module = (__webpack_module_cache__[moduleId] = {
id: moduleId,
loaded: false,
exports: {}
});
// Execute the module function
__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);

// Flag the module as loaded
module.loaded = true;
// Return the exports of the module
return module.exports;

}

// expose the modules object (__webpack_modules__)
__webpack_require__.m = __webpack_modules__;

/************************************************************************/
// webpack/runtime/define_property_getters
(() => {
__webpack_require__.d = (exports, definition) => {
	for(var key in definition) {
        if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
            Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
        }
    }
};
})();
// webpack/runtime/esm_module_decorator
(() => {
__webpack_require__.hmd = (module) => {
  module = Object.create(module);
  if (!module.children) module.children = [];
  Object.defineProperty(module, 'exports', {
      enumerable: true,
      set: () => {
          throw new Error('ES Modules may not assign module.exports or exports.*, Use ESM export syntax, instead: ' + module.id);
      }
  });
  return module;
};
})();
// webpack/runtime/global
(() => {
__webpack_require__.g = (() => {
	if (typeof globalThis === 'object') return globalThis;
	try {
		return this || new Function('return this')();
	} catch (e) {
		if (typeof window === 'object') return window;
	}
})();
})();
// webpack/runtime/has_own_property
(() => {
__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
})();
// webpack/runtime/make_namespace_object
(() => {
// define __esModule on exports
__webpack_require__.r = (exports) => {
	if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
	}
	Object.defineProperty(exports, '__esModule', { value: true });
};
})();
// webpack/runtime/node_module_decorator
(() => {
__webpack_require__.nmd = (module) => {
  module.paths = [];
  if (!module.children) module.children = [];
  return module;
};
})();
// webpack/runtime/on_chunk_loaded
(() => {
var deferred = [];
__webpack_require__.O = (result, chunkIds, fn, priority) => {
	if (chunkIds) {
		priority = priority || 0;
		for (var i = deferred.length; i > 0 && deferred[i - 1][2] > priority; i--)
			deferred[i] = deferred[i - 1];
		deferred[i] = [chunkIds, fn, priority];
		return;
	}
	var notFulfilled = Infinity;
	for (var i = 0; i < deferred.length; i++) {
		var [chunkIds, fn, priority] = deferred[i];
		var fulfilled = true;
		for (var j = 0; j < chunkIds.length; j++) {
			if (
				(priority & (1 === 0) || notFulfilled >= priority) &&
				Object.keys(__webpack_require__.O).every((key) => (__webpack_require__.O[key](chunkIds[j])))
			) {
				chunkIds.splice(j--, 1);
			} else {
				fulfilled = false;
				if (priority < notFulfilled) notFulfilled = priority;
			}
		}
		if (fulfilled) {
			deferred.splice(i--, 1);
			var r = fn();
			if (r !== undefined) result = r;
		}
	}
	return result;
};

})();
// webpack/runtime/rspack_version
(() => {
__webpack_require__.rv = () => ("1.3.9")
})();
// webpack/runtime/jsonp_chunk_loading
(() => {

      // object to store loaded and loading chunks
      // undefined = chunk not loaded, null = chunk preloaded/prefetched
      // [resolve, reject, Promise] = chunk loading, 0 = chunk loaded
      var installedChunks = {"834": 0,};
      __webpack_require__.O.j = (chunkId) => (installedChunks[chunkId] === 0);
// install a JSONP callback for chunk loading
var webpackJsonpCallback = (parentChunkLoadingFunction, data) => {
	var [chunkIds, moreModules, runtime] = data;
	// add "moreModules" to the modules object,
	// then flag all "chunkIds" as loaded and fire callback
	var moduleId, chunkId, i = 0;
	if (chunkIds.some((id) => (installedChunks[id] !== 0))) {
		for (moduleId in moreModules) {
			if (__webpack_require__.o(moreModules, moduleId)) {
				__webpack_require__.m[moduleId] = moreModules[moduleId];
			}
		}
		if (runtime) var result = runtime(__webpack_require__);
	}
	if (parentChunkLoadingFunction) parentChunkLoadingFunction(data);
	for (; i < chunkIds.length; i++) {
		chunkId = chunkIds[i];
		if (
			__webpack_require__.o(installedChunks, chunkId) &&
			installedChunks[chunkId]
		) {
			installedChunks[chunkId][0]();
		}
		installedChunks[chunkId] = 0;
	}
	return __webpack_require__.O(result);
};

var chunkLoadingGlobal = self["webpackChunk"] = self["webpackChunk"] || [];
chunkLoadingGlobal.forEach(webpackJsonpCallback.bind(null, 0));
chunkLoadingGlobal.push = webpackJsonpCallback.bind(null, chunkLoadingGlobal.push.bind(chunkLoadingGlobal));

})();
// webpack/runtime/rspack_unique_id
(() => {
__webpack_require__.ruid = "bundler=rspack@1.3.9";

})();
/************************************************************************/
// startup
// Load entry module and return exports
// This entry module depends on other loaded chunks and execution need to be delayed
var __webpack_exports__ = __webpack_require__.O(undefined, ["753", "772"], function() { return __webpack_require__(6206) });
__webpack_exports__ = __webpack_require__.O(__webpack_exports__);
})()
;