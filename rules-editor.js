/**
 * Editor Visual de Reglas para JP Reader
 */

class RulesEditor {
  constructor(engine) {
    this.engine = engine;
    this.isOpen = false;
    this.editingRule = null;
    this.testSentence = '';
  }

  // Crear el modal del editor
  createModal() {
    // Contenedor principal
    const overlay = document.createElement('div');
    overlay.id = 'rules-editor-overlay';
    overlay.innerHTML = `
      <div class="rules-editor-modal">
        <div class="rules-editor-header">
          <h2>Editor de Reglas</h2>
          <button class="close-btn" id="close-rules-editor">&times;</button>
        </div>
        
        <div class="rules-editor-content">
          <!-- Panel izquierdo: Lista de reglas -->
          <div class="rules-list-panel">
            <div class="rules-list-header">
              <h3>Reglas activas</h3>
              <button id="add-new-rule" class="btn-primary">+ Nueva</button>
            </div>
            <div class="rules-search">
              <input type="text" id="rules-search" placeholder="Buscar regla..." />
            </div>
            <ul id="rules-list"></ul>
            <div class="rules-list-footer">
              <button id="reset-rules" class="btn-danger">Restaurar predeterminadas</button>
            </div>
          </div>
          
          <!-- Panel derecho: Editor de regla -->
          <div class="rule-editor-panel" id="rule-editor-panel">
            <div class="no-rule-selected">
              <p>Selecciona una regla para editar o crea una nueva</p>
            </div>
          </div>
        </div>
        
        <!-- Panel inferior: Test -->
        <div class="rules-test-panel">
          <h3>Probar reglas</h3>
          <div class="test-input-row">
            <input type="text" id="test-sentence" placeholder="Escribe una frase en japones para probar..." />
            <button id="run-test" class="btn-primary">Probar</button>
          </div>
          <div id="test-result" class="test-result"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.bindEvents();
    return overlay;
  }

  // Vincular eventos
  bindEvents() {
    // Cerrar modal
    document.getElementById('close-rules-editor').addEventListener('click', () => this.close());
    document.getElementById('rules-editor-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'rules-editor-overlay') this.close();
    });

    // Nueva regla
    document.getElementById('add-new-rule').addEventListener('click', () => this.showNewRuleForm());

    // Reset
    document.getElementById('reset-rules').addEventListener('click', () => {
      if (confirm('Esto eliminara todas tus reglas personalizadas. Continuar?')) {
        this.engine.resetToDefaults();
        this.renderRulesList();
        this.hideRuleEditor();
      }
    });

    // Buscar
    document.getElementById('rules-search').addEventListener('input', (e) => {
      this.renderRulesList(e.target.value);
    });

    // Test
    document.getElementById('run-test').addEventListener('click', () => this.runTest());
    document.getElementById('test-sentence').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.runTest();
    });
  }

  // Abrir el editor
  open() {
    let overlay = document.getElementById('rules-editor-overlay');
    if (!overlay) {
      overlay = this.createModal();
    }
    overlay.classList.add('visible');
    this.isOpen = true;
    this.renderRulesList();
  }

  // Cerrar el editor
  close() {
    const overlay = document.getElementById('rules-editor-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
    }
    this.isOpen = false;
    this.editingRule = null;
  }

  // Renderizar lista de reglas
  renderRulesList(filter = '') {
    const list = document.getElementById('rules-list');
    const rules = this.engine.getRules();
    
    const filtered = filter 
      ? rules.filter(r => r.name.toLowerCase().includes(filter.toLowerCase()) || 
                         r.id.toLowerCase().includes(filter.toLowerCase()))
      : rules;

    list.innerHTML = filtered.map(rule => `
      <li class="rule-item ${rule.enabled ? '' : 'disabled'}" data-id="${rule.id}">
        <div class="rule-item-main">
          <label class="rule-toggle">
            <input type="checkbox" ${rule.enabled ? 'checked' : ''} data-toggle="${rule.id}" />
            <span class="toggle-slider"></span>
          </label>
          <div class="rule-info">
            <span class="rule-name">${rule.name}</span>
            <span class="rule-priority">P: ${rule.priority}</span>
            <span class="rule-type type-${rule.type}">${rule.type}</span>
          </div>
        </div>
        <div class="rule-actions">
          <button class="btn-edit" data-edit="${rule.id}">Editar</button>
          ${rule.id.startsWith('custom-') ? `<button class="btn-delete" data-delete="${rule.id}">Borrar</button>` : ''}
        </div>
      </li>
    `).join('');

    // Eventos de toggle
    list.querySelectorAll('[data-toggle]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        this.engine.toggleRule(e.target.dataset.toggle);
        this.renderRulesList(filter);
      });
    });

    // Eventos de editar
    list.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.showRuleEditor(e.target.dataset.edit);
      });
    });

    // Eventos de borrar
    list.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (confirm('Eliminar esta regla?')) {
          this.engine.deleteRule(e.target.dataset.delete);
          this.renderRulesList(filter);
          this.hideRuleEditor();
        }
      });
    });
  }

  // Mostrar formulario de nueva regla
  showNewRuleForm() {
    this.editingRule = null;
    this.renderRuleForm({
      id: '',
      name: '',
      priority: 500,
      enabled: true,
      type: 'standalone',
      surfaces: [],
      pos: [],
      nextSurface: '',
      nextPos: '',
      prevPos: '',
      outputTemplate: '{current}',
      consume: 1
    });
  }

  // Mostrar editor de regla existente
  showRuleEditor(ruleId) {
    const rule = this.engine.getRule(ruleId);
    if (!rule) return;
    
    this.editingRule = rule;
    this.renderRuleForm(rule);
  }

  // Ocultar editor de regla
  hideRuleEditor() {
    const panel = document.getElementById('rule-editor-panel');
    panel.innerHTML = `
      <div class="no-rule-selected">
        <p>Selecciona una regla para editar o crea una nueva</p>
      </div>
    `;
    this.editingRule = null;
  }

  // Renderizar formulario de regla
  renderRuleForm(rule) {
    const panel = document.getElementById('rule-editor-panel');
    const isNew = !rule.id || rule.id === '';
    const isCustom = rule.id.startsWith('custom-') || isNew;
    
    panel.innerHTML = `
      <div class="rule-form">
        <h3>${isNew ? 'Nueva Regla' : 'Editar Regla'}</h3>
        
        <div class="form-group">
          <label>Nombre</label>
          <input type="text" id="rule-name" value="${rule.name}" placeholder="Ej: Mi regla personalizada" />
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Prioridad</label>
            <input type="number" id="rule-priority" value="${rule.priority}" min="1" max="9999" />
            <small>Mayor numero = se evalua primero</small>
          </div>
          
          <div class="form-group">
            <label>Tipo</label>
            <select id="rule-type">
              <option value="standalone" ${rule.type === 'standalone' ? 'selected' : ''}>Standalone (independiente)</option>
              <option value="merge" ${rule.type === 'merge' ? 'selected' : ''}>Merge (unir al buffer)</option>
              <option value="compound" ${rule.type === 'compound' ? 'selected' : ''}>Compound (multi-token)</option>
              <option value="split" ${rule.type === 'split' ? 'selected' : ''}>Split (cortar)</option>
            </select>
          </div>
        </div>
        
        <div class="form-section">
          <h4>Condiciones</h4>
          
          <div class="form-group">
            <label>Surfaces (separadas por coma)</label>
            <input type="text" id="rule-surfaces" value="${(rule.surfaces || []).join(', ')}" placeholder="Ej: に, は, を" />
            <small>El token debe coincidir con alguna de estas formas</small>
          </div>
          
          <div class="form-group">
            <label>POS - Partes del discurso (separadas por coma)</label>
            <input type="text" id="rule-pos" value="${(rule.pos || []).join(', ')}" placeholder="Ej: 動詞, 名詞, 助詞" />
            <small>Categorias gramaticales: 動詞(verbo), 名詞(sustantivo), 助詞(particula), 副詞(adverbio), 感動詞(interjeccion), 接頭詞(prefijo)</small>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Surface siguiente</label>
              <input type="text" id="rule-next-surface" value="${rule.nextSurface || ''}" placeholder="Ej: は" />
            </div>
            <div class="form-group">
              <label>POS siguiente</label>
              <input type="text" id="rule-next-pos" value="${rule.nextPos || ''}" placeholder="Ej: 動詞" />
            </div>
          </div>
          
          <div class="form-group">
            <label>POS anterior</label>
            <input type="text" id="rule-prev-pos" value="${rule.prevPos || ''}" placeholder="Ej: 動詞" />
          </div>
        </div>
        
        <div class="form-section">
          <h4>Accion</h4>
          
          <div class="form-row">
            <div class="form-group">
              <label>Tokens a consumir</label>
              <input type="number" id="rule-consume" value="${rule.consume || 1}" min="1" max="10" />
            </div>
            
            <div class="form-group">
              <label>Template de salida</label>
              <input type="text" id="rule-output" value="${rule.outputTemplate || '{current}'}" placeholder="{current}" />
              <small>Usa {current} y {next} como placeholders</small>
            </div>
          </div>
        </div>
        
        <div class="form-actions">
          <button id="cancel-rule" class="btn-secondary">Cancelar</button>
          <button id="save-rule" class="btn-primary">${isNew ? 'Crear Regla' : 'Guardar Cambios'}</button>
        </div>
      </div>
    `;

    // Eventos del formulario
    document.getElementById('cancel-rule').addEventListener('click', () => this.hideRuleEditor());
    document.getElementById('save-rule').addEventListener('click', () => this.saveRule(isNew));
  }

  // Guardar regla
  saveRule(isNew) {
    const name = document.getElementById('rule-name').value.trim();
    const priority = parseInt(document.getElementById('rule-priority').value) || 500;
    const type = document.getElementById('rule-type').value;
    const surfaces = document.getElementById('rule-surfaces').value.split(',').map(s => s.trim()).filter(s => s);
    const pos = document.getElementById('rule-pos').value.split(',').map(s => s.trim()).filter(s => s);
    const nextSurface = document.getElementById('rule-next-surface').value.trim();
    const nextPos = document.getElementById('rule-next-pos').value.trim();
    const prevPos = document.getElementById('rule-prev-pos').value.trim();
    const consume = parseInt(document.getElementById('rule-consume').value) || 1;
    const outputTemplate = document.getElementById('rule-output').value.trim() || '{current}';

    if (!name) {
      alert('El nombre es requerido');
      return;
    }

    if (surfaces.length === 0 && pos.length === 0) {
      alert('Debes especificar al menos una surface o POS');
      return;
    }

    const ruleData = {
      name,
      priority,
      enabled: true,
      type,
      surfaces,
      pos,
      nextSurface: nextSurface || undefined,
      nextPos: nextPos || undefined,
      prevPos: prevPos || undefined,
      consume,
      outputTemplate
    };

    if (isNew) {
      this.engine.addRule(ruleData);
    } else {
      this.engine.updateRule(this.editingRule.id, ruleData);
    }

    this.renderRulesList();
    this.hideRuleEditor();
  }

  // Ejecutar test
  runTest() {
    const sentence = document.getElementById('test-sentence').value.trim();
    const resultDiv = document.getElementById('test-result');
    
    if (!sentence) {
      resultDiv.innerHTML = '<span class="test-error">Escribe una frase para probar</span>';
      return;
    }

    if (!tokenizer) {
      resultDiv.innerHTML = '<span class="test-error">Tokenizer no esta listo</span>';
      return;
    }

    const tokens = tokenizer.tokenize(sentence);
    const units = this.engine.buildUnits(tokens);
    
    // Mostrar tokens y unidades
    resultDiv.innerHTML = `
      <div class="test-tokens">
        <strong>Tokens:</strong>
        ${tokens.map(t => `<span class="token-chip" title="POS: ${t.pos}">${t.surface_form}</span>`).join('')}
      </div>
      <div class="test-units">
        <strong>Unidades:</strong>
        ${units.map(u => `<span class="unit-chip">${u}</span>`).join('')}
      </div>
    `;
  }
}

// Instancia global
const rulesEditor = new RulesEditor(rulesEngine);
