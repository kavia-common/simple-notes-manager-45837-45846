import './style.css';

/**
 * Ocean Professional Simple Notes App
 * - Single page app with sidebar + editor
 * - LocalStorage persistence
 * - No external router; URL hash used for lightweight routing-friendly state
 * - Toast notifications and inline alerts
 * - Smooth transitions and responsive layout
 */

// PUBLIC_INTERFACE
export function initNotesApp(rootEl) {
  /** Initialize app into the provided root element. */
  const app = new NotesApp(rootEl);
  app.init();
  return app;
}

/**
 * Model types:
 * Note = { id: string, title: string, content: string, updatedAt: number, createdAt: number }
 */

/** Utility: generate ID */
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Utility: debounce */
function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/** Storage keys and API wrapper */
const STORAGE_KEY = 'simple_notes__v1';

// PUBLIC_INTERFACE
export const StorageAPI = {
  /** Get all notes from localStorage */
  getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr;
    } catch {
      return [];
    }
  },
  /** Save all notes to localStorage */
  saveAll(notes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  },
};

/** Toast manager */
class Toasts {
  constructor(container) {
    this.container = container;
  }
  show(message, type = 'info', timeout = 2200) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    this.container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, timeout);
  }
}

/** Sidebar component */
class Sidebar {
  constructor({ onSelect, onNew, onDelete, onSearch }) {
    this.onSelect = onSelect;
    this.onNew = onNew;
    this.onDelete = onDelete;
    this.onSearch = onSearch;

    this.el = document.createElement('aside');
    this.el.className = 'sidebar';

    this.searchInput = document.createElement('input');
    this.searchInput.className = 'search';
    this.searchInput.type = 'search';
    this.searchInput.placeholder = 'Search notes...';
    this.searchInput.setAttribute('aria-label', 'Search notes');
    this.searchInput.addEventListener(
      'input',
      debounce((e) => this.onSearch?.(e.target.value || ''), 150)
    );

    this.newBtn = document.createElement('button');
    this.newBtn.type = 'button';
    this.newBtn.className = 'btn btn-primary w-full';
    this.newBtn.textContent = 'New Note';
    this.newBtn.addEventListener('click', () => this.onNew?.());

    this.list = document.createElement('ul');
    this.list.className = 'note-list';

    const header = document.createElement('div');
    header.className = 'sidebar-header';
    header.innerHTML = `
      <div class="brand">
        <span class="brand-dot"></span>
        <span class="brand-text">Simple Notes</span>
      </div>
    `;

    const controls = document.createElement('div');
    controls.className = 'sidebar-controls';
    controls.appendChild(this.searchInput);
    controls.appendChild(this.newBtn);

    this.el.appendChild(header);
    this.el.appendChild(controls);
    this.el.appendChild(this.list);
  }

  renderList(notes, activeId) {
    this.list.innerHTML = '';
    if (!notes.length) {
      const empty = document.createElement('div');
      empty.className = 'empty empty-sidebar';
      empty.innerHTML = `
        <p>No notes found.</p>
        <button class="btn btn-secondary">Create your first note</button>
      `;
      empty.querySelector('button')?.addEventListener('click', () => this.onNew?.());
      this.list.appendChild(empty);
      return;
    }
    notes
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .forEach((n) => {
        const li = document.createElement('li');
        li.className = 'note-list-item' + (n.id === activeId ? ' active' : '');
        li.tabIndex = 0;

        const title = n.title || 'Untitled';
        const preview = (n.content || '').replace(/\n/g, ' ').slice(0, 80);
        const time = new Date(n.updatedAt).toLocaleString();

        li.innerHTML = `
          <div class="note-meta">
            <div class="note-title">${escapeHTML(title)}</div>
            <div class="note-preview">${escapeHTML(preview)}</div>
          </div>
          <div class="note-actions">
            <time class="note-time" datetime="${new Date(n.updatedAt).toISOString()}">${time}</time>
            <button class="icon-btn danger" title="Delete note" aria-label="Delete note">&times;</button>
          </div>
        `;
        li.addEventListener('click', (e) => {
          // prevent row click when delete click
          if (e.target && e.target.closest('.icon-btn')) return;
          this.onSelect?.(n.id);
        });
        li.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') this.onSelect?.(n.id);
        });
        li.querySelector('.icon-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.onDelete?.(n.id);
        });

        this.list.appendChild(li);
      });
  }

  mount(parent) {
    parent.appendChild(this.el);
  }
}

/** Editor component */
class NoteEditor {
  constructor({ onSave, onDelete, onNew }) {
    this.onSave = onSave;
    this.onDelete = onDelete;
    this.onNew = onNew;

    this.el = document.createElement('section');
    this.el.className = 'editor';

    this.toolbar = document.createElement('div');
    this.toolbar.className = 'toolbar';
    this.newBtn = makeBtn('New', 'secondary', () => this.onNew?.());
    this.saveBtn = makeBtn('Save', 'primary', () => this.save());
    this.deleteBtn = makeBtn('Delete', 'danger', () => this.confirmDelete());

    this.toolbar.append(this.newBtn, this.saveBtn, this.deleteBtn);

    this.titleInput = document.createElement('input');
    this.titleInput.type = 'text';
    this.titleInput.className = 'title-input';
    this.titleInput.placeholder = 'Note title';

    this.contentInput = document.createElement('textarea');
    this.contentInput.className = 'content-input';
    this.contentInput.placeholder = 'Write your note here...';

    this.inlineAlert = document.createElement('div');
    this.inlineAlert.className = 'inline-alert';
    this.inlineAlert.style.display = 'none';

    const container = document.createElement('div');
    container.className = 'editor-container';
    container.append(this.titleInput, this.contentInput);

    this.el.append(this.toolbar, this.inlineAlert, container);

    this.currentNoteId = null;
  }

  setNote(note) {
    this.currentNoteId = note?.id || null;
    this.titleInput.value = note?.title || '';
    this.contentInput.value = note?.content || '';

    // Reset alert visibility on load
    this.showInlineAlert('');
  }

  getDraft() {
    return {
      id: this.currentNoteId || uid(),
      title: this.titleInput.value.trim(),
      content: this.contentInput.value,
    };
  }

  save() {
    const draft = this.getDraft();
    if (!draft.title && !draft.content.trim()) {
      this.showInlineAlert('Cannot save an empty note. Add a title or content.', 'error');
      return;
    }
    this.onSave?.(draft);
  }

  confirmDelete() {
    if (!this.currentNoteId) {
      this.showInlineAlert('No note selected to delete.', 'error');
      return;
    }
    const confirmed = window.confirm('Delete this note? This action cannot be undone.');
    if (confirmed) {
      this.onDelete?.(this.currentNoteId);
    }
  }

  showInlineAlert(message, type = 'info') {
    if (!message) {
      this.inlineAlert.style.display = 'none';
      this.inlineAlert.textContent = '';
      this.inlineAlert.className = 'inline-alert';
      return;
    }
    this.inlineAlert.style.display = 'block';
    this.inlineAlert.textContent = message;
    this.inlineAlert.className = `inline-alert alert-${type}`;
  }

  mount(parent) {
    parent.appendChild(this.el);
  }
}

/** Root app */
class NotesApp {
  constructor(root) {
    this.root = root;
    this.state = {
      notes: [],
      filter: '',
      activeId: null,
    };

    this.toasts = new Toasts(document.getElementById('toast-container'));
  }

  init() {
    // Load notes
    this.state.notes = StorageAPI.getAll();
    // Try to set active from hash
    const hashId = getHashId();
    if (hashId && this.state.notes.find((n) => n.id === hashId)) {
      this.state.activeId = hashId;
    } else if (this.state.notes[0]) {
      this.state.activeId = this.state.notes[0].id;
      setHashId(this.state.activeId);
    }

    // Build layout
    this.container = document.createElement('div');
    this.container.className = 'app-container card-surface';

    this.sidebar = new Sidebar({
      onSelect: (id) => this.selectNote(id),
      onNew: () => this.createNote(),
      onDelete: (id) => this.deleteNote(id),
      onSearch: (q) => this.updateFilter(q),
    });

    this.editor = new NoteEditor({
      onSave: (draft) => this.saveNote(draft),
      onDelete: (id) => this.deleteNote(id),
      onNew: () => this.createNote(),
    });

    this.sidebar.mount(this.container);
    this.editor.mount(this.container);

    this.root.innerHTML = '';
    this.root.appendChild(this.container);

    // Initial render
    this.render();

    // Listen hashchanges for routing-friendly behavior
    window.addEventListener('hashchange', () => {
      const id = getHashId();
      if (id && id !== this.state.activeId) {
        this.selectNote(id, true);
      }
    });

    // Initial empty editor state
    const active = this.state.notes.find((n) => n.id === this.state.activeId) || null;
    this.editor.setNote(active);
  }

  updateFilter(q) {
    this.state.filter = (q || '').toLowerCase().trim();
    this.renderSidebar();
  }

  filteredNotes() {
    const f = this.state.filter;
    if (!f) return this.state.notes;
    return this.state.notes.filter(
      (n) =>
        (n.title || '').toLowerCase().includes(f) ||
        (n.content || '').toLowerCase().includes(f)
    );
  }

  selectNote(id, skipHashUpdate = false) {
    const note = this.state.notes.find((n) => n.id === id);
    if (!note) return;
    this.state.activeId = id;
    if (!skipHashUpdate) setHashId(id);
    this.editor.setNote(note);
    this.renderSidebar();
  }

  createNote() {
    const id = uid();
    const now = Date.now();
    const newNote = {
      id,
      title: '',
      content: '',
      createdAt: now,
      updatedAt: now,
    };
    this.state.notes.unshift(newNote);
    this.state.activeId = id;
    StorageAPI.saveAll(this.state.notes);
    setHashId(id);
    this.editor.setNote(newNote);
    this.renderSidebar();
    this.toasts.show('New note created', 'success');
  }

  saveNote(draft) {
    const now = Date.now();
    const idx = this.state.notes.findIndex((n) => n.id === draft.id);
    if (idx >= 0) {
      this.state.notes[idx] = {
        ...this.state.notes[idx],
        title: draft.title,
        content: draft.content,
        updatedAt: now,
      };
    } else {
      this.state.notes.unshift({
        id: draft.id,
        title: draft.title,
        content: draft.content,
        createdAt: now,
        updatedAt: now,
      });
      this.state.activeId = draft.id;
      setHashId(draft.id);
    }
    StorageAPI.saveAll(this.state.notes);
    this.renderSidebar();
    this.toasts.show('Note saved', 'success');
  }

  deleteNote(id) {
    const idx = this.state.notes.findIndex((n) => n.id === id);
    if (idx < 0) return;
    this.state.notes.splice(idx, 1);
    StorageAPI.saveAll(this.state.notes);

    // Update active selection
    if (this.state.activeId === id) {
      const next = this.state.notes[0] || null;
      this.state.activeId = next?.id || null;
      setHashId(next?.id || '');
      this.editor.setNote(next);
    }
    this.renderSidebar();
    this.toasts.show('Note deleted', 'info');
  }

  renderSidebar() {
    this.sidebar.renderList(this.filteredNotes(), this.state.activeId);
  }

  render() {
    this.renderSidebar();
    // Editor is set when selecting/creating notes
    if (!this.state.notes.length) {
      this.editor.showInlineAlert('No notes yet. Create a new note to get started.', 'info');
    }
  }
}

/** Helpers */
function makeBtn(label, variant, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn btn-${variant}`;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function escapeHTML(str) {
  return (str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getHashId() {
  const h = location.hash.replace('#', '').trim();
  return h || '';
}
function setHashId(id) {
  if (!id) {
    history.replaceState(null, '', location.pathname + location.search);
  } else {
    if (location.hash !== `#${id}`) {
      location.hash = `#${id}`;
    }
  }
}

// Boot app
const root = document.getElementById('app');
initNotesApp(root);
