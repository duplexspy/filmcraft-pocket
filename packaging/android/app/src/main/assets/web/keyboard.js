// Virtual Laptop Keyboard for FilmCraft Pocket Android & Mobile Web
(function () {
  'use strict';

  // State
  const state = {
    visible: false,
    transparent: false,
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    capsLock: false,
    numLock: true,
    ctrlLocked: false,
    altLocked: false,
    shiftLocked: false,
    metaLocked: false,
  };

  const canvasId = 'filmcraft_canvas';

  function getCanvas() {
    return document.getElementById(canvasId) || document.querySelector('canvas') || document.body;
  }

  // Dual Dispatch: DOM KeyboardEvent + window.filmcraft control protocol
  function sendKeyEvent(action, keyName, codeName, keyCodeVal, isChar) {
    const isDown = action === 'keydown';
    const target = getCanvas();

    const effectiveShift = state.shift || (state.capsLock && isChar);
    const effectiveCtrl = state.ctrl;
    const effectiveAlt = state.alt;
    const effectiveMeta = state.meta;

    const eventInit = {
      key: keyName,
      code: codeName,
      keyCode: keyCodeVal,
      which: keyCodeVal,
      charCode: isDown && isChar && keyName.length === 1 ? keyName.charCodeAt(0) : 0,
      bubbles: true,
      cancelable: true,
      composed: true,
      ctrlKey: effectiveCtrl,
      altKey: effectiveAlt,
      shiftKey: effectiveShift,
      metaKey: effectiveMeta,
    };

    const evt = new KeyboardEvent(action, eventInit);
    try {
      target.dispatchEvent(evt);
      window.dispatchEvent(evt);
      document.dispatchEvent(evt);
    } catch (e) {
      console.warn('Dispatch event error:', e);
    }

    // Also communicate through window.filmcraft if present
    if (window.filmcraft && typeof window.filmcraft.request === 'function') {
      try {
        let scKey = keyName;
        if (codeName && codeName.startsWith('Numpad')) {
          if (codeName === 'Numpad0') scKey = 'Num0';
        }
        window.filmcraft.request('ui.key', {
          key: scKey,
          ctrl: effectiveCtrl,
          alt: effectiveAlt,
          shift: effectiveShift,
          pressed: isDown,
        }).catch(() => {});
      } catch (err) {}
    }
  }

  function sendTypeChar(char) {
    if (window.filmcraft && typeof window.filmcraft.request === 'function') {
      window.filmcraft.request('ui.type', { text: char }).catch(() => {});
    }
  }

  // Send full key press (down then up)
  function sendKeyPress(keyName, codeName, keyCodeVal, isChar) {
    sendKeyEvent('keydown', keyName, codeName, keyCodeVal, isChar);
    setTimeout(() => {
      sendKeyEvent('keyup', keyName, codeName, keyCodeVal, isChar);
      if (isChar && keyName.length === 1 && !state.ctrl && !state.alt && !state.meta) {
        sendTypeChar(keyName);
      }
      // If modifiers were latched (not locked), unlatch them
      if (state.ctrl && !state.ctrlLocked) { state.ctrl = false; }
      if (state.alt && !state.altLocked) { state.alt = false; }
      if (state.shift && !state.shiftLocked) { state.shift = false; }
      if (state.meta && !state.metaLocked) { state.meta = false; }
      updateModifierUI();
    }, 15);
  }

  function updateModifierUI() {
    const updateKey = (selector, active, locked) => {
      const el = document.querySelector(selector);
      if (!el) return;
      el.classList.toggle('fc-kb-key-active', locked);
      el.classList.toggle('fc-kb-key-latched', active && !locked);
    };

    updateKey('[data-code="ControlLeft"]', state.ctrl, state.ctrlLocked);
    updateKey('[data-code="ControlRight"]', state.ctrl, state.ctrlLocked);
    updateKey('[data-code="AltLeft"]', state.alt, state.altLocked);
    updateKey('[data-code="AltRight"]', state.alt, state.altLocked);
    updateKey('[data-code="ShiftLeft"]', state.shift, state.shiftLocked);
    updateKey('[data-code="ShiftRight"]', state.shift, state.shiftLocked);
    updateKey('[data-code="MetaLeft"]', state.meta, state.metaLocked);
    updateKey('[data-code="CapsLock"]', state.capsLock, state.capsLock);
  }

  function toggleModifier(modName) {
    if (modName === 'ctrl') {
      if (!state.ctrl) { state.ctrl = true; state.ctrlLocked = false; }
      else if (!state.ctrlLocked) { state.ctrlLocked = true; }
      else { state.ctrl = false; state.ctrlLocked = false; }
    } else if (modName === 'alt') {
      if (!state.alt) { state.alt = true; state.altLocked = false; }
      else if (!state.altLocked) { state.altLocked = true; }
      else { state.alt = false; state.altLocked = false; }
    } else if (modName === 'shift') {
      if (!state.shift) { state.shift = true; state.shiftLocked = false; }
      else if (!state.shiftLocked) { state.shiftLocked = true; }
      else { state.shift = false; state.shiftLocked = false; }
    } else if (modName === 'meta') {
      if (!state.meta) { state.meta = true; state.metaLocked = false; }
      else if (!state.metaLocked) { state.metaLocked = true; }
      else { state.meta = false; state.metaLocked = false; }
    } else if (modName === 'caps') {
      state.capsLock = !state.capsLock;
    }
    updateModifierUI();
  }

  function toggleVirtualKeyboard() {
    state.visible = !state.visible;
    const kb = document.getElementById('fc-keyboard-container');
    if (kb) {
      kb.classList.toggle('fc-kb-hidden', !state.visible);
    }
  }

  function showVirtualKeyboard() {
    state.visible = true;
    const kb = document.getElementById('fc-keyboard-container');
    if (kb) kb.classList.remove('fc-kb-hidden');
  }

  function hideVirtualKeyboard() {
    state.visible = false;
    const kb = document.getElementById('fc-keyboard-container');
    if (kb) kb.classList.add('fc-kb-hidden');
  }

  function toggleHorizontalMode() {
    if (window.AndroidBridge && window.AndroidBridge.toggleHorizontalMode) {
      window.AndroidBridge.toggleHorizontalMode();
    } else {
      if (screen.orientation && screen.orientation.lock) {
        const isLandscape = window.innerWidth > window.innerHeight;
        screen.orientation.lock(isLandscape ? 'portrait' : 'landscape').catch(() => {});
      }
    }
  }

  window.toggleVirtualKeyboard = toggleVirtualKeyboard;
  window.showVirtualKeyboard = showVirtualKeyboard;
  window.hideVirtualKeyboard = hideVirtualKeyboard;
  window.toggleHorizontalMode = toggleHorizontalMode;

  function buildDOM() {
    if (document.getElementById('fc-keyboard-container')) return;

    // 1. Floating trigger buttons
    const floatBtn = document.createElement('div');
    floatBtn.id = 'fc-floating-kb-btn';
    floatBtn.title = 'Open FilmCraft Pocket Laptop Keyboard';
    floatBtn.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/>
      </svg>
    `;

    // Make floating button draggable
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialX = 0, initialY = 0;
    let moved = false;

    floatBtn.addEventListener('pointerdown', (e) => {
      isDragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      const rect = floatBtn.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      try { floatBtn.setPointerCapture(e.pointerId); } catch (_) {}
    });

    floatBtn.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.hypot(dx, dy) > 8) {
        moved = true;
        floatBtn.style.left = `${Math.max(10, Math.min(window.innerWidth - 64, initialX + dx))}px`;
        floatBtn.style.top = `${Math.max(10, Math.min(window.innerHeight - 64, initialY + dy))}px`;
        floatBtn.style.right = 'auto';
        floatBtn.style.bottom = 'auto';
      }
    });

    floatBtn.addEventListener('pointerup', (e) => {
      if (isDragging) {
        isDragging = false;
        try { floatBtn.releasePointerCapture(e.pointerId); } catch (_) {}
        if (!moved) {
          toggleVirtualKeyboard();
        }
      }
    });

    // Orientation button
    const orientBtn = document.createElement('div');
    orientBtn.id = 'fc-floating-orient-btn';
    orientBtn.title = 'Toggle Fullscreen Horizontal / Vertical';
    orientBtn.innerHTML = '⛶';
    orientBtn.addEventListener('click', () => toggleHorizontalMode());

    // 2. Keyboard overlay container
    const kb = document.createElement('div');
    kb.id = 'fc-keyboard-container';
    kb.className = 'fc-kb-hidden';

    kb.innerHTML = `
      <div class="fc-kb-header">
        <div class="fc-kb-header-left">
          <span class="fc-kb-title">FilmCraft Pocket <span style="font-size:10px; color:#a1a1aa; font-weight:normal;">by duplexspy</span></span>
          <div class="fc-kb-community-links" style="display:inline-flex; gap:6px;">
            <a href="https://discord.gg/xyTRSa9SK" target="_blank" class="fc-kb-action-btn" style="text-decoration:none; color:#a5b4fc; font-weight:bold;">Discord</a>
            <a href="https://t.me/+hAhK5AnoAvI3Y2U1" target="_blank" class="fc-kb-action-btn" style="text-decoration:none; color:#38bdf8; font-weight:bold;">Telegram</a>
          </div>
          <div class="fc-kb-quick-actions">
            <button class="fc-kb-action-btn" data-action="panLeft">◄ Pan Left</button>
            <button class="fc-kb-action-btn" data-action="panRight">Pan Right ►</button>
            <button class="fc-kb-action-btn" data-action="hand">✋ Hand (H)</button>
            <button class="fc-kb-action-btn" data-action="space">Play/Pause (Space)</button>
            <button class="fc-kb-action-btn" data-action="razor">Cut (C)</button>
            <button class="fc-kb-action-btn" data-action="undo">Undo (Ctrl+Z)</button>
            <button class="fc-kb-action-btn" data-action="redo">Redo (Ctrl+Y)</button>
            <button class="fc-kb-action-btn" data-action="save">Save (Ctrl+S)</button>
            <button class="fc-kb-action-btn" data-action="delete">Delete</button>
            <button class="fc-kb-action-btn" data-action="fit">Fit (\\)</button>
            <button class="fc-kb-action-btn" data-action="zoomIn">Zoom In (+)</button>
            <button class="fc-kb-action-btn" data-action="zoomOut">Zoom Out (-)</button>
            <button class="fc-kb-action-btn" data-action="orient">⛶ Rotate</button>
          </div>
        </div>
        <div class="fc-kb-header-right">
          <button class="fc-kb-tool-btn" id="fc-kb-opacity-btn" title="Toggle Transparency">◐</button>
          <button class="fc-kb-tool-btn" id="fc-kb-close-btn" title="Close Keyboard">✕</button>
        </div>
      </div>

      <div class="fc-kb-body">
        <div class="fc-kb-section-main">
          <!-- Row 0: Function Keys -->
          <div class="fc-kb-row">
            <button class="fc-kb-key fc-kb-key-fn" data-key="Escape" data-code="Escape" data-keycode="27">Esc</button>
            <button class="fc-kb-key fc-kb-key-fn" data-key="F1" data-code="F1" data-keycode="112">F1</button>
            <button class="fc-kb-key fc-kb-key-fn" data-key="F2" data-code="F2" data-keycode="113">F2</button>
            <button class="fc-kb-key fc-kb-key-fn" data-key="F3" data-code="F3" data-keycode="114">F3</button>
            <button class="fc-kb-key fc-kb-key-fn" data-key="F4" data-code="F4" data-keycode="115">F4</button>
            <button class="fc-kb-key fc-kb-key-fn" data-key="F5" data-code="F5" data-keycode="116">F5</button>
            <button class="fc-kb-key fc-kb-key-fn" data-key="F6" data-code="F6" data-keycode="117">F6</button>
            <button class="fc-kb-key fc-kb-key-fn" data-key="F7" data-code="F7" data-keycode="118">F7</button>
            <button class="fc-kb-key fc-kb-key-fn" data-key="F8" data-code="F8" data-keycode="119">F8</button>
            <button class="fc-kb-key fc-kb-key-fn" data-key="F9" data-code="F9" data-keycode="120">F9</button>
            <button class="fc-kb-key fc-kb-key-fn" data-key="F10" data-code="F10" data-keycode="121">F10</button>
            <button class="fc-kb-key fc-kb-key-fn" data-key="F11" data-code="F11" data-keycode="122">F11</button>
            <button class="fc-kb-key fc-kb-key-fn" data-key="F12" data-code="F12" data-keycode="123">F12</button>
          </div>

          <!-- Row 1: Numbers & Symbols -->
          <div class="fc-kb-row">
            <button class="fc-kb-key" data-key="\`" data-shift="~" data-code="Backquote" data-keycode="192"><span class="fc-kb-sub">~</span><span class="fc-kb-main-label">\`</span></button>
            <button class="fc-kb-key" data-key="1" data-shift="!" data-code="Digit1" data-keycode="49"><span class="fc-kb-sub">!</span><span class="fc-kb-main-label">1</span></button>
            <button class="fc-kb-key" data-key="2" data-shift="@" data-code="Digit2" data-keycode="50"><span class="fc-kb-sub">@</span><span class="fc-kb-main-label">2</span></button>
            <button class="fc-kb-key" data-key="3" data-shift="#" data-code="Digit3" data-keycode="51"><span class="fc-kb-sub">#</span><span class="fc-kb-main-label">3</span></button>
            <button class="fc-kb-key" data-key="4" data-shift="$" data-code="Digit4" data-keycode="52"><span class="fc-kb-sub">$</span><span class="fc-kb-main-label">4</span></button>
            <button class="fc-kb-key" data-key="5" data-shift="%" data-code="Digit5" data-keycode="53"><span class="fc-kb-sub">%</span><span class="fc-kb-main-label">5</span></button>
            <button class="fc-kb-key" data-key="6" data-shift="^" data-code="Digit6" data-keycode="54"><span class="fc-kb-sub">^</span><span class="fc-kb-main-label">6</span></button>
            <button class="fc-kb-key" data-key="7" data-shift="&" data-code="Digit7" data-keycode="55"><span class="fc-kb-sub">&amp;</span><span class="fc-kb-main-label">7</span></button>
            <button class="fc-kb-key" data-key="8" data-shift="*" data-code="Digit8" data-keycode="56"><span class="fc-kb-sub">*</span><span class="fc-kb-main-label">8</span></button>
            <button class="fc-kb-key" data-key="9" data-shift="(" data-code="Digit9" data-keycode="57"><span class="fc-kb-sub">(</span><span class="fc-kb-main-label">9</span></button>
            <button class="fc-kb-key" data-key="0" data-shift=")" data-code="Digit0" data-keycode="48"><span class="fc-kb-sub">)</span><span class="fc-kb-main-label">0</span></button>
            <button class="fc-kb-key" data-key="-" data-shift="_" data-code="Minus" data-keycode="189"><span class="fc-kb-sub">_</span><span class="fc-kb-main-label">-</span></button>
            <button class="fc-kb-key" data-key="=" data-shift="+" data-code="Equal" data-keycode="187"><span class="fc-kb-sub">+</span><span class="fc-kb-main-label">=</span></button>
            <button class="fc-kb-key fc-kb-w-1-5" data-key="Backspace" data-code="Backspace" data-keycode="8">⌫ Back</button>
          </div>

          <!-- Row 2: QWERTY -->
          <div class="fc-kb-row">
            <button class="fc-kb-key fc-kb-w-1-5" data-key="Tab" data-code="Tab" data-keycode="9">Tab ⇥</button>
            <button class="fc-kb-key" data-letter="q" data-code="KeyQ" data-keycode="81">Q</button>
            <button class="fc-kb-key" data-letter="w" data-code="KeyW" data-keycode="87">W</button>
            <button class="fc-kb-key" data-letter="e" data-code="KeyE" data-keycode="69">E</button>
            <button class="fc-kb-key" data-letter="r" data-code="KeyR" data-keycode="82">R</button>
            <button class="fc-kb-key" data-letter="t" data-code="KeyT" data-keycode="84">T</button>
            <button class="fc-kb-key" data-letter="y" data-code="KeyY" data-keycode="89">Y</button>
            <button class="fc-kb-key" data-letter="u" data-code="KeyU" data-keycode="85">U</button>
            <button class="fc-kb-key" data-letter="i" data-code="KeyI" data-keycode="73">I</button>
            <button class="fc-kb-key" data-letter="o" data-code="KeyO" data-keycode="79">O</button>
            <button class="fc-kb-key" data-letter="p" data-code="KeyP" data-keycode="80">P</button>
            <button class="fc-kb-key" data-key="[" data-shift="{" data-code="BracketLeft" data-keycode="219"><span class="fc-kb-sub">{</span><span class="fc-kb-main-label">[</span></button>
            <button class="fc-kb-key" data-key="]" data-shift="}" data-code="BracketRight" data-keycode="221"><span class="fc-kb-sub">}</span><span class="fc-kb-main-label">]</span></button>
            <button class="fc-kb-key" data-key="\\" data-shift="|" data-code="Backslash" data-keycode="220"><span class="fc-kb-sub">|</span><span class="fc-kb-main-label">\\</span></button>
          </div>

          <!-- Row 3: ASDF -->
          <div class="fc-kb-row">
            <button class="fc-kb-key fc-kb-w-1-75" data-action="caps" data-code="CapsLock" data-keycode="20">Caps ⇪</button>
            <button class="fc-kb-key" data-letter="a" data-code="KeyA" data-keycode="65">A</button>
            <button class="fc-kb-key" data-letter="s" data-code="KeyS" data-keycode="83">S</button>
            <button class="fc-kb-key" data-letter="d" data-code="KeyD" data-keycode="68">D</button>
            <button class="fc-kb-key" data-letter="f" data-code="KeyF" data-keycode="70">F</button>
            <button class="fc-kb-key" data-letter="g" data-code="KeyG" data-keycode="71">G</button>
            <button class="fc-kb-key" data-letter="h" data-code="KeyH" data-keycode="72">H</button>
            <button class="fc-kb-key" data-letter="j" data-code="KeyJ" data-keycode="74">J</button>
            <button class="fc-kb-key" data-letter="k" data-code="KeyK" data-keycode="75">K</button>
            <button class="fc-kb-key" data-letter="l" data-code="KeyL" data-keycode="76">L</button>
            <button class="fc-kb-key" data-key=";" data-shift=":" data-code="Semicolon" data-keycode="186"><span class="fc-kb-sub">:</span><span class="fc-kb-main-label">;</span></button>
            <button class="fc-kb-key" data-key="'" data-shift='"' data-code="Quote" data-keycode="222"><span class="fc-kb-sub">"</span><span class="fc-kb-main-label">'</span></button>
            <button class="fc-kb-key fc-kb-w-2" data-key="Enter" data-code="Enter" data-keycode="13">↵ Enter</button>
          </div>

          <!-- Row 4: ZXCV -->
          <div class="fc-kb-row">
            <button class="fc-kb-key fc-kb-w-2-25" data-mod="shift" data-code="ShiftLeft" data-keycode="16">⇧ Shift</button>
            <button class="fc-kb-key" data-letter="z" data-code="KeyZ" data-keycode="90">Z</button>
            <button class="fc-kb-key" data-letter="x" data-code="KeyX" data-keycode="88">X</button>
            <button class="fc-kb-key" data-letter="c" data-code="KeyC" data-keycode="67">C</button>
            <button class="fc-kb-key" data-letter="v" data-code="KeyV" data-keycode="86">V</button>
            <button class="fc-kb-key" data-letter="b" data-code="KeyB" data-keycode="66">B</button>
            <button class="fc-kb-key" data-letter="n" data-code="KeyN" data-keycode="78">N</button>
            <button class="fc-kb-key" data-letter="m" data-code="KeyM" data-keycode="77">M</button>
            <button class="fc-kb-key" data-key="," data-shift="&lt;" data-code="Comma" data-keycode="188"><span class="fc-kb-sub">&lt;</span><span class="fc-kb-main-label">,</span></button>
            <button class="fc-kb-key" data-key="." data-shift="&gt;" data-code="Period" data-keycode="190"><span class="fc-kb-sub">&gt;</span><span class="fc-kb-main-label">.</span></button>
            <button class="fc-kb-key" data-key="/" data-shift="?" data-code="Slash" data-keycode="191"><span class="fc-kb-sub">?</span><span class="fc-kb-main-label">/</span></button>
            <button class="fc-kb-key" data-key="ArrowUp" data-code="ArrowUp" data-keycode="38">▲</button>
            <button class="fc-kb-key" data-key="Delete" data-code="Delete" data-keycode="46">Del</button>
          </div>

          <!-- Row 5: Bottom Space Row -->
          <div class="fc-kb-row">
            <button class="fc-kb-key fc-kb-w-1-5" data-mod="ctrl" data-code="ControlLeft" data-keycode="17">Ctrl</button>
            <button class="fc-kb-key fc-kb-w-1-25" data-mod="alt" data-code="AltLeft" data-keycode="18">Alt</button>
            <button class="fc-kb-key fc-kb-w-1-25" data-mod="meta" data-code="MetaLeft" data-keycode="91">⌘</button>
            <button class="fc-kb-key fc-kb-w-6" data-key=" " data-code="Space" data-keycode="32">␣ Space (Play/Pause)</button>
            <button class="fc-kb-key" data-key="ArrowLeft" data-code="ArrowLeft" data-keycode="37">◀</button>
            <button class="fc-kb-key" data-key="ArrowDown" data-code="ArrowDown" data-keycode="40">▼</button>
            <button class="fc-kb-key" data-key="ArrowRight" data-code="ArrowRight" data-keycode="39">▶</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(floatBtn);
    document.body.appendChild(orientBtn);
    document.body.appendChild(kb);

    // Event listeners
    document.getElementById('fc-kb-close-btn').addEventListener('click', hideVirtualKeyboard);
    document.getElementById('fc-kb-opacity-btn').addEventListener('click', () => {
      state.transparent = !state.transparent;
      kb.classList.toggle('fc-kb-transparent', state.transparent);
    });

    // Key handlers
    kb.querySelectorAll('.fc-kb-key').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (btn.dataset.mod) {
          toggleModifier(btn.dataset.mod);
          return;
        }

        if (btn.dataset.action === 'caps') {
          toggleModifier('caps');
          return;
        }

        if (btn.dataset.letter) {
          const char = (state.shift || state.capsLock) ? btn.dataset.letter.toUpperCase() : btn.dataset.letter.toLowerCase();
          const code = btn.dataset.code;
          const keycode = parseInt(btn.dataset.keycode, 10);
          sendKeyPress(char, code, keycode, true);
          return;
        }

        if (btn.dataset.key) {
          const char = state.shift && btn.dataset.shift ? btn.dataset.shift : btn.dataset.key;
          const code = btn.dataset.code;
          const keycode = parseInt(btn.dataset.keycode, 10);
          const isChar = char.length === 1;
          sendKeyPress(char, code, keycode, isChar);
        }
      });
    });

    // Quick Action button handlers
    kb.querySelectorAll('.fc-kb-action-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = btn.dataset.action;

        if (action === 'panLeft') {
          const canvas = getCanvas();
          if (canvas) {
            canvas.dispatchEvent(new WheelEvent('wheel', { deltaX: -180, bubbles: true, cancelable: true }));
          }
        } else if (action === 'panRight') {
          const canvas = getCanvas();
          if (canvas) {
            canvas.dispatchEvent(new WheelEvent('wheel', { deltaX: 180, bubbles: true, cancelable: true }));
          }
        } else if (action === 'hand') {
          sendKeyPress('h', 'KeyH', 72, true);
        } else if (action === 'zoomIn') {
          sendKeyPress('=', 'Equal', 187, true);
        } else if (action === 'zoomOut') {
          sendKeyPress('-', 'Minus', 189, true);
        } else if (action === 'space') {
          sendKeyPress(' ', 'Space', 32, true);
        } else if (action === 'razor') {
          sendKeyPress('c', 'KeyC', 67, true);
        } else if (action === 'undo') {
          state.ctrl = true;
          sendKeyPress('z', 'KeyZ', 90, false);
          state.ctrl = false;
        } else if (action === 'redo') {
          state.ctrl = true;
          sendKeyPress('y', 'KeyY', 89, false);
          state.ctrl = false;
        } else if (action === 'save') {
          state.ctrl = true;
          sendKeyPress('s', 'KeyS', 83, false);
          state.ctrl = false;
        } else if (action === 'delete') {
          sendKeyPress('Delete', 'Delete', 46, false);
        } else if (action === 'fit') {
          sendKeyPress('\\', 'Backslash', 220, true);
        } else if (action === 'orient') {
          toggleHorizontalMode();
        }
      });
    });

    // Mobile touch gestures: Two-finger swipe to pan/scroll canvas
    let touchState = { count: 0, startX: 0, startY: 0, lastX: 0, lastY: 0 };
    window.addEventListener('touchstart', (e) => {
      touchState.count = e.touches.length;
      if (e.touches.length === 2) {
        touchState.startX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        touchState.startY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        touchState.lastX = touchState.startX;
        touchState.lastY = touchState.startY;
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const curX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const curY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const dx = touchState.lastX - curX;
        const dy = touchState.lastY - curY;
        touchState.lastX = curX;
        touchState.lastY = curY;

        const canvas = getCanvas();
        if (canvas) {
          const wheelEvt = new WheelEvent('wheel', {
            deltaX: dx * 1.5,
            deltaY: dy * 1.5,
            clientX: curX,
            clientY: curY,
            bubbles: true,
            cancelable: true,
          });
          canvas.dispatchEvent(wheelEvt);
        }
      }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      touchState.count = e.touches.length;
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildDOM);
  } else {
    buildDOM();
  }
})();
