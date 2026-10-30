/* FORM Studio controller */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBV08YxtJZ0y6NgXOlRG26mna-jEfsS5tk',
    authDomain: 'aimuseum-8c30b.firebaseapp.com',
    projectId: 'aimuseum-8c30b'
  };
  const COPY = {
    ko: {
      headline: '형태와 우연 사이,\n나만의 작품을 만들다.',
      intro: '12가지 독립적인 조형 알고리즘으로 색, 구조, 흔적, 공간을 탐구합니다. 모든 작업은 브라우저에서 계산되며, 작가명과 시드를 저장하면 언제든 같은 작품을 다시 만들 수 있습니다.',
      create: '작품 생성하기', random: '새 시드', export: '고해상도 저장', share: '작품 링크 복사', exhibit: '전시 모드', publish: '뮤지엄에 게시',
      needArtist: '작가명을 입력해 주세요.', done: '작품 생성 완료', generating: '작품 구성 중…', ready: '준비 완료',
      publishOk: '작품을 뮤지엄에 게시했습니다.', authFail: '익명 인증에 실패했습니다. Firebase Authentication에서 Anonymous를 활성화해 주세요.',
      publishFail: '게시하지 못했습니다. Firestore 규칙과 네트워크 연결을 확인해 주세요.', copyOk: '작품 링크를 복사했습니다.', copyFail: '클립보드에 복사하지 못했습니다. 주소창의 링크를 직접 복사해 주세요.',
      audioOn: '사운드 켜기', audioOff: '사운드 끄기', audioFail: '이 브라우저에서 오디오를 시작할 수 없습니다.', exported: '3000 × 3000 px 작품을 저장했습니다.'
    },
    en: {
      headline: 'Between form and chance,\nmake your own artwork.',
      intro: 'Explore color, structure, gesture and space through 12 distinct visual algorithms. Everything is rendered in your browser. Save the artist name and seed to reproduce the same composition.',
      create: 'Create artwork', random: 'New seed', export: 'Export high resolution', share: 'Copy artwork link', exhibit: 'Exhibition mode', publish: 'Publish to museum',
      needArtist: 'Please enter an artist name.', done: 'Artwork complete', generating: 'Composing artwork…', ready: 'READY',
      publishOk: 'Your artwork has been added to the museum.', authFail: 'Anonymous sign-in failed. Enable Anonymous in Firebase Authentication.',
      publishFail: 'Publishing failed. Check Firestore rules and network connection.', copyOk: 'Artwork link copied.', copyFail: 'Could not access clipboard. Copy the URL from the address bar.',
      audioOn: 'Enable sound', audioOff: 'Disable sound', audioFail: 'Audio could not be started in this browser.', exported: 'Saved artwork at 3000 × 3000 px.'
    }
  };

  let language = localStorage.getItem('form-language') || 'ko';
  let db = null;
  let auth = null;
  let authPromise = null;
  let currentArt = null;
  let previewInstance = null;
  let exhibitInstance = null;
  let audioEngine = new FormAudioEngine();

  function message(text) {
    const toast = $('toast');
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(message.timer);
    message.timer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function setStatus(text) { $('status').textContent = text; }
  function textElement(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = text;
    return el;
  }

  function applyLanguage() {
    const c = COPY[language];
    $('headline').textContent = c.headline;
    $('intro').textContent = c.intro;
    $('createBtn').textContent = c.create;
    $('randomBtn').textContent = c.random;
    $('exportBtn').textContent = c.export;
    $('shareBtn').textContent = c.share;
    $('exhibitBtn').textContent = c.exhibit;
    $('publishBtn').textContent = c.publish;
    $('audioBtn').textContent = audioEngine.isRunning ? c.audioOff : c.audioOn;
    $('koBtn').classList.toggle('active', language === 'ko');
    $('enBtn').classList.toggle('active', language === 'en');
    $('style').querySelectorAll('option').forEach(option => {
      const style = ArtEngine.styleFor(Number(option.value));
      option.textContent = language === 'ko' ? style.ko : style.name;
    });
    if (currentArt) showCurationNotes();
  }

  function buildStyleOptions() {
    const select = $('style');
    ArtEngine.STYLES.forEach(style => {
      const option = document.createElement('option');
      option.value = String(style.id);
      option.textContent = language === 'ko' ? style.ko : style.name;
      select.appendChild(option);
    });
  }

  function randomSeed() {
    const values = new Uint32Array(1);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(values);
    else values[0] = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    return String(values[0] || 1);
  }

  function showCurationNotes() {
    if (!currentArt) return;
    const note = ArtEngine.curatorialNote(currentArt.genre, currentArt.seed);
    const wrap = $('notes');
    wrap.replaceChildren();
    wrap.append(
      textElement('div', 'note-heading', language === 'ko' ? `조형 언어 / ${note.title}` : `VISUAL LANGUAGE / ${ArtEngine.styleFor(currentArt.genre).name}`),
      textElement('p', 'note-copy', note.method),
      textElement('div', 'note-heading note-subhead', language === 'ko' ? '구성에 관한 메모' : 'COMPOSITION NOTE'),
      textElement('p', 'note-copy', note.reading),
      textElement('p', 'note-disclaimer', note.disclaimer)
    );
    $('metaArtist').textContent = currentArt.author;
    $('metaStyle').textContent = language === 'ko' ? ArtEngine.styleFor(currentArt.genre).ko : ArtEngine.styleFor(currentArt.genre).name;
    $('metaSeed').textContent = currentArt.seed;
  }

  function updateActionState(enabled) {
    ['exportBtn', 'shareBtn', 'exhibitBtn', 'publishBtn'].forEach(id => { $(id).disabled = !enabled; });
  }

  function renderPreview() {
    if (!currentArt) return;
    if (previewInstance) {
      previewInstance.remove();
      previewInstance = null;
    }
    const host = $('canvasHost');
    host.replaceChildren();
    const sketch = p => {
      p.setup = () => {
        const size = Math.max(320, Math.min(760, Math.floor(host.clientWidth || 640)));
        p.pixelDensity(1);
        p.createCanvas(size, size);
        p.canvas.setAttribute('role', 'img');
        p.canvas.setAttribute('aria-label', `${currentArt.author} — ${ArtEngine.styleFor(currentArt.genre).ko}`);
        ArtEngine.render(p, currentArt.seed, currentArt.genre, currentArt.author);
        p.noLoop();
      };
      p.windowResized = () => {
        const size = Math.max(320, Math.min(760, Math.floor(host.clientWidth || 640)));
        if (p.width !== size) {
          p.resizeCanvas(size, size);
          ArtEngine.render(p, currentArt.seed, currentArt.genre, currentArt.author);
          p.noLoop();
        }
      };
    };
    previewInstance = new p5(sketch, host);
  }

  function createArtwork(preloaded) {
    const author = $('artist').value.trim().replace(/\s+/g, ' ').slice(0, 28);
    if (!author) {
      message(COPY[language].needArtist);
      $('artist').focus();
      return;
    }
    $('artist').value = author;
    const genre = Number($('style').value) || 0;
    const rawSeed = preloaded && preloaded.seed != null ? preloaded.seed : $('seed').value.trim();
    const seed = ArtEngine.normalizeSeed(rawSeed || randomSeed());
    $('seed').value = String(seed);
    currentArt = { author, genre, seed };
    setStatus(COPY[language].generating);
    $('createBtn').disabled = true;
    updateActionState(true);
    requestAnimationFrame(() => {
      try {
        renderPreview();
        showCurationNotes();
        if (audioEngine.isRunning) audioEngine.setStyle(genre);
        setStatus(COPY[language].done);
      } catch (error) {
        console.error('Artwork render failed:', error);
        setStatus('RENDER ERROR');
        message('작품을 생성하지 못했습니다. 브라우저 콘솔을 확인해 주세요.');
      } finally {
        $('createBtn').disabled = false;
      }
    });
  }

  async function firebaseReady() {
    if (!window.firebase) throw new Error('Firebase SDK is not loaded.');
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
    if (!authPromise) {
      authPromise = auth.currentUser ? Promise.resolve(auth.currentUser) : auth.signInAnonymously().then(result => result.user);
    }
    try {
      return await authPromise;
    } catch (error) {
      authPromise = null; // Allow a later retry after a transient network/authentication failure.
      throw error;
    }
  }

  async function publishArtwork() {
    if (!currentArt) return;
    $('publishBtn').disabled = true;
    try {
      const user = await firebaseReady();
      if (!user) throw new Error('NO_AUTH_USER');
      const style = ArtEngine.styleFor(currentArt.genre);
      await db.collection('museum_arts').add({
        schemaVersion: 2,
        engineVersion: ArtEngine.VERSION,
        author: currentArt.author,
        ownerUid: user.uid,
        seed: currentArt.seed,
        genre: currentArt.genre,
        styleName: style.name,
        curateCount: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      message(COPY[language].publishOk);
    } catch (error) {
      console.error('Publish failed:', error);
      message(error.code === 'auth/operation-not-allowed' ? COPY[language].authFail : COPY[language].publishFail);
    } finally {
      $('publishBtn').disabled = false;
    }
  }

  function exportArtwork() {
    if (!currentArt) return;
    $('exportBtn').disabled = true;
    setStatus('EXPORT / 3000 PX');
    const art = { ...currentArt };
    const sketch = p => {
      p.setup = () => {
        p.pixelDensity(1);
        p.createCanvas(3000, 3000);
        p.noLoop();
        ArtEngine.render(p, art.seed, art.genre, art.author);
        const safeName = art.author.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 24) || 'FORM';
        p.saveCanvas(`FORM_${safeName}_${art.seed}`, 'jpg');
        setTimeout(() => p.remove(), 1200);
      };
    };
    const exportHost = document.createElement('div');
    exportHost.setAttribute('aria-hidden', 'true');
    Object.assign(exportHost.style, { position: 'fixed', left: '-10000px', top: '0', width: '1px', height: '1px', overflow: 'hidden' });
    document.body.appendChild(exportHost);
    const exportInstance = new p5(sketch, exportHost);
    // Keep the offscreen instance alive until p5 has handed the image to the browser download manager.
    setTimeout(() => {
      try { exportInstance.remove(); } catch (_) { /* already removed */ }
      exportHost.remove();
      $('exportBtn').disabled = false;
      setStatus(COPY[language].done);
      message(COPY[language].exported);
    }, 1800);
  }

  async function shareArtwork() {
    if (!currentArt) return;
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('author', currentArt.author);
    url.searchParams.set('seed', currentArt.seed);
    url.searchParams.set('style', currentArt.genre);
    try {
      await navigator.clipboard.writeText(url.toString());
      message(COPY[language].copyOk);
    } catch (error) {
      console.warn('Clipboard unavailable:', error);
      message(COPY[language].copyFail);
    }
  }

  function openExhibition() {
    if (!currentArt) return;
    $('exhibit').classList.add('open');
    if (exhibitInstance) exhibitInstance.remove();
    const host = $('exhibitCanvas');
    host.replaceChildren();
    exhibitInstance = new p5(p => {
      p.setup = () => {
        const size = Math.max(280, Math.floor(Math.min(window.innerWidth * .86, window.innerHeight * .82, 1000)));
        p.pixelDensity(1);
        p.createCanvas(size, size);
        ArtEngine.render(p, currentArt.seed, currentArt.genre, currentArt.author);
        p.noLoop();
      };
    }, host);
  }

  function closeExhibition() {
    $('exhibit').classList.remove('open');
    if (exhibitInstance) {
      exhibitInstance.remove();
      exhibitInstance = null;
    }
  }

  async function toggleAudio() {
    const c = COPY[language];
    $('audioBtn').disabled = true;
    try {
      if (audioEngine.isRunning) {
        await audioEngine.stop();
        $('audioBtn').textContent = c.audioOn;
      } else {
        await audioEngine.start(currentArt ? currentArt.genre : Number($('style').value));
        $('audioBtn').textContent = c.audioOff;
      }
    } catch (error) {
      console.error('Audio error:', error);
      message(c.audioFail);
    } finally {
      $('audioBtn').disabled = false;
    }
  }

  function initFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const author = params.get('author');
    const seed = params.get('seed');
    const style = params.get('style');
    if (author && seed !== null) {
      $('artist').value = author.slice(0, 28);
      $('seed').value = seed;
      if (style !== null && Number.isInteger(Number(style))) $('style').value = String(Math.max(0, Math.min(11, Number(style))));
      createArtwork({ seed });
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    buildStyleOptions();
    applyLanguage();
    $('createBtn').addEventListener('click', () => createArtwork());
    $('randomBtn').addEventListener('click', () => { $('seed').value = randomSeed(); if ($('artist').value.trim()) createArtwork(); });
    $('style').addEventListener('change', () => {
      const style = ArtEngine.styleFor(Number($('style').value));
      $('styleHint').textContent = language === 'ko' ? style.note : style.note;
      if (currentArt) {
        currentArt.genre = style.id;
        renderPreview();
        showCurationNotes();
      }
      if (audioEngine.isRunning) audioEngine.setStyle(style.id);
    });
    $('artist').addEventListener('keydown', event => { if (event.key === 'Enter') createArtwork(); });
    $('exportBtn').addEventListener('click', exportArtwork);
    $('shareBtn').addEventListener('click', shareArtwork);
    $('exhibitBtn').addEventListener('click', openExhibition);
    $('closeExhibit').addEventListener('click', closeExhibition);
    $('exhibit').addEventListener('click', event => { if (event.target === $('exhibit')) closeExhibition(); });
    $('publishBtn').addEventListener('click', publishArtwork);
    $('audioBtn').addEventListener('click', toggleAudio);
    $('volume').addEventListener('input', event => audioEngine.setVolume(Number(event.target.value) / 100));
    $('koBtn').addEventListener('click', () => { language = 'ko'; localStorage.setItem('form-language', language); applyLanguage(); });
    $('enBtn').addEventListener('click', () => { language = 'en'; localStorage.setItem('form-language', language); applyLanguage(); });
    $('closeExhibit').addEventListener('keydown', event => { if (event.key === 'Escape') closeExhibition(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeExhibition(); });
    $('styleHint').textContent = ArtEngine.styleFor(0).note;
    initFromUrl();
  });
})();
