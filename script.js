(function () {
  'use strict';

  // ── Color constants for scroll-reveal ────────────────────
  var LIGHT = [192, 185, 174]; // #C0B9AE
  var DARK  = [58, 51, 48];   // #3A3330

  // ── State ───────────────────────────────────────────────
  var globeMesh     = null;
  var globeRenderer = null;
  var globeScene    = null;
  var globeCamera   = null;
  var globeVelocity = 0.002;
  var lastScrollY   = 0;
  var navHidden     = false;

  // ═══════════════════════════════════════════════════════════
  //  STRANGER THINGS INTRO — character-level text animation
  // ═══════════════════════════════════════════════════════════

  var SPECIAL_WORDS = ['Strangers', 'friends'];

  function splitHeroText() {
    var lines = document.querySelectorAll('.h-line');

    lines.forEach(function (line) {
      var fragment = document.createDocumentFragment();
      processChildNodes(line.childNodes, fragment);
      line.innerHTML = '';
      line.appendChild(fragment);
    });
  }

  function processChildNodes(nodes, parent) {
    var nodeArr = Array.prototype.slice.call(nodes);

    nodeArr.forEach(function (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        var parts = node.textContent.split(/(\s+)/);
        parts.forEach(function (part) {
          if (/^\s+$/.test(part)) {
            parent.appendChild(document.createTextNode(' '));
          } else if (part.length > 0) {
            parent.appendChild(createWordSpan(part));
          }
        });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        var wrapper = document.createElement(node.tagName.toLowerCase());
        for (var i = 0; i < node.attributes.length; i++) {
          wrapper.setAttribute(node.attributes[i].name, node.attributes[i].value);
        }
        processChildNodes(node.childNodes, wrapper);
        parent.appendChild(wrapper);
      }
    });
  }

  function createWordSpan(word) {
    var span = document.createElement('span');
    span.className = 'hero-word';

    var isSpecial = SPECIAL_WORDS.indexOf(word) !== -1;
    if (isSpecial) {
      span.setAttribute('data-word', word);
      span.setAttribute('data-special', 'true');
    }

    for (var i = 0; i < word.length; i++) {
      var ch = document.createElement('span');
      ch.className = 'hero-char';
      if (isSpecial) ch.setAttribute('data-special', 'true');
      ch.textContent = word[i];
      span.appendChild(ch);
    }

    return span;
  }

  // ── Deterministic noise for organic randomness ──
  function noise(seed) {
    var x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // ── 2D simplex-ish noise for wave patterns ──
  function noise2D(x, y) {
    return noise(x * 12.9898 + y * 78.233 + 1.0);
  }

  function playHeroDiffusion() {
    if (typeof gsap === 'undefined') {
      var chars = document.querySelectorAll('.hero-char');
      for (var i = 0; i < chars.length; i++) chars[i].style.opacity = '1';
      var btn = document.querySelector('.hero-btn');
      if (btn) { btn.style.opacity = '1'; btn.style.transform = 'none'; }
      return;
    }

    var headline  = document.querySelector('.hero-headline');
    var allChars  = Array.prototype.slice.call(document.querySelectorAll('.hero-char'));
    var strangersEl = document.querySelector('.hero-word[data-word="Strangers"]');
    var friendsEl   = document.querySelector('em .hero-word[data-word="friends"]') ||
                      document.querySelector('.hero-word[data-word="friends"]');

    // ── 1. Measure every character's natural position ──
    var headRect = headline.getBoundingClientRect();
    var hCx = headRect.left + headRect.width / 2;
    var hCy = headRect.top  + headRect.height / 2;

    var charMeta = allChars.map(function (ch, idx) {
      var r = ch.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var cy = r.top  + r.height / 2;
      var dx = cx - hCx;
      var dy = cy - hCy;
      return {
        el: ch,
        idx: idx,
        dist: Math.sqrt(dx * dx + dy * dy),
        angle: Math.atan2(dy, dx),
        isSpecial: ch.hasAttribute('data-special'),
      };
    });

    var maxDist = 1;
    for (var m = 0; m < charMeta.length; m++) {
      if (charMeta[m].dist > maxDist) maxDist = charMeta[m].dist;
    }

    // Golden angle for beautiful spiral scatter
    var PHI_ANGLE = Math.PI * (3 - Math.sqrt(5));

    // ── 2. Set initial scattered state for each character ──
    charMeta.forEach(function (cm) {
      var i = cm.idx;

      // Scatter: use golden angle spiral + noise for organic distribution
      var spiralAngle = i * PHI_ANGLE + noise(i * 3.7) * 1.2;
      var scatterDist = 100 + noise(i * 5.3 + 17) * 200 + cm.dist * 0.4;

      // Special words get directional bias
      if (cm.isSpecial) {
        var wordEl = cm.el.closest('.hero-word');
        if (wordEl && wordEl.getAttribute('data-word') === 'Strangers') {
          spiralAngle = Math.PI + noise(i * 2.1) * 1.0 - 0.5;   // left
          scatterDist = 140 + noise(i * 4.4) * 180;
        } else {
          spiralAngle = noise(i * 2.1) * 1.0 - 0.5;             // right
          scatterDist = 140 + noise(i * 4.4) * 180;
        }
      }

      var startX = Math.cos(spiralAngle) * scatterDist;
      var startY = Math.sin(spiralAngle) * scatterDist * 0.6 - 20;

      gsap.set(cm.el, {
        x: startX,
        y: startY,
        opacity: 0,
        scale: 0.2 + noise(i * 2.1) * 0.3,
        rotation: (noise(i * 4.2) - 0.5) * 50,
        filter: 'blur(22px)',
      });
    });

    gsap.set('.hero-btn', { opacity: 0, y: 40 });
    gsap.set('nav', { y: -80, opacity: 0 });

    // ── 3. Build timeline with absolute positioning ──
    var tl = gsap.timeline();

    // Blob canvas — slow atmospheric fade
    tl.from('#hero-blob-canvas', {
      opacity: 0, duration: 3.5, ease: 'power1.inOut',
    }, 0.2);

    // ── 4. Diffusion wave — each char gets unique timing ──
    // Characters near center appear first, edge chars later
    // Noise perturbation prevents mechanical look
    charMeta.forEach(function (cm) {
      if (cm.isSpecial) return; // special words handled separately

      var i = cm.idx;

      // Radial wave: closer to center = earlier
      var normalizedDist = cm.dist / maxDist;
      var waveDelay = 0.6 + normalizedDist * 1.0;

      // Noise perturbation — up to +-0.4s jitter
      var noisePert = (noise2D(i * 0.7, cm.angle * 2.0) - 0.5) * 0.8;
      var charDelay = Math.max(0.5, waveDelay + noisePert);

      // Variable duration — distant chars take slightly longer
      var charDur = 1.3 + normalizedDist * 0.5 + noise(i * 3.9) * 0.3;

      // Opacity leads: appears blurry first, then sharpens
      tl.to(cm.el, {
        opacity: 1,
        duration: charDur * 0.35,
        ease: 'power2.in',
      }, charDelay);

      // Position + blur + scale converge together (slower)
      tl.to(cm.el, {
        x: 0, y: 0,
        scale: 1,
        rotation: 0,
        filter: 'blur(0px)',
        duration: charDur,
        ease: 'power3.out',
      }, charDelay);
    });

    // ── 5. Special words — converge last with drama ──
    var specialGroups = [
      { el: strangersEl, baseDelay: 2.2 },
      { el: friendsEl,   baseDelay: 2.5 },
    ];

    specialGroups.forEach(function (group) {
      if (!group.el) return;
      var chars = group.el.querySelectorAll('.hero-char');

      for (var c = 0; c < chars.length; c++) {
        var d = group.baseDelay + c * 0.045 + noise(c * 11.3 + group.baseDelay * 7) * 0.15;

        // Opacity first
        tl.to(chars[c], {
          opacity: 1,
          duration: 0.6,
          ease: 'power2.in',
        }, d);

        // Convergence
        tl.to(chars[c], {
          x: 0, y: 0,
          scale: 1,
          rotation: 0,
          filter: 'blur(0px)',
          duration: 1.6,
          ease: 'power2.out',
        }, d);

        // Subtle overshoot settle — char lands slightly large then shrinks
        tl.to(chars[c], {
          scale: 1.08,
          duration: 0.12,
          ease: 'power2.out',
        }, d + 1.4);
        tl.to(chars[c], {
          scale: 1,
          duration: 0.35,
          ease: 'power2.inOut',
        }, d + 1.52);
      }
    });

    // ── 6. CTA button + Nav ──
    tl.to('.hero-btn', {
      opacity: 1, y: 0,
      duration: 1.0,
      ease: 'power2.out',
    }, 3.4);

    tl.to('nav', {
      y: 0, opacity: 1,
      duration: 0.9,
      ease: 'power2.out',
      clearProps: 'transform,opacity',
    }, 4.2);

    // ── 7. After all animations — enable interactive effects ──
    tl.add(function () {
      // Clear GSAP inline styles from chars so mouse interaction can set transforms
      allChars.forEach(function (ch) {
        ch.style.transform = '';
        ch.style.filter = '';
        // Keep opacity visible (CSS default is 1)
        ch.style.opacity = '';
      });
      // Start interactive layers
      initHeroMouseInteraction();
      initButtonShimmer();
    }, '>');
  }

  // ═══════════════════════════════════════════════════════════
  //  HERO BLOB CANVAS — organic gradient blobs
  // ═══════════════════════════════════════════════════════════

  function initHeroBlobs() {
    var canvas = document.getElementById('hero-blob-canvas');
    if (!canvas) return;

    var ctx = canvas.getContext('2d');
    var hero = canvas.closest('.hero');

    function resize() {
      canvas.width  = hero.clientWidth;
      canvas.height = hero.clientHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    var blobs = [
      { x: 0.25, y: 0.3,  r: 220, color: 'rgba(196,155,140,0.45)', sx: 0.0004, sy: 0.0003, px: 0,     py: 0     },
      { x: 0.7,  y: 0.25, r: 180, color: 'rgba(185,175,200,0.35)', sx: 0.0003, sy: 0.0004, px: 1.5,   py: 0.8   },
      { x: 0.5,  y: 0.65, r: 200, color: 'rgba(160,185,170,0.30)', sx: 0.0005, sy: 0.0003, px: 3.0,   py: 2.1   },
      { x: 0.8,  y: 0.6,  r: 160, color: 'rgba(210,190,165,0.38)', sx: 0.0003, sy: 0.0005, px: 4.5,   py: 3.4   },
      { x: 0.15, y: 0.7,  r: 170, color: 'rgba(180,165,185,0.28)', sx: 0.0004, sy: 0.0004, px: 2.0,   py: 5.0   },
    ];

    var startTime = performance.now();
    var blobsRunning = false;

    function draw() {
      var w = canvas.width;
      var h = canvas.height;
      var t = (performance.now() - startTime) * 0.001;

      ctx.clearRect(0, 0, w, h);

      blobs.forEach(function (b) {
        var cx = b.x * w + Math.sin(t * b.sx * 1000 + b.px) * w * 0.12
                         + Math.sin(t * b.sx * 600 + b.px * 2.3) * w * 0.06;
        var cy = b.y * h + Math.cos(t * b.sy * 1000 + b.py) * h * 0.1
                         + Math.cos(t * b.sy * 700 + b.py * 1.7) * h * 0.05;

        var radius = b.r + Math.sin(t * 0.4 + b.px) * 20;

        var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, b.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      });

      var rect = hero.getBoundingClientRect();
      if (rect.bottom > -200 && rect.top < window.innerHeight + 200) {
        requestAnimationFrame(draw);
      } else {
        blobsRunning = false;
      }
    }

    function ensureBlobsRunning() {
      if (!blobsRunning) {
        blobsRunning = true;
        draw();
      }
    }

    window.addEventListener('scroll', ensureBlobsRunning, { passive: true });
    blobsRunning = true;
    draw();
  }

  // ═══════════════════════════════════════════════════════════
  //  SCROLL-REVEAL TEXT
  // ═══════════════════════════════════════════════════════════

  function initScrollReveal() {
    document.querySelectorAll('.scroll-reveal-text').forEach(function (el) {
      var text  = el.textContent.trim();
      var words = text.split(/\s+/);
      el.innerHTML = words
        .map(function (w) {
          return '<span class="scroll-word" style="color:rgb(' +
            LIGHT[0] + ',' + LIGHT[1] + ',' + LIGHT[2] + ')">' + w + '</span>';
        })
        .join(' ');
    });
  }

  function updateScrollWords() {
    var words       = document.querySelectorAll('.scroll-word');
    var vh          = window.innerHeight;
    var triggerTop  = vh * 0.32;
    var triggerBot  = vh * 0.68;
    var range       = triggerBot - triggerTop;

    words.forEach(function (word) {
      var rect    = word.getBoundingClientRect();
      var center  = rect.top + rect.height / 2;
      var progress;

      if (center <= triggerTop)      progress = 1;
      else if (center >= triggerBot) progress = 0;
      else                           progress = 1 - (center - triggerTop) / range;

      var r = Math.round(LIGHT[0] + (DARK[0] - LIGHT[0]) * progress);
      var g = Math.round(LIGHT[1] + (DARK[1] - LIGHT[1]) * progress);
      var b = Math.round(LIGHT[2] + (DARK[2] - LIGHT[2]) * progress);

      word.style.color = 'rgb(' + r + ',' + g + ',' + b + ')';
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  THREE.JS GLOBE
  // ═══════════════════════════════════════════════════════════

  function initGlobe() {
    var container = document.querySelector('.globe-container');
    var canvas    = document.getElementById('globe-canvas');
    if (!container || !canvas || typeof THREE === 'undefined') return;

    var width  = container.clientWidth;
    var height = container.clientHeight;

    globeScene    = new THREE.Scene();
    globeCamera   = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    globeRenderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });

    globeRenderer.setSize(width, height);
    globeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    globeCamera.position.z = 3.2;

    var ambient = new THREE.AmbientLight(0xFFFFFF, 0.85);
    globeScene.add(ambient);

    var dir = new THREE.DirectionalLight(0xFFF5E8, 1.0);
    dir.position.set(5, 3, 5);
    globeScene.add(dir);

    var dir2 = new THREE.DirectionalLight(0xE8DDD0, 0.4);
    dir2.position.set(-3, -2, 2);
    globeScene.add(dir2);

    var geometry = new THREE.SphereGeometry(1, 64, 64);
    var material = new THREE.MeshPhongMaterial({
      color:     0xE0D8CC,
      emissive:  0x2A2320,
      emissiveIntensity: 0.08,
      shininess: 12,
      specular:  0x555555,
    });
    globeMesh = new THREE.Mesh(geometry, material);
    globeScene.add(globeMesh);

    var loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    loader.load(
      'https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/earth-blue-marble.jpg',
      function (texture) {
        material.map = texture;
        material.color.set(0xF2EBE0);
        material.emissive.set(0x3A3020);
        material.emissiveIntensity = 0.1;
        material.needsUpdate = true;
      },
      undefined,
      function () {
        var c  = document.createElement('canvas');
        c.width = 512; c.height = 256;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#C8C0B0';
        ctx.fillRect(0, 0, 512, 256);
        ctx.fillStyle = 'rgba(170,162,148,0.35)';
        for (var i = 0; i < 40; i++) {
          ctx.beginPath();
          ctx.arc(
            Math.random() * 512,
            Math.random() * 256,
            Math.random() * 50 + 15,
            0, Math.PI * 2
          );
          ctx.fill();
        }
        var fallbackTex = new THREE.CanvasTexture(c);
        material.map = fallbackTex;
        material.needsUpdate = true;
      }
    );

    var wireGeo = new THREE.SphereGeometry(1.004, 36, 36);
    var wireMat = new THREE.MeshBasicMaterial({
      color:       0x3A3330,
      wireframe:   true,
      transparent: true,
      opacity:     0.05,
    });
    globeMesh.add(new THREE.Mesh(wireGeo, wireMat));

    globeMesh.rotation.x = 0.15;
    globeMesh.rotation.y = -0.5;

    window.addEventListener('resize', function () {
      var w = container.clientWidth;
      var h = container.clientHeight;
      globeCamera.aspect = w / h;
      globeCamera.updateProjectionMatrix();
      globeRenderer.setSize(w, h);
    });
  }

  function renderGlobe() {
    if (globeRenderer && globeScene && globeCamera) {
      globeRenderer.render(globeScene, globeCamera);
    }
  }

  function startGlobeLoop() {
    function loop() {
      requestAnimationFrame(loop);
      if (!globeMesh) return;

      globeMesh.rotation.y += globeVelocity;
      globeVelocity += (0.002 - globeVelocity) * 0.04;

      var container = document.querySelector('.globe-container');
      if (container) {
        var rect = container.getBoundingClientRect();
        if (rect.bottom > -300 && rect.top < window.innerHeight + 300) {
          renderGlobe();
        }
      }
    }
    loop();
  }

  // ═══════════════════════════════════════════════════════════
  //  COMPARISON BARS — re-trigger on every scroll pass
  // ═══════════════════════════════════════════════════════════

  function initComparisonBars() {
    var grid = document.querySelector('.comparison-grid');
    if (!grid) return;

    var cols = grid.querySelectorAll('.comparison-col');
    var colData = [];

    cols.forEach(function (col) {
      var bar     = col.querySelector('.comp-bar');
      var valueEl = col.querySelector('.comp-value');
      var numEl   = col.querySelector('.comp-num');
      if (!bar || !valueEl || !numEl) return;

      var text  = numEl.textContent.trim();
      var match = text.match(/^([\d.]+)\s*(.*)/);
      if (!match) return;

      var barHeight = bar.offsetHeight; // reads CSS height (360 / 90 / responsive)

      colData.push({
        bar: bar,
        valueEl: valueEl,
        numEl: numEl,
        barHeight: barHeight,
        target: parseFloat(match[1]),
        suffix: ' ' + match[2],
        isDecimal: match[1].indexOf('.') !== -1,
      });

      // Initial state — number at bottom, bar invisible
      bar.style.transform = 'scaleY(0)';
      valueEl.style.willChange = 'transform';
      valueEl.style.transform  = 'translateY(' + barHeight + 'px)';
      numEl.textContent = (match[1].indexOf('.') !== -1 ? '0.0' : '0') + ' ' + match[2];
    });

    function update() {
      var rect = grid.getBoundingClientRect();
      var vh   = window.innerHeight;

      // Scroll range: grid top entering at 82% vh → reaching 18% vh
      var start = vh * 0.82;
      var end   = vh * 0.18;

      var progress = 0;
      if (rect.top < start && rect.top > end) {
        progress = 1 - (rect.top - end) / (start - end);
      } else if (rect.top <= end) {
        progress = 1;
      }

      progress = Math.max(0, Math.min(1, progress));
      // Ease-out for satisfying deceleration at the top
      var eased = 1 - Math.pow(1 - progress, 2.5);

      colData.forEach(function (d) {
        d.bar.style.transform     = 'scaleY(' + eased + ')';
        d.valueEl.style.transform = 'translateY(' + (d.barHeight * (1 - eased)) + 'px)';

        var val = d.target * eased;
        d.numEl.textContent = (d.isDecimal ? val.toFixed(1) : Math.round(val)) + d.suffix;
      });
    }

    window._updateComparisonBars = update;
    update();
  }

  // ═══════════════════════════════════════════════════════════
  //  FAQ ACCORDION — smooth GSAP-powered
  // ═══════════════════════════════════════════════════════════

  function initFAQ() {
    var items = document.querySelectorAll('.faq-item');

    items.forEach(function (item) {
      var btn    = item.querySelector('.faq-question');
      var answer = item.querySelector('.faq-answer');

      btn.addEventListener('click', function () {
        var isOpen = item.classList.contains('open');

        items.forEach(function (otherItem) {
          if (otherItem !== item && otherItem.classList.contains('open')) {
            var otherAnswer = otherItem.querySelector('.faq-answer');
            otherItem.classList.remove('open');

            if (typeof gsap !== 'undefined') {
              gsap.to(otherAnswer, {
                height: 0,
                opacity: 0,
                duration: 0.4,
                ease: 'power2.inOut',
              });
            } else {
              otherAnswer.style.height = '0';
              otherAnswer.style.opacity = '0';
            }
          }
        });

        if (!isOpen) {
          item.classList.add('open');

          if (typeof gsap !== 'undefined') {
            answer.style.height = 'auto';
            var targetHeight = answer.scrollHeight;
            answer.style.height = '0px';

            gsap.to(answer, {
              height: targetHeight,
              opacity: 1,
              duration: 0.55,
              ease: 'power3.out',
              onComplete: function () {
                answer.style.height = 'auto';
              }
            });
          } else {
            answer.style.height = 'auto';
            answer.style.opacity = '1';
          }
        } else {
          item.classList.remove('open');

          if (typeof gsap !== 'undefined') {
            gsap.to(answer, {
              height: 0,
              opacity: 0,
              duration: 0.4,
              ease: 'power2.inOut',
            });
          } else {
            answer.style.height = '0';
            answer.style.opacity = '0';
          }
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  FAQ EPILOGUE — playful hover interaction
  // ═══════════════════════════════════════════════════════════

  function initEpilogueHover() {
    var epilogue = document.querySelector('.faq-epilogue');
    if (!epilogue || typeof gsap === 'undefined') return;

    // Split into word spans
    var text  = epilogue.textContent.trim();
    var words = text.split(/\s+/);

    epilogue.innerHTML = words.map(function (w) {
      return '<span class="epi-word">' + w + '</span>';
    }).join(' ');

    epilogue.style.cursor = 'default';

    var wordEls = Array.prototype.slice.call(
      epilogue.querySelectorAll('.epi-word')
    );
    wordEls.forEach(function (w) {
      w.style.display        = 'inline-block';
      w.style.willChange     = 'transform';
      w.style.transformOrigin = 'center bottom';
    });

    var hoverTimer = null;
    var isActive   = false;
    var currentX   = 0;

    // Cursor-following spotlight — words near cursor darken & lift
    function updateSpotlight(mx) {
      wordEls.forEach(function (w) {
        var wr  = w.getBoundingClientRect();
        var wcx = wr.left + wr.width / 2;
        var dist = Math.abs(wcx - mx);
        var maxDist = 180;
        var t = Math.max(0, 1 - dist / maxDist);
        t = t * t; // quadratic falloff — gentle edges

        // Interpolate color from light (#C0B9AE) to dark (#3A3330)
        var cr = Math.round(192 + (58 - 192) * t);
        var cg = Math.round(185 + (51 - 185) * t);
        var cb = Math.round(174 + (48 - 174) * t);

        gsap.to(w, {
          color: 'rgb(' + cr + ',' + cg + ',' + cb + ')',
          y: -3 * t,
          scaleY: 1 + 0.05 * t,
          duration: 0.25,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      });
    }

    epilogue.addEventListener('mouseenter', function (e) {
      currentX = e.clientX;

      // 350ms delay — prevents accidental trigger while scrolling past
      hoverTimer = setTimeout(function () {
        isActive = true;
        updateSpotlight(currentX);
      }, 350);
    });

    var rafPending = false;
    epilogue.addEventListener('mousemove', function (e) {
      currentX = e.clientX;
      if (isActive && !rafPending) {
        rafPending = true;
        requestAnimationFrame(function () {
          updateSpotlight(currentX);
          rafPending = false;
        });
      }
    });

    epilogue.addEventListener('mouseleave', function () {
      clearTimeout(hoverTimer);
      hoverTimer = null;

      if (isActive) {
        gsap.killTweensOf(wordEls);
        var len = wordEls.length;
        wordEls.forEach(function (w, i) {
          gsap.to(w, {
            color: '#C0B9AE',
            y: 0,
            scaleY: 1,
            duration: 0.35,
            delay: (len - 1 - i) * 0.04,
            ease: 'power2.inOut',
          });
        });
      }
      isActive = false;
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  FAQ PANEL — scroll-based width narrowing with fill-back
  // ═══════════════════════════════════════════════════════════

  function initFaqScrollWidth() {
    var panel   = document.querySelector('.faq-panel');
    var wrapper = document.querySelector('.faq-wrapper');
    if (!panel || !wrapper) return;

    function update() {
      var rect = wrapper.getBoundingClientRect();
      var vh   = window.innerHeight;
      var wrapH = wrapper.offsetHeight;

      // Phase 1: entering viewport — narrows (delayed so title is readable first)
      var enterStart = vh * 0.55;
      var enterEnd   = vh * 0.1;
      var enterProgress = 0;
      if (rect.top < enterStart && rect.top > enterEnd) {
        enterProgress = 1 - (rect.top - enterEnd) / (enterStart - enterEnd);
      } else if (rect.top <= enterEnd) {
        enterProgress = 1;
      }

      // Phase 2: exiting top — widens back (edges fill in)
      var exitStart = -wrapH * 0.4;
      var exitEnd   = -wrapH * 0.75;
      var exitProgress = 0;
      if (rect.top < exitStart && rect.top > exitEnd) {
        exitProgress = (rect.top - exitStart) / (exitEnd - exitStart);
      } else if (rect.top <= exitEnd) {
        exitProgress = 1;
      }

      // Combine: narrows in, then widens back out
      var progress = enterProgress * (1 - exitProgress);
      progress = Math.max(0, Math.min(1, progress));

      // Ease for smoother feel
      var eased = 1 - Math.pow(1 - progress, 3);

      var minRadius = 20;
      var maxRadius = 36;
      var maxMargin = 56;

      panel.style.borderRadius = (minRadius + eased * (maxRadius - minRadius)) + 'px';
      panel.style.marginLeft   = (eased * maxMargin) + 'px';
      panel.style.marginRight  = (eased * maxMargin) + 'px';
    }

    window._updateFaqWidth = update;
    update();
  }

  // ═══════════════════════════════════════════════════════════
  //  NAV — hide on scroll down, show on scroll up
  // ═══════════════════════════════════════════════════════════

  function updateNavVisibility() {
    var nav = document.querySelector('nav');
    if (!nav) return;

    var currentScrollY = window.scrollY;

    // Only hide after scrolling past the hero area
    if (currentScrollY > lastScrollY && currentScrollY > 100) {
      if (!navHidden) {
        nav.classList.add('nav-hidden');
        navHidden = true;
      }
    } else if (currentScrollY < lastScrollY) {
      if (navHidden) {
        nav.classList.remove('nav-hidden');
        navHidden = false;
      }
    }

    // Shadow when scrolled
    if (currentScrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }

    lastScrollY = currentScrollY;
  }

  // ═══════════════════════════════════════════════════════════
  //  EAGLE — zoom in on scroll
  // ═══════════════════════════════════════════════════════════

  function updateEagleZoom() {
    var eagle   = document.querySelector('.eagle-img');
    var section = document.querySelector('.eagle-section');
    if (!eagle || !section) return;

    var rect = section.getBoundingClientRect();
    var vh   = window.innerHeight;

    // Progress: 0 when section top is at bottom of viewport, 1 when at top
    var progress = 1 - (rect.top / vh);
    progress = Math.max(0, Math.min(1, progress));

    // Ease for smoothness
    var eased = progress * progress;

    var scale   = 0.45 + eased * 0.55;     // 0.45 → 1.0
    var opacity = 0.25 + eased * 0.75;     // 0.25 → 1.0

    eagle.style.transform = 'scale(' + scale + ')';
    eagle.style.opacity   = opacity;
  }

  // ═══════════════════════════════════════════════════════════
  //  GSAP — Scroll-triggered section reveals
  // ═══════════════════════════════════════════════════════════

  function initSectionReveals() {
    if (typeof gsap === 'undefined') return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            gsap.from(entry.target, {
              y: 40, opacity: 0,
              duration: 0.9,
              ease: 'power2.out',
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    ['.comparison']
      .forEach(function (sel) {
        var el = document.querySelector(sel);
        if (el) observer.observe(el);
      });
  }

  // ═══════════════════════════════════════════════════════════
  //  CTA CLICK — toast notification
  // ═══════════════════════════════════════════════════════════

  function initCTAClick() {
    var btn   = document.querySelector('.hero-btn');
    var toast = document.getElementById('toast');
    if (!btn || !toast) return;

    var toastTimeout;

    btn.addEventListener('click', function () {
      clearTimeout(toastTimeout);
      toast.classList.remove('show');
      void toast.offsetWidth;
      toast.classList.add('show');
      toastTimeout = setTimeout(function () {
        toast.classList.remove('show');
      }, 3000);
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  BUTTON SHIMMER — gradient wave on hover / click / idle
  // ═══════════════════════════════════════════════════════════

  function initButtonShimmer() {
    var btn = document.querySelector('.hero-btn');
    if (!btn || typeof gsap === 'undefined') return;

    // Create shimmer layer inside button
    var shimmer = document.createElement('span');
    shimmer.setAttribute('aria-hidden', 'true');
    shimmer.style.cssText = [
      'position:absolute',
      'top:0',
      'bottom:0',
      'left:-100%',
      'width:80%',
      'pointer-events:none',
      'z-index:1',
      'border-radius:inherit',
      'background:linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.07) 35%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.07) 65%, transparent 100%)'
    ].join(';');
    btn.appendChild(shimmer);

    function sweep(dur, intensity) {
      gsap.killTweensOf(shimmer);
      gsap.set(shimmer, { left: '-100%', opacity: intensity });
      gsap.to(shimmer, {
        left: '200%',
        duration: dur,
        ease: 'power2.inOut',
      });
    }

    // Idle shimmer — subtle pulse every 4.5s
    setInterval(function () {
      if (!btn.matches(':hover')) {
        sweep(1.6, 0.5);
      }
    }, 4500);

    // Hover — brighter, faster sweep
    btn.addEventListener('mouseenter', function () {
      sweep(0.65, 0.9);
    });

    // Click — full celebration burst (no shimmer sweep on click)
    btn.addEventListener('click', function () {
      playClickBurst(btn);
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  BUTTON CLICK BURST — colorful particle celebration
  // ═══════════════════════════════════════════════════════════

  function spawnParticle(cx, cy, color, index, total) {
    var dot = document.createElement('div');
    var size = 5 + Math.random() * 7;
    var isSquare = Math.random() > 0.6;

    dot.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'z-index:201',
      'border-radius:' + (isSquare ? '3px' : '50%'),
      'width:' + size + 'px',
      'height:' + size + 'px',
      'left:' + (cx - size / 2) + 'px',
      'top:' + (cy - size / 2) + 'px',
      'background:' + color
    ].join(';');
    document.body.appendChild(dot);

    var angle = (index / total) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
    var dist = 55 + Math.random() * 75;

    gsap.to(dot, {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist + 18,
      opacity: 0,
      scale: 0.15,
      rotation: (Math.random() - 0.5) * 400,
      duration: 0.55 + Math.random() * 0.3,
      ease: 'power2.out',
      onComplete: function () {
        if (dot.parentNode) dot.parentNode.removeChild(dot);
      }
    });
  }

  function playClickBurst(btn) {
    var rect = btn.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;

    // ── Particle burst — playful confetti ──
    var colors = [
      '#FF6B6B', '#FFD93D', '#6BCB77', '#4ECDC4',
      '#F7AEF8', '#FFA07A', '#87CEEB', '#DDA0DD'
    ];
    var count = 16;
    for (var i = 0; i < count; i++) {
      spawnParticle(cx, cy, colors[i % colors.length], i, count);
    }

    // ── Background color flash — warm burst ──
    gsap.timeline()
      .to(btn, { backgroundColor: '#D4725C', duration: 0.09 })
      .to(btn, { backgroundColor: '#C9A86C', duration: 0.09 })
      .to(btn, { backgroundColor: '#3A3330', duration: 0.4, ease: 'power2.out', clearProps: 'backgroundColor' });

    // ── Text flash — bright white pulse ──
    gsap.timeline()
      .to(btn, { color: '#FFFFFF', duration: 0.07 })
      .to(btn, { color: '#E8E2D6', duration: 0.4, ease: 'power2.out', clearProps: 'color' });

    // ── Expanding glow shadow ──
    gsap.fromTo(btn,
      { boxShadow: '0 0 0 0 rgba(255,107,107,0.5)' },
      { boxShadow: '0 0 50px 10px rgba(255,107,107,0)', duration: 0.7, ease: 'power2.out', clearProps: 'boxShadow' }
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  HERO MOUSE INTERACTION — subtle magnetic repulsion
  // ═══════════════════════════════════════════════════════════

  function initHeroMouseInteraction() {
    var hero = document.querySelector('.hero');
    if (!hero) return;

    var chars = Array.prototype.slice.call(
      document.querySelectorAll('.hero-headline .hero-char')
    );
    if (!chars.length) return;

    var mouseX = -9999, mouseY = -9999;
    var isActive = false;
    var rafId = null;
    var positions = []; // cached rest positions

    var RADIUS   = 120;   // effect radius in px
    var STRENGTH = 5;     // max displacement in px
    var LERP_IN  = 0.12;  // spring toward target
    var LERP_OUT = 0.08;  // spring back to rest

    // Per-char state
    var state = chars.map(function () {
      return { x: 0, y: 0 };
    });

    function cachePositions() {
      positions = chars.map(function (ch, i) {
        var r = ch.getBoundingClientRect();
        // Subtract current displacement to get rest position
        return {
          x: r.left + r.width / 2 - state[i].x,
          y: r.top  + r.height / 2 - state[i].y
        };
      });
    }

    function loop() {
      var settled = true;

      for (var i = 0; i < chars.length; i++) {
        var s = state[i];
        var p = positions[i];
        if (!p) continue;

        var tx = 0, ty = 0;

        if (isActive) {
          var dx = p.x - mouseX;
          var dy = p.y - mouseY;
          var dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < RADIUS && dist > 1) {
            var f = (1 - dist / RADIUS);
            f = f * f; // quadratic falloff — softer feel
            tx = (dx / dist) * f * STRENGTH;
            ty = (dy / dist) * f * STRENGTH;
          }
        }

        var lr = isActive ? LERP_IN : LERP_OUT;
        s.x += (tx - s.x) * lr;
        s.y += (ty - s.y) * lr;

        if (Math.abs(s.x) > 0.05 || Math.abs(s.y) > 0.05) {
          settled = false;
          chars[i].style.transform =
            'translate(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px)';
        } else if (s.x !== 0 || s.y !== 0) {
          s.x = 0;
          s.y = 0;
          chars[i].style.transform = '';
        }
      }

      if (!isActive && settled) {
        rafId = null;
        return;
      }

      rafId = requestAnimationFrame(loop);
    }

    function startLoop() {
      if (!rafId) rafId = requestAnimationFrame(loop);
    }

    hero.addEventListener('mouseenter', function () {
      isActive = true;
      cachePositions();
      startLoop();
    });

    hero.addEventListener('mouseleave', function () {
      isActive = false;
      mouseX = -9999;
      mouseY = -9999;
      // loop continues until all chars spring back
    });

    hero.addEventListener('mousemove', function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (isActive && !rafId) startLoop();
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  FOOTER TAGLINE — word-by-word reveal + floating hover
  // ═══════════════════════════════════════════════════════════

  function initFooterTagline() {
    var el = document.querySelector('.footer-final');
    if (!el || typeof gsap === 'undefined') return;

    var text  = el.textContent.trim();
    var words = text.split(/\s+/);

    // Find sentence break (first word after a period that isn't the last)
    var sentenceBreak = -1;
    for (var i = 0; i < words.length - 1; i++) {
      if (words[i].charAt(words[i].length - 1) === '.') {
        sentenceBreak = i + 1;
        break;
      }
    }

    el.innerHTML = words.map(function (w) {
      return '<span class="ft-word">' + w + '</span>';
    }).join(' ');

    var wordEls = Array.prototype.slice.call(el.querySelectorAll('.ft-word'));
    wordEls.forEach(function (w) {
      w.style.display    = 'inline-block';
      w.style.opacity    = '0';
      w.style.willChange = 'transform, opacity';
    });

    el.style.cursor = 'default';

    var hasPlayed = false;

    // Scroll-triggered reveal
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !hasPlayed) {
            hasPlayed = true;
            playTaglineReveal(wordEls, sentenceBreak);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    observer.observe(el);

    // Hover — gentle floating bob
    el.addEventListener('mouseenter', function () {
      if (!hasPlayed) return;

      gsap.killTweensOf(wordEls);
      wordEls.forEach(function (w, i) {
        gsap.to(w, {
          color: '#3A3330',
          duration: 0.3,
          delay: i * 0.05,
          ease: 'power2.out',
        });
        // Each word bobs at its own rhythm
        gsap.to(w, {
          y: -2.5,
          duration: 0.7 + i * 0.12,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          delay: i * 0.08,
        });
      });
    });

    el.addEventListener('mouseleave', function () {
      if (!hasPlayed) return;

      gsap.killTweensOf(wordEls);
      var len = wordEls.length;
      wordEls.forEach(function (w, i) {
        gsap.to(w, {
          color: '#C0B9AE',
          y: 0,
          duration: 0.4,
          delay: (len - 1 - i) * 0.04,
          ease: 'power2.inOut',
        });
      });
    });
  }

  function playTaglineReveal(wordEls, sentenceBreak) {
    wordEls.forEach(function (w, i) {
      var inS2  = sentenceBreak > 0 && i >= sentenceBreak;
      var delay;

      if (!inS2) {
        delay = i * 0.2;
      } else {
        // Time for sentence 1 + dramatic pause + faster sentence 2
        var s1Time = sentenceBreak * 0.2;
        var pause  = 0.55;
        delay = s1Time + pause + (i - sentenceBreak) * 0.14;
      }

      gsap.fromTo(w,
        { opacity: 0, y: 12 },
        {
          opacity: 1,
          y: 0,
          duration: inS2 ? 0.35 : 0.5,
          delay: delay,
          ease: inS2 ? 'back.out(2.5)' : 'power2.out',
        }
      );
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  MAIN SCROLL HANDLER
  // ═══════════════════════════════════════════════════════════

  var scrollTicking = false;

  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;

    requestAnimationFrame(function () {
      updateScrollWords();
      updateNavVisibility();
      updateEagleZoom();

      if (window._updateComparisonBars) window._updateComparisonBars();
      if (window._updateFaqWidth) window._updateFaqWidth();

      // Boost globe spin on scroll
      globeVelocity = 0.012;

      scrollTicking = false;
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════════════════

  function init() {
    // Split hero text into character spans first
    splitHeroText();

    // Non-animation setup
    initScrollReveal();
    initHeroBlobs();
    initGlobe();
    initComparisonBars();
    initFAQ();
    initEpilogueHover();
    initFaqScrollWidth();
    initCTAClick();
    initSectionReveals();
    initFooterTagline();

    // Play the mathematical diffusion intro
    playHeroDiffusion();

    // Initial scroll state
    updateScrollWords();
    updateEagleZoom();
    renderGlobe();

    // Scroll listener
    window.addEventListener('scroll', onScroll, { passive: true });

    // Globe render loop
    startGlobeLoop();
  }

  // Ensure DOM is ready before init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
