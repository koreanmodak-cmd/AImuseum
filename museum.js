/* FORM Museum Gallery controller */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBV08YxtJZ0y6NgXOlRG26mna-jEfsS5tk',
    authDomain: 'aimuseum-8c30b.firebaseapp.com',
    projectId: 'aimuseum-8c30b'
  };
  const PAGE_SIZE = 12;
  let db = null;
  let auth = null;
  let sortMode = 'latest';
  let lastDocument = null;
  let isLoading = false;
  let canLoadMore = true;
  let modalSketch = null;
  let observer = null;
  let sketchRecords = new Map();
  let currentModalTrigger = null;

  function showMessage(text, type) {
    const node = document.createElement('div');
    node.className = `state-message ${type || 'empty'}`;
    node.textContent = text;
    $('gallery').replaceChildren(node);
  }

  function clearSketches() {
    if (observer) observer.disconnect();
    sketchRecords.forEach(record => {
      if (record.instance) record.instance.remove();
    });
    sketchRecords.clear();
  }

  function createThumbnail(host, record, key) {
    if (!host.isConnected || sketchRecords.has(key)) return;
    const sketch = p => {
      p.setup = () => {
        const size = Math.max(190, Math.min(460, Math.floor(host.clientWidth || 280)));
        p.pixelDensity(1);
        p.createCanvas(size, size);
        p.canvas.setAttribute('aria-hidden', 'true');
        ArtEngine.render(p, record.seed, record.genre, record.author, { signature: false });
        p.noLoop();
      };
    };
    const instance = new p5(sketch, host);
    sketchRecords.set(key, { instance, host });
  }

  function observeThumbnail(host, record, key) {
    if (!observer) {
      createThumbnail(host, record, key);
      return;
    }
    observer.observe(host);
    host.dataset.artKey = key;
    host._formArtwork = record;
  }

  function makeCard(doc) {
    const data = doc.data() || {};
    const record = {
      id: doc.id,
      author: String(data.author || 'UNTITLED').slice(0, 28),
      seed: ArtEngine.normalizeSeed(data.seed),
      genre: Number.isInteger(data.genre) && data.genre >= 0 && data.genre <= 11 ? data.genre : 0,
      curateCount: Number.isInteger(data.curateCount) ? Math.max(0, data.curateCount) : 0,
      ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : ''
    };
    const style = ArtEngine.styleFor(record.genre);
    const card = document.createElement('article');
    card.className = 'art-card';

    const thumb = document.createElement('button');
    thumb.className = 'art-thumb';
    thumb.type = 'button';
    thumb.setAttribute('aria-label', `${record.author} 작품 상세 보기`);
    thumb.addEventListener('click', () => openModal(record, thumb));
    thumb.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openModal(record, thumb);
      }
    });

    const info = document.createElement('div');
    info.className = 'card-info';
    const top = document.createElement('div');
    top.className = 'card-topline';
    const author = document.createElement('div');
    author.className = 'author';
    author.textContent = record.author;
    const edition = document.createElement('div');
    edition.className = 'edition';
    edition.textContent = `ED. ${record.seed.toString(16).toUpperCase().slice(-6).padStart(6, '0')}`;
    top.append(author, edition);

    const subline = document.createElement('p');
    subline.className = 'subline';
    subline.textContent = `${style.ko}  /  SEED ${record.seed}`;

    const actions = document.createElement('div');
    actions.className = 'card-actions';
    const curate = document.createElement('button');
    curate.className = 'action-btn';
    curate.type = 'button';
    curate.textContent = `큐레이션 ${record.curateCount}`;
    curate.addEventListener('click', event => {
      event.stopPropagation();
      curateArtwork(record, curate);
    });
    const remove = document.createElement('button');
    remove.className = 'action-btn danger';
    remove.type = 'button';
    remove.textContent = '내 작품 삭제';
    remove.hidden = !(auth && auth.currentUser && record.ownerUid && auth.currentUser.uid === record.ownerUid);
    remove.addEventListener('click', event => {
      event.stopPropagation();
      deleteArtwork(record, card);
    });
    actions.append(curate, remove);
    info.append(top, subline, actions);
    card.append(thumb, info);

    const key = doc.id;
    observeThumbnail(thumb, record, key);
    return card;
  }

  async function loadPage(reset) {
    if (isLoading || !db || (!canLoadMore && !reset)) return;
    isLoading = true;
    $('moreBtn').disabled = true;
    if (reset) {
      clearSketches();
      lastDocument = null;
      canLoadMore = true;
      showMessage('아카이브를 불러오는 중입니다…', 'loading');
    }
    try {
      let query = db.collection('museum_arts');
      if (sortMode === 'popular') {
        query = query.orderBy('curateCount', 'desc').orderBy('createdAt', 'desc');
      } else {
        query = query.orderBy('createdAt', 'desc');
      }
      if (lastDocument) query = query.startAfter(lastDocument);
      const snapshot = await query.limit(PAGE_SIZE).get();
      if (reset) $('gallery').replaceChildren();
      if (snapshot.empty && reset) {
        showMessage('아직 게시된 작품이 없습니다. 스튜디오에서 첫 작품을 게시해 보세요.');
      } else {
        const fragment = document.createDocumentFragment();
        snapshot.forEach(doc => fragment.appendChild(makeCard(doc)));
        $('gallery').appendChild(fragment);
      }
      lastDocument = snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : lastDocument;
      canLoadMore = snapshot.size === PAGE_SIZE;
      $('moreBtn').hidden = !canLoadMore;
      $('countLabel').textContent = `COLLECTION / ${$('gallery').querySelectorAll('.art-card').length} LOADED`;
      $('sortLabel').textContent = sortMode === 'latest' ? 'SORT / RECENT' : 'SORT / CURATED';
    } catch (error) {
      console.error('Museum load failed:', error);
      if (reset) showMessage('아카이브를 불러오지 못했습니다. Firestore 보안 규칙, 색인 설정, 네트워크 연결을 확인해 주세요.', 'error');
      else alert('추가 작품을 불러오지 못했습니다. 색인 설정과 네트워크를 확인해 주세요.');
    } finally {
      isLoading = false;
      $('moreBtn').disabled = false;
    }
  }

  async function curateArtwork(record, button) {
    const user = auth && auth.currentUser;
    if (!user) {
      alert('큐레이션을 기록하려면 Firebase 익명 인증이 필요합니다. 페이지를 새로고침해 주세요.');
      return;
    }
    button.disabled = true;
    const artworkRef = db.collection('museum_arts').doc(record.id);
    const curationRef = artworkRef.collection('curations').doc(user.uid);
    try {
      await db.runTransaction(async transaction => {
        const artworkSnap = await transaction.get(artworkRef);
        const curationSnap = await transaction.get(curationRef);
        if (!artworkSnap.exists) throw new Error('ARTWORK_NOT_FOUND');
        if (curationSnap.exists) throw new Error('ALREADY_CURATED');
        const current = Number(artworkSnap.data().curateCount) || 0;
        transaction.set(curationRef, {
          uid: user.uid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        transaction.update(artworkRef, { curateCount: current + 1 });
        record.curateCount = current + 1;
      });
      button.textContent = `큐레이션 ${record.curateCount} ✓`;
      button.classList.add('selected');
    } catch (error) {
      console.warn('Curation not applied:', error);
      if (error.message === 'ALREADY_CURATED') {
        button.textContent = `이미 큐레이션함 · ${record.curateCount}`;
        button.classList.add('selected');
      } else {
        alert('큐레이션을 기록하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        button.disabled = false;
      }
    }
  }

  async function deleteArtwork(record, card) {
    if (!auth || !auth.currentUser || auth.currentUser.uid !== record.ownerUid) {
      alert('작품을 게시한 익명 계정에서만 삭제할 수 있습니다.');
      return;
    }
    if (!confirm('이 작품을 아카이브에서 삭제할까요? 삭제한 작품은 복구할 수 없습니다.')) return;
    try {
      await db.collection('museum_arts').doc(record.id).delete();
      const thumb = card.querySelector('.art-thumb');
      const key = record.id;
      if (observer && thumb) observer.unobserve(thumb);
      const instance = sketchRecords.get(key)?.instance;
      if (instance) instance.remove();
      sketchRecords.delete(key);
      card.remove();
      $('countLabel').textContent = `COLLECTION / ${$('gallery').querySelectorAll('.art-card').length} LOADED`;
    } catch (error) {
      console.error('Delete failed:', error);
      alert('삭제에 실패했습니다. Firebase 보안 규칙과 계정 상태를 확인해 주세요.');
    }
  }

  function openModal(record, trigger) {
    currentModalTrigger = trigger || null;
    $('modalTitle').textContent = record.author;
    $('modalMeta').textContent = `${ArtEngine.styleFor(record.genre).ko}  /  SEED ${record.seed}  /  ALGORITHMIC EDITION`;
    const note = ArtEngine.curatorialNote(record.genre, record.seed);
    $('modalNote').textContent = `${note.method} ${note.reading} ${note.disclaimer}`;
    const url = new URL('index.html', window.location.href);
    url.searchParams.set('author', record.author);
    url.searchParams.set('seed', String(record.seed));
    url.searchParams.set('style', String(record.genre));
    $('recreateLink').href = url.toString();

    if (modalSketch) {
      modalSketch.remove();
      modalSketch = null;
    }
    $('modalArt').replaceChildren();
    $('modal').classList.add('open');
    modalSketch = new p5(p => {
      p.setup = () => {
        const size = Math.max(260, Math.min(720, Math.floor($('modalArt').clientWidth || 600)));
        p.pixelDensity(1);
        p.createCanvas(size, size);
        ArtEngine.render(p, record.seed, record.genre, record.author);
        p.noLoop();
      };
    }, $('modalArt'));
    $('closeModal').focus();
  }

  function closeModal() {
    $('modal').classList.remove('open');
    if (modalSketch) {
      modalSketch.remove();
      modalSketch = null;
    }
    if (currentModalTrigger) currentModalTrigger.focus();
    currentModalTrigger = null;
  }

  async function init() {
    try {
      firebase.initializeApp(FIREBASE_CONFIG);
      auth = firebase.auth();
      db = firebase.firestore();
      try {
        if (!auth.currentUser) await auth.signInAnonymously();
      } catch (authError) {
        // Public reading still works without authentication; curation and owner deletion do not.
        console.warn('Anonymous auth unavailable; gallery will remain read-only:', authError);
      }
      await loadPage(true);
    } catch (error) {
      console.error('Firebase initialization failed:', error);
      showMessage('Firebase 연결에 실패했습니다. 프로젝트 설정과 네트워크 연결을 확인해 주세요.', 'error');
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const host = entry.target;
          observer.unobserve(host);
          createThumbnail(host, host._formArtwork, host.dataset.artKey);
        });
      }, { rootMargin: '180px 0px', threshold: 0.05 });
    }
    $('latestBtn').addEventListener('click', () => {
      if (sortMode === 'latest') return;
      sortMode = 'latest';
      $('latestBtn').classList.add('active');
      $('popularBtn').classList.remove('active');
      loadPage(true);
    });
    $('popularBtn').addEventListener('click', () => {
      if (sortMode === 'popular') return;
      sortMode = 'popular';
      $('popularBtn').classList.add('active');
      $('latestBtn').classList.remove('active');
      loadPage(true);
    });
    $('moreBtn').addEventListener('click', () => loadPage(false));
    $('closeModal').addEventListener('click', closeModal);
    $('modal').addEventListener('click', event => { if (event.target === $('modal')) closeModal(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && $('modal').classList.contains('open')) closeModal(); });
    init();
  });
})();
