(function () {
    'use strict';

    // ── Helpers ────────────────────────────────────────────

    function parseRelativeTime(currTime) {
        var unit = '';
        var offset = 0;
        var sign = -1;
        var table = {
            s : 1,
            m : 60,
            h : 3600,
            d : 86400,
            w : 604800,
            mo : 2592000,
            y : 31536000,
        };
        var regexStr = currTime.match(/[+\-]|[^a-z]+|[a-zA-Z]+/gi);
        if (regexStr[0] == '+')
            sign = 1;
        for (var i = 1; i < regexStr.length; i = i + 2) {
            unit = regexStr[i + 1].slice(0, 1);
            if (regexStr[i + 1].slice(0, 2) == 'mo' || (regexStr[i + 1] == 'm' && Math.abs(regexStr[i]) <= 5))
                unit = 'mo';
            offset += regexStr[i] * table[unit];
        }
        offset = offset * sign;
        return Math.floor(Date.now() / 1000) + offset;
    }

    // ── Navigator zoom (replaces Cropper.js) ──────────────

    var StartEpoch = 0;
    var EndEpoch = 0;

    function changeRRDImage(coords) {
        window.stop();

        var SelectLeft = Math.min(coords.x1, coords.x2);
        var SelectRight = Math.max(coords.x1, coords.x2);

        if (SelectLeft == SelectRight)
            return;

        var zoomImg = document.getElementById('zoom');
        var RRDLeft = 67;
        var RRDRight = 26;
        var RRDImgWidth = zoomImg.offsetWidth;
        var RRDImgUsable = RRDImgWidth - RRDRight - RRDLeft;

        if (StartEpoch == 0) {
            var startVal = document.getElementById('epoch_start').value;
            StartEpoch = +startVal;
            if (isNaN(StartEpoch))
                StartEpoch = parseRelativeTime(startVal);
        }
        if (EndEpoch == 0) {
            var endVal = document.getElementById('epoch_end').value;
            EndEpoch = +endVal;
            if (isNaN(EndEpoch))
                EndEpoch = parseRelativeTime(endVal);
        }
        var DivEpoch = EndEpoch - StartEpoch;

        var Target = document.getElementById('target').value;
        var Hierarchy = document.getElementById('hierarchy').value;

        var myURL = location.href.split('?')[0];

        var LeftFactor = 1;
        var RightFactor = 1;

        if (SelectLeft < RRDLeft)
            LeftFactor = 10;

        StartEpoch = Math.floor(StartEpoch + (SelectLeft - RRDLeft) * DivEpoch / RRDImgUsable * LeftFactor);

        if (SelectRight > RRDImgWidth - RRDRight)
            RightFactor = 10;

        EndEpoch = Math.ceil(EndEpoch + (SelectRight - (RRDImgWidth - RRDRight)) * DivEpoch / RRDImgUsable * RightFactor);

        zoomImg.src = myURL + '?displaymode=a&start=' + StartEpoch + '&end=' + EndEpoch + '&target=' + Target + '&hierarchy=' + Hierarchy;
    }

    function initCropper(zoomImg) {
        var wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';
        wrapper.style.cursor = 'crosshair';
        zoomImg.parentNode.insertBefore(wrapper, zoomImg);
        wrapper.appendChild(zoomImg);

        var selection = null;
        var startX = 0;

        wrapper.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            e.preventDefault();
            var rect = wrapper.getBoundingClientRect();
            startX = e.clientX - rect.left;

            selection = document.createElement('div');
            selection.style.position = 'absolute';
            selection.style.top = '0';
            selection.style.height = '100%';
            selection.style.left = startX + 'px';
            selection.style.width = '0';
            selection.style.background = 'rgba(79, 156, 249, 0.3)';
            selection.style.border = '1px solid rgba(79, 156, 249, 0.6)';
            selection.style.pointerEvents = 'none';
            wrapper.appendChild(selection);

            function onMove(e) {
                var currentX = e.clientX - rect.left;
                var left = Math.min(startX, currentX);
                var width = Math.abs(currentX - startX);
                selection.style.left = left + 'px';
                selection.style.width = width + 'px';
            }

            function onUp(e) {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                if (selection && selection.parentNode) {
                    selection.parentNode.removeChild(selection);
                }
                var endX = e.clientX - rect.left;
                var imgHeight = zoomImg.offsetHeight;
                changeRRDImage({
                    x1: startX,
                    y1: 0,
                    x2: endX,
                    y2: imgHeight,
                });
                selection = null;
            }

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    // ── Range form submit ─────────────────────────────────

    var rangeForm = document.getElementById('range_form');
    if (rangeForm != null && rangeForm.length) {
        rangeForm.addEventListener('submit', function () {
            var actionAttr = rangeForm.getAttribute('action');
            var cgiurl = ((actionAttr === null) ? '' : actionAttr).split("?");

            var action = new URLSearchParams(new FormData(rangeForm)).toString().split("&");
            action = action.map(function (i) { return i + '&'; });

            rangeForm.setAttribute('action', cgiurl[0] + "?" + action[4] + action[5] + action[6] + action[3]);
        });
    }

    // ── Dynamic graph width ───────────────────────────────

    var resizeTimer;
    var PADDING = 18;
    var MIN_WIDTH = 200;
    var MAX_WIDTH = 3000;

    function clamp(w) {
        return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w));
    }

    function getContentWidth() {
        var panel = document.querySelector('.main .panel-body');
        if (panel) return panel.clientWidth - PADDING;
        var main = document.querySelector('.main');
        if (main) return main.clientWidth - 40;
        return 0;
    }

    function currentUrlWidth() {
        var m = location.search.match(/[?&]width=(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
    }

    function buildWidthUrl(w) {
        var url = location.href;
        if (/[?&]width=\d+/.test(url)) {
            return url.replace(/([?&]width=)\d+/, '$1' + w);
        }
        return url + (url.indexOf('?') === -1 ? '?' : '&') + 'width=' + w;
    }

    function recordWidth() {
        var w = clamp(getContentWidth());
        if (w <= 0) return;
        if (w !== currentUrlWidth()) {
            location.replace(buildWidthUrl(w));
        }
    }

    function revealGraphs() {
        var imgs = document.querySelectorAll('.panel-body img, .panel-body svg');
        for (var i = 0; i < imgs.length; i++) {
            imgs[i].style.transition = 'opacity 0.3s ease';
            imgs[i].style.opacity = '1';
        }
    }

    var w = clamp(getContentWidth());
    if (w > 0) {
        history.replaceState(null, '', buildWidthUrl(w));
    }
    revealGraphs();

    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(recordWidth, 500);
    });

    document.addEventListener('click', function (e) {
        var link = e.target.closest('a[href]');
        if (!link) return;
        var href = link.getAttribute('href');
        if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0) return;
        if (link.origin !== location.origin) return;
        var lw = clamp(getContentWidth());
        if (lw <= 0) return;
        var hashIdx = href.indexOf('#');
        var base = hashIdx === -1 ? href : href.slice(0, hashIdx);
        var frag = hashIdx === -1 ? '' : href.slice(hashIdx);
        if (/[?&]width=\d+/.test(base)) {
            base = base.replace(/([?&]width=)\d+/, '$1' + lw);
        } else {
            base += (base.indexOf('?') === -1 ? '?' : '&') + 'width=' + lw;
        }
        e.preventDefault();
        location.href = base + frag;
    });

    // ── In-place graph refresh ────────────────────────────

    var refresh;

    function refreshGraphs() {
        var imgs = document.querySelectorAll('.panel-body img, .overview img, .details img');
        var t = Date.now();
        for (var i = 0; i < imgs.length; i++) {
            var img = imgs[i];
            if (img.id === 'zoom') continue;
            var src = img.getAttribute('src');
            if (!src) continue;
            img.style.opacity = '0.3';
            if (/[?&]_t=\d+/.test(src)) {
                src = src.replace(/([?&]_t=)\d+/, '$1' + t);
            } else {
                src += (src.indexOf('?') === -1 ? '?' : '&') + '_t=' + t;
            }
            (function (el) {
                el.onload = function () { el.style.opacity = '1'; };
                el.onerror = function () { el.style.opacity = '1'; };
            })(img);
            img.setAttribute('src', src);
        }
    }
    // expose for console testing
    window.refreshGraphs = refreshGraphs;

    function scheduleRefresh() {
        return setTimeout(function () {
            refreshGraphs();
            refresh = scheduleRefresh();
        }, window.options.step * 1000);
    }

    // ── Init (defer guarantees DOM is ready) ──────────────

    var bodyEl = document.getElementById('body');
    var sidebar = document.getElementById('sidebar');
    var menuBtn = document.getElementById('menu-button');
    var refreshBtn = document.getElementById('refresh-button');

    if (!localStorage.getItem("noRefresh")) {
        refresh = scheduleRefresh();
        refreshBtn.style.textDecoration = "line-through";
    }

    menuBtn.addEventListener('click', function (e) {
        if (getComputedStyle(sidebar).left == '0px') {
            bodyEl.classList.add('sidebar-hidden');
            bodyEl.classList.remove('sidebar-visible');
        } else {
            bodyEl.classList.remove('sidebar-hidden');
            bodyEl.classList.add('sidebar-visible');
        }
        e.preventDefault();
    });

    refreshBtn.addEventListener('click', function (e) {
        if (localStorage.getItem("noRefresh")) {
            localStorage.removeItem("noRefresh");
            refresh = scheduleRefresh();
            refreshBtn.style.textDecoration = "line-through";
        } else {
            clearTimeout(refresh);
            localStorage.setItem("noRefresh", true);
            refreshBtn.style.textDecoration = "none";
        }
        e.preventDefault();
    });

    var zoomImg = document.getElementById('zoom');
    if (zoomImg != null) {
        initCropper(zoomImg);
    }

})();
