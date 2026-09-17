import './styles.css';
import { api } from './api.js';
import { applyHighlights, formatDate, parseHighlights, NOTE_COLORS, debounce, genId } from './utils.js';

// ===== State =====
let notes = [];
let filteredNotes = [];
let searchQuery = '';
let viewMode = 'grid'; // 'grid' | 'list'
let filterMode = 'all'; // 'all' | 'pinned'
let editingNote = null;   // null = new note, note obj = editing
let isModalOpen = false;
let isLoading = true;
let masterPassword = null;

// ===== Bootstrap =====
document.getElementById('app').innerHTML = buildAppHTML();
bindStaticListeners();
requestMasterPassword();

// ===== HTML Templates =====
function buildAppHTML() {
  return `
    <header class="header">
      <div class="header-brand">
        <div class="brand-icon">📝</div>
        <span class="brand-name">NoteFlow</span>
      </div>
      <div class="header-actions">
        <div class="search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input class="search-input" id="searchInput" type="text" placeholder="Search notes…" autocomplete="off" />
        </div>
        <button class="btn btn-primary" id="newNoteBtn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
          New Note
        </button>
        <button class="btn btn-ghost" id="lockAppBtn" title="Lock notes">Lock</button>
      </div>
    </header>

    <main class="main">
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="filter-tabs">
            <button class="filter-tab active" data-filter="all">All</button>
            <button class="filter-tab" data-filter="pinned">📌 Pinned</button>
          </div>
          <span class="notes-count" id="notesCount">0 notes</span>
        </div>
        <div class="view-toggle">
          <button class="view-btn active" id="gridViewBtn" title="Grid view">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </button>
          <button class="view-btn" id="listViewBtn" title="List view">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div id="notesContainer"></div>
    </main>

    <div class="toast-container" id="toastContainer"></div>
    <div id="modalContainer"></div>
  `;
}

// ===== Static Listeners =====
function bindStaticListeners() {
  // New note
  document.getElementById('newNoteBtn').addEventListener('click', () => openModal(null));
  document.getElementById('lockAppBtn').addEventListener('click', lockApp);

  // Search
  const searchInput = document.getElementById('searchInput');
  const debouncedSearch = debounce((val) => {
    searchQuery = val.trim().toLowerCase();
    applyFilter();
    renderNotes();
  }, 250);
  searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));

  // View toggle
  document.getElementById('gridViewBtn').addEventListener('click', () => setView('grid'));
  document.getElementById('listViewBtn').addEventListener('click', () => setView('list'));

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      filterMode = tab.dataset.filter;
      applyFilter();
      renderNotes();
    });
  });

  // Close modal on overlay click
  document.getElementById('modalContainer').addEventListener('click', (e) => {
    if (e.target.closest('.unlock-overlay')) return;
    if (e.target.id === 'modalContainer' || e.target.classList.contains('modal-overlay')) {
      closeModal();
    }
  });
}

// ===== Data =====
async function loadNotes() {
  try {
    notes = await api.getNotes(masterPassword);
    applyFilter();
    renderNotes();
  } catch (err) {
    showToast(err.message || 'Cannot load encrypted notes.', 'error');
    notes = [];
    renderNotes();
    throw err;
  } finally {
    isLoading = false;
  }
}

function applyFilter() {
  let result = [...notes];

  // Filter mode
  if (filterMode === 'pinned') {
    result = result.filter(n => n.pinned);
  }

  // Search query
  if (searchQuery) {
    result = result.filter(n =>
      n.title.toLowerCase().includes(searchQuery) ||
      n.description.toLowerCase().includes(searchQuery) ||
      (n.pointers || []).some(p => p.toLowerCase().includes(searchQuery)) ||
      (n.highlights || []).some(h => h.toLowerCase().includes(searchQuery))
    );
  }

  filteredNotes = result;

  const count = filteredNotes.length;
  const el = document.getElementById('notesCount');
  if (el) el.textContent = `${count} ${count === 1 ? 'note' : 'notes'}`;
}

// ===== Render Notes =====
function renderNotes() {
  const container = document.getElementById('notesContainer');
  if (!container) return;

  if (isLoading) {
    container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><span>Loading notes…</span></div>`;
    return;
  }

  if (filteredNotes.length === 0) {
    container.innerHTML = renderEmptyState();
    return;
  }

  // Separate pinned and unpinned
  const pinned = filteredNotes.filter(n => n.pinned);
  const unpinned = filteredNotes.filter(n => !n.pinned);

  const gridClass = viewMode === 'grid' ? 'notes-grid' : 'notes-list';
  let html = '';

  if (pinned.length > 0 && filterMode !== 'pinned') {
    html += `
      <div class="section-header">
        <span class="section-label">📌 Pinned</span>
        <div class="section-header-line"></div>
      </div>
      <div class="${gridClass}" style="margin-bottom: 24px;">
        ${pinned.map(n => renderNoteCard(n)).join('')}
      </div>
    `;
    if (unpinned.length > 0) {
      html += `
        <div class="section-header">
          <span class="section-label">Other Notes</span>
          <div class="section-header-line"></div>
        </div>
      `;
    }
  }

  if (unpinned.length > 0 || (filterMode === 'pinned' && pinned.length > 0)) {
    const toRender = filterMode === 'pinned' ? pinned : unpinned;
    html += `<div class="${gridClass}">${toRender.map(n => renderNoteCard(n)).join('')}</div>`;
  }

  container.innerHTML = html;
  bindNoteCardListeners();
}

function renderEmptyState() {
  if (searchQuery) {
    return `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">No results found</div>
        <div class="empty-desc">No notes match "<strong>${escapeHtml(searchQuery)}</strong>"</div>
        <button class="btn btn-ghost" onclick="document.getElementById('searchInput').value=''; document.getElementById('searchInput').dispatchEvent(new Event('input'))">Clear search</button>
      </div>`;
  }
  if (filterMode === 'pinned') {
    return `
      <div class="empty-state">
        <div class="empty-icon">📌</div>
        <div class="empty-title">No pinned notes</div>
        <div class="empty-desc">Pin important notes to keep them at the top.</div>
      </div>`;
  }
  return `
    <div class="empty-state">
      <div class="empty-icon">📋</div>
      <div class="empty-title">Your notes live here</div>
      <div class="empty-desc">Create your first note with a title, description, bullet pointers, and text highlights.</div>
      <button class="btn btn-primary" id="emptyNewBtn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
        Create a note
      </button>
    </div>`;
}

function renderNoteCard(note) {
  const { id, title, description, pointers = [], highlights = [], color = '#ffffff', pinned = false, updatedAt } = note;

  const colorBar = color !== '#ffffff' ? `<div class="note-card-color-bar" style="background: ${getColorDark(color)}"></div>` : '';
  const titleHtml = applyHighlights(title, highlights);
  const descHtml = applyHighlights(description, highlights);
  const previewPointers = pointers.slice(0, 3);
  const extraPointers = pointers.length - 3;

  const listClass = viewMode === 'list' ? ' list-view' : '';

  return `
    <div class="note-card${listClass}" data-id="${id}" style="background: ${color};" role="button" tabindex="0">
      ${colorBar}
      ${pinned ? `<div class="note-card-badge"><span class="badge-pin" title="Pinned">📌</span></div>` : ''}
      <div class="note-title">${titleHtml}</div>
      ${description ? `<div class="note-description">${descHtml}</div>` : ''}
      ${previewPointers.length > 0 ? `
        <div class="note-pointers">
          ${previewPointers.map(p => `<div class="note-pointer-item">${applyHighlights(p, highlights)}</div>`).join('')}
          ${extraPointers > 0 ? `<div class="note-pointer-item" style="color: var(--text-muted); font-style: italic;">+${extraPointers} more…</div>` : ''}
        </div>` : ''}
      <div class="note-card-footer">
        <span class="note-date">${formatDate(updatedAt)}</span>
        <div class="note-card-actions">
          <button class="btn-icon pin-card-btn" data-id="${id}" title="${pinned ? 'Unpin' : 'Pin'}">
            ${pinned ? '📌' : '📍'}
          </button>
          <button class="btn-icon edit-card-btn" data-id="${id}" title="Edit note">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon delete-card-btn" data-id="${id}" title="Delete note" style="color: var(--danger)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>
    </div>`;
}

function bindNoteCardListeners() {
  // Card click → edit (but not on action buttons)
  document.querySelectorAll('.note-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-icon')) return;
      const id = card.dataset.id;
      const note = notes.find(n => n.id === id);
      if (note) openModal(note);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.target.classList.contains('btn-icon')) {
        const id = card.dataset.id;
        const note = notes.find(n => n.id === id);
        if (note) openModal(note);
      }
    });
  });

  // Pin toggle
  document.querySelectorAll('.pin-card-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const note = notes.find(n => n.id === id);
      if (!note) return;
      try {
        const updated = await saveEncryptedNote({ ...note, pinned: !note.pinned });
        notes = notes.map(n => n.id === id ? updated : n);
        applyFilter();
        renderNotes();
        showToast(updated.pinned ? 'Note pinned' : 'Note unpinned', 'success');
      } catch {
        showToast('Failed to update note', 'error');
      }
    });
  });

  // Edit
  document.querySelectorAll('.edit-card-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const note = notes.find(n => n.id === id);
      if (note) openModal(note);
    });
  });

  // Delete
  document.querySelectorAll('.delete-card-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!confirm('Delete this note?')) return;
      try {
        await api.deleteNote(id);
        notes = notes.filter(n => n.id !== id);
        applyFilter();
        renderNotes();
        showToast('Note deleted', 'success');
      } catch {
        showToast('Failed to delete note', 'error');
      }
    });
  });

  // Empty state CTA
  const emptyBtn = document.getElementById('emptyNewBtn');
  if (emptyBtn) emptyBtn.addEventListener('click', () => openModal(null));
}

// ===== View Toggle =====
function setView(mode) {
  viewMode = mode;
  document.getElementById('gridViewBtn').classList.toggle('active', mode === 'grid');
  document.getElementById('listViewBtn').classList.toggle('active', mode === 'list');
  renderNotes();
}

// ===== Modal =====
function openModal(note) {
  editingNote = note;
  isModalOpen = true;
  const container = document.getElementById('modalContainer');
  container.innerHTML = buildModalHTML(note);
  bindModalListeners();
  container.querySelector('#noteTitle').focus();
}

function closeModal() {
  isModalOpen = false;
  editingNote = null;
  document.getElementById('modalContainer').innerHTML = '';
}

function buildModalHTML(note) {
  const isEditing = !!note;
  const title = note?.title || '';
  const description = note?.description || '';
  const pointers = note?.pointers || [''];
  const highlights = note?.highlights || [];
  const color = note?.color || '#ffffff';
  const pinned = note?.pinned || false;

  const highlightsStr = highlights.join(', ');

  const colorSwatches = NOTE_COLORS.map(c => `
    <button class="color-swatch" data-color="${c.value}" title="${c.label}"
      style="background: ${c.value}; border-color: ${c.value === '#ffffff' ? '#e2ddd8' : c.value};"
      ${c.value === color ? 'data-selected="true"' : ''}></button>
  `).join('');

  const pointerRows = pointers.map((p, i) => `
    <div class="pointer-row" data-index="${i}">
      <input class="pointer-input" type="text" value="${escapeAttr(p)}" placeholder="Add a bullet point…" data-pointer-index="${i}" />
      <button class="pointer-remove btn-icon" data-remove-index="${i}" title="Remove">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `).join('');

  return `
    <div class="modal-overlay">
      <div class="note-modal" role="dialog" aria-modal="true" aria-label="${isEditing ? 'Edit note' : 'New note'}">
        <div class="modal-header">
          <span class="modal-title-display">${isEditing ? 'Edit note' : 'New note'}</span>
          <button class="modal-close btn-icon" id="modalClose" title="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="modal-body">
          <!-- Title -->
          <div class="field-group">
            <label class="field-label" for="noteTitle">Title</label>
            <input class="field-input title-input" id="noteTitle" type="text"
              placeholder="Note title…" value="${escapeAttr(title)}" maxlength="120" />
          </div>

          <!-- Description -->
          <div class="field-group">
            <label class="field-label" for="noteDescription">Description</label>
            <textarea class="field-input desc-input" id="noteDescription"
              placeholder="Write your note here…" rows="4">${escapeHtml(description)}</textarea>
          </div>

          <!-- Pointers -->
          <div class="field-group">
            <label class="field-label">Bullet Pointers</label>
            <div class="pointers-list" id="pointersList">${pointerRows}</div>
            <button class="add-pointer-btn" id="addPointerBtn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Add pointer
            </button>
          </div>

          <!-- Highlights -->
          <div class="field-group">
            <label class="field-label" for="noteHighlights">Highlight Words</label>
            <input class="field-input" id="noteHighlights" type="text"
              placeholder="e.g. important, deadline, review" value="${escapeAttr(highlightsStr)}" />
            <div class="highlights-help">Comma-separated words to highlight in yellow throughout the note.</div>
          </div>

          <!-- Note Color -->
          <div class="field-group">
            <label class="field-label">Note Color</label>
            <div class="color-picker-row" id="colorPicker">${colorSwatches}</div>
          </div>

          <!-- Live Preview -->
          <div class="preview-section" id="previewSection">
            <div class="preview-label">Preview</div>
            <div id="previewContent"></div>
          </div>
        </div>

        <div class="modal-footer">
          <div class="modal-footer-left">
            <button class="pin-toggle ${pinned ? 'pinned' : ''}" id="pinToggle" title="${pinned ? 'Unpin' : 'Pin note'}">
              ${pinned ? '📌 Pinned' : '📍 Pin'}
            </button>
            ${isEditing ? `<button class="btn btn-danger" id="deleteNoteBtn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              Delete
            </button>` : ''}
          </div>
          <div class="modal-footer-right">
            <button class="btn btn-ghost" id="cancelBtn">Cancel</button>
            <button class="btn btn-primary" id="saveNoteBtn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              ${isEditing ? 'Save changes' : 'Create note'}
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

function bindModalListeners() {
  let selectedColor = editingNote?.color || '#ffffff';
  let isPinned = editingNote?.pinned || false;

  // Update preview whenever fields change
  const updatePreview = debounce(() => {
    const title = document.getElementById('noteTitle')?.value || '';
    const desc = document.getElementById('noteDescription')?.value || '';
    const pointerInputs = document.querySelectorAll('.pointer-input');
    const pointers = [...pointerInputs].map(i => i.value.trim()).filter(Boolean);
    const highlights = parseHighlights(document.getElementById('noteHighlights')?.value || '');

    const previewEl = document.getElementById('previewContent');
    if (!previewEl) return;

    previewEl.innerHTML = `
      <div class="preview-title">${applyHighlights(title || 'Untitled', highlights)}</div>
      ${desc ? `<div class="preview-description">${applyHighlights(desc, highlights)}</div>` : ''}
      ${pointers.length > 0 ? `
        <div class="preview-pointers">
          ${pointers.map(p => `<div class="preview-pointer">${applyHighlights(p, highlights)}</div>`).join('')}
        </div>` : ''}
    `;
  }, 150);

  // Field listeners for preview
  document.getElementById('noteTitle')?.addEventListener('input', updatePreview);
  document.getElementById('noteDescription')?.addEventListener('input', updatePreview);
  document.getElementById('noteHighlights')?.addEventListener('input', updatePreview);
  document.getElementById('pointersList')?.addEventListener('input', updatePreview);

  // Close buttons
  document.getElementById('modalClose')?.addEventListener('click', closeModal);
  document.getElementById('cancelBtn')?.addEventListener('click', closeModal);

  // Pin toggle
  document.getElementById('pinToggle')?.addEventListener('click', () => {
    isPinned = !isPinned;
    const btn = document.getElementById('pinToggle');
    btn.classList.toggle('pinned', isPinned);
    btn.textContent = isPinned ? '📌 Pinned' : '📍 Pin';
  });

  // Color swatches
  document.querySelectorAll('.color-swatch').forEach(swatch => {
    if (swatch.dataset.selected === 'true') swatch.classList.add('selected');
    swatch.addEventListener('click', () => {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      selectedColor = swatch.dataset.color;
    });
  });

  // Add pointer
  document.getElementById('addPointerBtn')?.addEventListener('click', () => {
    const list = document.getElementById('pointersList');
    const idx = list.querySelectorAll('.pointer-row').length;
    const row = document.createElement('div');
    row.className = 'pointer-row';
    row.dataset.index = idx;
    row.innerHTML = `
      <input class="pointer-input" type="text" placeholder="Add a bullet point…" data-pointer-index="${idx}" />
      <button class="pointer-remove btn-icon" data-remove-index="${idx}" title="Remove">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    list.appendChild(row);
    row.querySelector('input').focus();
    bindPointerRemove(row.querySelector('.pointer-remove'));
    row.querySelector('input').addEventListener('input', updatePreview);
  });

  // Remove pointer buttons (existing)
  document.querySelectorAll('.pointer-remove').forEach(btn => bindPointerRemove(btn));

  // Delete note
  document.getElementById('deleteNoteBtn')?.addEventListener('click', async () => {
    if (!editingNote) return;
    if (!confirm('Delete this note? This cannot be undone.')) return;
    try {
      await api.deleteNote(editingNote.id);
      notes = notes.filter(n => n.id !== editingNote.id);
      applyFilter();
      renderNotes();
      closeModal();
      showToast('Note deleted', 'success');
    } catch {
      showToast('Failed to delete note', 'error');
    }
  });

  // Save
  document.getElementById('saveNoteBtn')?.addEventListener('click', async () => {
    const title = document.getElementById('noteTitle')?.value.trim();
    if (!title) {
      document.getElementById('noteTitle').style.borderColor = 'var(--danger)';
      document.getElementById('noteTitle').focus();
      showToast('Please enter a title', 'error');
      return;
    }

    const description = document.getElementById('noteDescription')?.value.trim() || '';
    const pointerInputs = document.querySelectorAll('.pointer-input');
    const pointers = [...pointerInputs].map(i => i.value.trim()).filter(Boolean);
    const highlights = parseHighlights(document.getElementById('noteHighlights')?.value || '');

    const payload = {
      title,
      description,
      pointers,
      highlights,
      color: selectedColor,
      pinned: isPinned,
    };

    const saveBtn = document.getElementById('saveNoteBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      if (editingNote) {
        const updated = await saveEncryptedNote({ ...editingNote, ...payload });
        notes = notes.map(n => n.id === editingNote.id ? updated : n);
        showToast('Note saved', 'success');
      } else {
        const created = await saveEncryptedNote({ id: genId(), ...payload });
        notes.unshift(created);
        showToast('Note created', 'success');
      }
      applyFilter();
      renderNotes();
      closeModal();
    } catch {
      showToast('Failed to save note', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = editingNote ? 'Save changes' : 'Create note';
    }
  });

  // Keyboard: Escape to close
  document.addEventListener('keydown', handleEscClose);

  // Initial preview render
  updatePreview();
}

function bindPointerRemove(btn) {
  btn.addEventListener('click', (e) => {
    const row = e.target.closest('.pointer-row');
    const list = document.getElementById('pointersList');
    if (list.querySelectorAll('.pointer-row').length > 1) {
      row.remove();
    } else {
      row.querySelector('input').value = '';
    }
  });
}

function handleEscClose(e) {
  if (e.key === 'Escape' && isModalOpen) {
    closeModal();
    document.removeEventListener('keydown', handleEscClose);
  }
}

function saveEncryptedNote(note) {
  const now = new Date().toISOString();
  const preparedNote = {
    ...note,
    createdAt: note.createdAt || now,
    updatedAt: now,
  };
  return api.saveNote(preparedNote, masterPassword).then(() => preparedNote);
}

function requestMasterPassword() {
  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay unlock-overlay">
      <div class="unlock-modal" role="dialog" aria-modal="true" aria-labelledby="unlockTitle">
        <div class="unlock-icon">🔒</div>
        <h1 class="unlock-title" id="unlockTitle">Unlock NoteFlow</h1>
        <p class="unlock-description">Your notes are encrypted before they leave this device.</p>
        <form id="unlockForm" class="unlock-form">
          <label class="field-label" for="masterPassword">Master password</label>
          <input class="field-input" id="masterPassword" type="password" autocomplete="current-password" required autofocus />
          <div class="unlock-error" id="unlockError" role="alert"></div>
          <button class="btn btn-primary unlock-submit" type="submit">Unlock notes</button>
        </form>
      </div>
    </div>`;

  document.getElementById('unlockForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = document.getElementById('masterPassword');
    const submit = event.currentTarget.querySelector('button');
    const error = document.getElementById('unlockError');
    const password = input.value;
    if (!password) return;

    submit.disabled = true;
    submit.textContent = 'Unlocking…';
    error.textContent = '';
    masterPassword = password;
    isLoading = true;
    renderNotes();

    try {
      await loadNotes();
      container.innerHTML = '';
    } catch (err) {
      error.textContent = err.message || 'Unable to unlock notes.';
      masterPassword = null;
      submit.disabled = false;
      submit.textContent = 'Unlock notes';
      input.select();
    }
  });
}

function lockApp() {
  masterPassword = null;
  notes = [];
  filteredNotes = [];
  isLoading = true;
  renderNotes();
  requestMasterPassword();
}

// ===== Toast =====
function showToast(message, type = 'default') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', default: 'ℹ' };
  toast.innerHTML = `<span>${icons[type] || icons.default}</span> ${escapeHtml(message)}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// ===== Helpers =====
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getColorDark(hex) {
  // Darken hex slightly for the color bar accent
  const map = {
    '#fef9c3': '#ca8a04',
    '#dcfce7': '#16a34a',
    '#dbeafe': '#2563eb',
    '#fce7f3': '#db2777',
    '#ede9fe': '#7c3aed',
    '#ffedd5': '#ea580c',
    '#f1f5f9': '#64748b',
    '#ffffff': '#e2ddd8',
  };
  return map[hex] || hex;
}
