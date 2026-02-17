/**
 * Pull Down Card - iOS-style pull-down drawer for Home Assistant
 * Swipe down from the handle to reveal additional cards
 */

const VERSION = '1.1.3';

class PullDownCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = null;
    this._hass = null;
    this._mainCard = null;
    this._drawerCards = [];
    this._initialized = false;
    this._building = false;
    this._isOpen = false;
    this._startY = 0;
    this._currentY = 0;
    this._dragging = false;
    this._drawerHeight = 0;
    this._hasMoved = false;
  }

  setConfig(config) {
    if (!config.main_card) {
      throw new Error('Please define main_card');
    }
    if (!config.drawer_cards || !Array.isArray(config.drawer_cards)) {
      throw new Error('Please define drawer_cards as an array');
    }

    this._config = {
      main_card: config.main_card,
      drawer_cards: config.drawer_cards,
      handle_color: config.handle_color ?? 'rgba(255, 255, 255, 0.4)',
      handle_height: config.handle_height ?? 24,
      drawer_background: config.drawer_background ?? 'rgba(0, 0, 0, 0.5)',
      drawer_blur: config.drawer_blur ?? 20,
      animation_duration: config.animation_duration ?? 300,
      swipe_threshold: config.swipe_threshold ?? 50,
      auto_close_on_tap: config.auto_close_on_tap ?? true,
    };

    if (this._hass && !this._initialized) {
      this._buildCards();
    }
  }

  set hass(hass) {
    this._hass = hass;

    // Propagate hass to main card
    if (this._mainCard && 'hass' in this._mainCard) {
      this._mainCard.hass = hass;
    }
    // Propagate hass to drawer cards
    this._drawerCards.forEach(card => {
      if (card && 'hass' in card) {
        card.hass = hass;
      }
    });

    if (!this._initialized && this._config) {
      this._buildCards();
    }
  }

  get hass() {
    return this._hass;
  }

  async _buildCards() {
    if (!this._config || !this._hass) return;
    if (this._initialized || this._building) return;
    this._building = true;

    const helpers = await this._loadCardHelpers();

    // Build main card
    try {
      this._mainCard = await helpers.createCardElement(this._config.main_card);
      this._mainCard.hass = this._hass;
    } catch (e) {
      console.error('[pull-down-card] Error creating main card:', e);
      this._mainCard = this._createErrorCard(e.message);
    }

    // Build drawer cards
    this._drawerCards = [];
    for (const cardConfig of this._config.drawer_cards) {
      try {
        const card = await helpers.createCardElement(cardConfig);
        card.hass = this._hass;
        this._drawerCards.push(card);
      } catch (e) {
        console.error('[pull-down-card] Error creating drawer card:', e);
        this._drawerCards.push(this._createErrorCard(e.message));
      }
    }

    this._render();
    this._initialized = true;
    this._setupGestures();
  }

  _createErrorCard(message) {
    const card = document.createElement('ha-card');
    card.innerHTML = `<div style="padding: 16px; color: var(--error-color);">Error: ${message}</div>`;
    return card;
  }

  async _loadCardHelpers() {
    if (window.loadCardHelpers) {
      return window.loadCardHelpers();
    }
    return {
      createCardElement: async (config) => {
        const tag = config.type.startsWith('custom:')
          ? config.type.substr(7)
          : `hui-${config.type}-card`;
        const element = document.createElement(tag);
        if (element.setConfig) element.setConfig(config);
        return element;
      }
    };
  }

  _render() {
    const handleHeight = this._config.handle_height;
    const duration = this._config.animation_duration;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
          overflow: visible;
        }

        .container {
          position: relative;
          width: 100%;
          height: 100%;
          isolation: isolate;
        }

        .main-content {
          position: relative;
          width: 100%;
          height: 100%;
          z-index: 1;
        }

        .handle-zone {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: ${handleHeight}px;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: grab;
          touch-action: none;
        }

        .handle-zone:active {
          cursor: grabbing;
        }

        .handle {
          width: 40px;
          height: 5px;
          background: ${this._config.handle_color};
          border-radius: 3px;
          transition: transform 0.2s ease, opacity 0.2s ease;
        }

        .handle-zone:hover .handle {
          transform: scaleX(1.2);
          opacity: 1;
        }

        .drawer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          opacity: 0;
          visibility: hidden;
          transition: opacity ${duration}ms ease, visibility ${duration}ms ease;
          z-index: 100;
        }

        .drawer-overlay.visible {
          opacity: 1;
          visibility: visible;
        }

        .drawer-overlay.dragging {
          transition: none;
        }

        .drawer {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: ${this._config.drawer_background};
          backdrop-filter: blur(${this._config.drawer_blur}px);
          -webkit-backdrop-filter: blur(${this._config.drawer_blur}px);
          border-radius: 0 0 24px 24px;
          transform: translateY(-100%);
          transition: transform ${duration}ms cubic-bezier(0.4, 0.0, 0.2, 1);
          z-index: 101;
          max-height: 85vh;
          overflow-y: auto;
          padding: 16px;
          padding-top: 24px;
          padding-bottom: 12px;
          box-sizing: border-box;
        }

        .drawer.open {
          transform: translateY(0);
        }

        .drawer.dragging {
          transition: none;
        }

        .drawer-handle {
          width: 40px;
          height: 5px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 3px;
          margin: 16px auto 0 auto;
        }

        .drawer-cards {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .drawer-cards > * {
          width: 100%;
        }
      </style>

      <div class="container">
        <div class="handle-zone" id="handle-zone">
          <div class="handle"></div>
        </div>
        <div class="main-content" id="main-content"></div>
      </div>

      <div class="drawer-overlay" id="overlay"></div>
      <div class="drawer" id="drawer">
        <div class="drawer-cards" id="drawer-cards"></div>
        <div class="drawer-handle"></div>
      </div>
    `;

    // Insert main card
    const mainContent = this.shadowRoot.getElementById('main-content');
    if (this._mainCard) {
      mainContent.appendChild(this._mainCard);
    }

    // Insert drawer cards
    const drawerCards = this.shadowRoot.getElementById('drawer-cards');
    this._drawerCards.forEach(card => {
      drawerCards.appendChild(card);
    });
  }

  _setupGestures() {
    const handleZone = this.shadowRoot.getElementById('handle-zone');
    const drawer = this.shadowRoot.getElementById('drawer');
    const overlay = this.shadowRoot.getElementById('overlay');

    // Handle zone gestures (to open)
    handleZone.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: true });
    handleZone.addEventListener('touchmove', this._onTouchMove.bind(this), { passive: false });
    handleZone.addEventListener('touchend', this._onTouchEnd.bind(this), { passive: true });

    // Mouse support for handle zone
    handleZone.addEventListener('mousedown', this._onMouseDown.bind(this));

    // Drawer gestures (to close)
    drawer.addEventListener('touchstart', this._onDrawerTouchStart.bind(this), { passive: true });
    drawer.addEventListener('touchmove', this._onDrawerTouchMove.bind(this), { passive: false });
    drawer.addEventListener('touchend', this._onDrawerTouchEnd.bind(this), { passive: true });

    // Close on overlay tap
    overlay.addEventListener('click', () => this._closeDrawer());

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._isOpen) {
        this._closeDrawer();
      }
    });

    // Auto-close when anything in drawer cards is tapped
    const drawerCardsEl = this.shadowRoot.getElementById('drawer-cards');
    let touchStartTime = 0;

    document.addEventListener('pointerdown', (e) => {
      if (!this._isOpen) return;
      const path = e.composedPath();
      if (path.includes(drawerCardsEl)) {
        touchStartTime = Date.now();
      }
    }, true);

    document.addEventListener('pointerup', (e) => {
      if (!this._isOpen) return;
      if (!this._config.auto_close_on_tap) return;
      const path = e.composedPath();
      if (path.includes(drawerCardsEl)) {
        // Only close on quick taps (< 300ms), not drags
        if (Date.now() - touchStartTime < 300) {
          setTimeout(() => this._closeDrawer(), 200);
        }
      }
    }, true);
  }

  // Opening gestures (from handle zone)
  _onTouchStart(e) {
    if (this._isOpen) return;
    this._startY = e.touches[0].clientY;
    this._dragging = true;
    this._updateDrawerHeight();
  }

  _onTouchMove(e) {
    if (!this._dragging || this._isOpen) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - this._startY;

    if (deltaY > 0) {
      e.preventDefault();
      this._updateDrawerPosition(deltaY, false);
    }
  }

  _onTouchEnd(e) {
    if (!this._dragging) return;
    this._dragging = false;

    const deltaY = this._currentY - this._startY;

    if (deltaY > this._config.swipe_threshold) {
      this._openDrawer();
    } else {
      this._closeDrawer();
    }

    this._resetDragging();
  }

  // Mouse support
  _onMouseDown(e) {
    if (this._isOpen) return;
    this._startY = e.clientY;
    this._dragging = true;
    this._updateDrawerHeight();

    const onMouseMove = (e) => {
      if (!this._dragging) return;
      const deltaY = e.clientY - this._startY;
      if (deltaY > 0) {
        this._updateDrawerPosition(deltaY, false);
      }
    };

    const onMouseUp = (e) => {
      if (!this._dragging) return;
      this._dragging = false;

      const deltaY = e.clientY - this._startY;
      if (deltaY > this._config.swipe_threshold) {
        this._openDrawer();
      } else {
        this._closeDrawer();
      }

      this._resetDragging();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  // Closing gestures (from drawer)
  _onDrawerTouchStart(e) {
    if (!this._isOpen) return;
    this._startY = e.touches[0].clientY;
    this._dragging = true;
    this._hasMoved = false;
  }

  _onDrawerTouchMove(e) {
    if (!this._dragging || !this._isOpen) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - this._startY;

    // Only allow upward swipe to close
    if (deltaY < 0) {
      this._hasMoved = true;
      e.preventDefault();
      this._updateDrawerPosition(this._drawerHeight + deltaY, true);
    }
  }

  _onDrawerTouchEnd(e) {
    if (!this._dragging || !this._isOpen) return;
    this._dragging = false;

    const deltaY = this._currentY - this._startY;

    if (deltaY < -this._config.swipe_threshold) {
      this._closeDrawer();
    } else {
      this._openDrawer();
    }

    this._resetDragging();
  }

  _updateDrawerHeight() {
    const drawer = this.shadowRoot.getElementById('drawer');
    this._drawerHeight = drawer.offsetHeight;
  }

  _updateDrawerPosition(position, isClosing) {
    const drawer = this.shadowRoot.getElementById('drawer');
    const overlay = this.shadowRoot.getElementById('overlay');

    drawer.classList.add('dragging');
    overlay.classList.add('dragging');

    if (isClosing) {
      // Closing: position is how much of drawer is visible
      const clampedPosition = Math.max(0, Math.min(this._drawerHeight, position));
      const translateY = -(this._drawerHeight - clampedPosition);
      drawer.style.transform = `translateY(${translateY}px)`;
      overlay.style.opacity = clampedPosition / this._drawerHeight;
    } else {
      // Opening: position is how much user has dragged down
      const clampedPosition = Math.min(this._drawerHeight, position);
      const translateY = -this._drawerHeight + clampedPosition;
      drawer.style.transform = `translateY(${translateY}px)`;
      overlay.style.opacity = clampedPosition / this._drawerHeight;
      overlay.style.visibility = 'visible';
    }

    this._currentY = this._startY + position;
  }

  _resetDragging() {
    const drawer = this.shadowRoot.getElementById('drawer');
    const overlay = this.shadowRoot.getElementById('overlay');

    drawer.classList.remove('dragging');
    overlay.classList.remove('dragging');
    drawer.style.transform = '';
    overlay.style.opacity = '';
  }

  _openDrawer() {
    const drawer = this.shadowRoot.getElementById('drawer');
    const overlay = this.shadowRoot.getElementById('overlay');

    this._isOpen = true;
    drawer.classList.add('open');
    overlay.classList.add('visible');
    overlay.style.visibility = '';
  }

  _closeDrawer() {
    const drawer = this.shadowRoot.getElementById('drawer');
    const overlay = this.shadowRoot.getElementById('overlay');

    this._isOpen = false;
    drawer.classList.remove('open');
    overlay.classList.remove('visible');
  }

  getCardSize() {
    if (this._mainCard && typeof this._mainCard.getCardSize === 'function') {
      return this._mainCard.getCardSize();
    }
    return 3;
  }

  static getStubConfig() {
    return {
      main_card: { type: 'markdown', content: 'Main content' },
      drawer_cards: [
        { type: 'markdown', content: 'Drawer card 1' },
        { type: 'markdown', content: 'Drawer card 2' }
      ],
      auto_close_on_tap: true
    };
  }

  static getConfigElement() {
    return document.createElement('pull-down-card-editor');
  }
}

class PullDownCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  get hass() {
    return this._hass;
  }

  _render() {

    this.shadowRoot.innerHTML = `
      <style>
        .editor {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .section {
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          padding: 12px;
        }
        .section-title {
          font-weight: 500;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .card-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: var(--secondary-background-color);
          border-radius: 6px;
          margin-bottom: 8px;
        }
        .card-item:last-child {
          margin-bottom: 0;
        }
        .card-info {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          cursor: pointer;
        }
        .card-type {
          font-size: 14px;
          color: var(--primary-text-color);
        }
        .card-actions {
          display: flex;
          gap: 4px;
        }
        .card-actions ha-icon-button {
          --mdc-icon-button-size: 32px;
          --mdc-icon-size: 18px;
        }
        .add-card {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px;
          border: 2px dashed var(--divider-color);
          border-radius: 6px;
          cursor: pointer;
          color: var(--secondary-text-color);
          transition: all 0.2s;
        }
        .add-card:hover {
          border-color: var(--primary-color);
          color: var(--primary-color);
        }
        .row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 0;
        }
        .row label {
          font-size: 14px;
        }
        ha-textfield {
          width: 120px;
        }
        .hint {
          font-size: 12px;
          color: var(--secondary-text-color);
          margin-top: 4px;
        }
      </style>
      <div class="editor">
        <!-- Main Card Section -->
        <div class="section">
          <div class="section-title">
            <ha-icon icon="mdi:card-outline"></ha-icon>
            Main Card
          </div>
          <div class="card-item">
            <div class="card-info" id="edit-main">
              <ha-icon icon="mdi:pencil"></ha-icon>
              <span class="card-type">${this._getCardTypeName(this._config.main_card)}</span>
            </div>
          </div>
        </div>

        <!-- Drawer Cards Section -->
        <div class="section">
          <div class="section-title">
            <ha-icon icon="mdi:cards-outline"></ha-icon>
            Drawer Cards
          </div>
          <div id="drawer-cards-list">
            ${(this._config.drawer_cards || []).map((card, i) => `
              <div class="card-item" data-index="${i}">
                <div class="card-info" data-action="edit" data-index="${i}">
                  <ha-icon icon="mdi:drag-vertical"></ha-icon>
                  <span class="card-type">${this._getCardTypeName(card)}</span>
                </div>
                <div class="card-actions">
                  <ha-icon-button data-action="move-up" data-index="${i}" ${i === 0 ? 'disabled' : ''}>
                    <ha-icon icon="mdi:arrow-up"></ha-icon>
                  </ha-icon-button>
                  <ha-icon-button data-action="move-down" data-index="${i}" ${i === (this._config.drawer_cards?.length || 0) - 1 ? 'disabled' : ''}>
                    <ha-icon icon="mdi:arrow-down"></ha-icon>
                  </ha-icon-button>
                  <ha-icon-button data-action="delete" data-index="${i}">
                    <ha-icon icon="mdi:delete"></ha-icon>
                  </ha-icon-button>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="add-card" id="add-drawer-card">
            <ha-icon icon="mdi:plus"></ha-icon>
            <span>Add Card</span>
          </div>
        </div>

        <!-- Settings Section -->
        <div class="section">
          <div class="section-title">
            <ha-icon icon="mdi:cog"></ha-icon>
            Settings
          </div>

          <div class="row">
            <label>Auto-close on tap</label>
            <ha-switch id="auto_close_on_tap" ${this._config.auto_close_on_tap !== false ? 'checked' : ''}></ha-switch>
          </div>
          <div class="hint">Close drawer when tapping buttons inside</div>

          <div class="row" style="margin-top: 12px;">
            <label>Handle color</label>
            <ha-textfield id="handle_color" value="${this._config.handle_color || 'rgba(255,255,255,0.4)'}"></ha-textfield>
          </div>

          <div class="row">
            <label>Drawer background</label>
            <ha-textfield id="drawer_background" value="${this._config.drawer_background || 'rgba(0,0,0,0.5)'}"></ha-textfield>
          </div>

          <div class="row">
            <label>Drawer blur (px)</label>
            <ha-textfield id="drawer_blur" type="number" value="${this._config.drawer_blur ?? 20}"></ha-textfield>
          </div>

          <div class="row">
            <label>Animation duration (ms)</label>
            <ha-textfield id="animation_duration" type="number" value="${this._config.animation_duration ?? 300}"></ha-textfield>
          </div>
        </div>
      </div>
    `;

    this._attachEventListeners();
  }

  _getCardTypeName(cardConfig) {
    if (!cardConfig) return 'Not configured';
    const type = cardConfig.type || 'unknown';
    return type.replace('custom:', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  _attachEventListeners() {
    // Edit main card
    this.shadowRoot.getElementById('edit-main')?.addEventListener('click', () => {
      this._openCardEditor('main');
    });

    // Add drawer card
    this.shadowRoot.getElementById('add-drawer-card')?.addEventListener('click', () => {
      this._addDrawerCard();
    });

    // Drawer card actions
    this.shadowRoot.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', () => {
        const action = el.dataset.action;
        const index = parseInt(el.dataset.index);

        if (action === 'edit') {
          this._openCardEditor('drawer', index);
        } else if (action === 'delete') {
          const cards = [...(this._config.drawer_cards || [])];
          cards.splice(index, 1);
          this._config = { ...this._config, drawer_cards: cards };
          this._dispatchConfigChanged();
          this._render();
        } else if (action === 'move-up' && index > 0) {
          const cards = [...(this._config.drawer_cards || [])];
          [cards[index - 1], cards[index]] = [cards[index], cards[index - 1]];
          this._config = { ...this._config, drawer_cards: cards };
          this._dispatchConfigChanged();
          this._render();
        } else if (action === 'move-down' && index < (this._config.drawer_cards?.length || 0) - 1) {
          const cards = [...(this._config.drawer_cards || [])];
          [cards[index], cards[index + 1]] = [cards[index + 1], cards[index]];
          this._config = { ...this._config, drawer_cards: cards };
          this._dispatchConfigChanged();
          this._render();
        }
      });
    });

    // Settings
    this.shadowRoot.getElementById('auto_close_on_tap')?.addEventListener('change', (e) => {
      this._config = { ...this._config, auto_close_on_tap: e.target.checked };
      this._dispatchConfigChanged();
    });

    ['handle_color', 'drawer_background', 'drawer_blur', 'animation_duration'].forEach(key => {
      this.shadowRoot.getElementById(key)?.addEventListener('change', (e) => {
        let value = e.target.value;
        if (key === 'drawer_blur' || key === 'animation_duration') {
          value = parseInt(value) || 0;
        }
        this._config = { ...this._config, [key]: value };
        this._dispatchConfigChanged();
      });
    });
  }

  async _openCardEditor(type, index = null) {
    const cardConfig = type === 'main'
      ? this._config.main_card
      : this._config.drawer_cards?.[index];

    const homeAssistant = document.querySelector('home-assistant');
    if (!this._hass || !homeAssistant) {
      console.error('[pull-down-card] Cannot find Home Assistant instance');
      return;
    }

    try {
      await customElements.whenDefined('hui-dialog-edit-card');

      const dialog = document.createElement('hui-dialog-edit-card');
      dialog.hass = this._hass;
      document.body.appendChild(dialog);

      const handleClose = () => {
        dialog.removeEventListener('dialog-closed', handleClose);
        if (dialog.parentNode === document.body) {
          document.body.removeChild(dialog);
        }
        this._render();
      };
      dialog.addEventListener('dialog-closed', handleClose);

      await dialog.showDialog({
        cardConfig: cardConfig,
        lovelaceConfig: homeAssistant.lovelace?.config || { views: [] },
        saveCardConfig: async (newConfig) => {
          if (!newConfig) return;

          if (type === 'main') {
            this._config = { ...this._config, main_card: newConfig };
          } else {
            const cards = [...(this._config.drawer_cards || [])];
            cards[index] = newConfig;
            this._config = { ...this._config, drawer_cards: cards };
          }
          this._dispatchConfigChanged();
          this._render();
        }
      });
    } catch (e) {
      console.error('[pull-down-card] Error opening card editor:', e);
    }
  }

  async _addDrawerCard() {
    const newCard = { type: 'markdown', content: 'New card' };
    const newCards = [...(this._config.drawer_cards || []), newCard];
    this._config = { ...this._config, drawer_cards: newCards };
    this._dispatchConfigChanged();
    this._render();
    // Open the editor for the new card
    setTimeout(() => this._openCardEditor('drawer', newCards.length - 1), 100);
  }

  _dispatchConfigChanged() {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true
    }));
  }
}

customElements.get('pull-down-card') || customElements.define('pull-down-card', PullDownCard);
customElements.get('pull-down-card-editor') || customElements.define('pull-down-card-editor', PullDownCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'pull-down-card',
  name: 'Pull Down Card',
  preview: true,
  description: 'iOS-style pull-down drawer to reveal additional cards'
});

console.info(
  `%c PULL-DOWN-CARD %c v${VERSION} `,
  'color: white; background: #9c27b0; font-weight: 700;',
  'color: #9c27b0; background: white; font-weight: 700;'
);
