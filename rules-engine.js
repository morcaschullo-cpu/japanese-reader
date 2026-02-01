/**
 * Sistema de Reglas con Prioridades para JP Reader
 * 
 * Cada regla tiene:
 * - id: identificador único
 * - name: nombre descriptivo
 * - priority: número (mayor = se evalúa primero)
 * - enabled: boolean
 * - type: 'merge' | 'split' | 'standalone'
 * - condition: función que recibe (tokens, index, buffer) y retorna true/false
 * - action: función que retorna { consume: number, output: string, flush: boolean }
 */

const RULE_TYPES = {
  MERGE: 'merge',           // Une tokens consecutivos
  STANDALONE: 'standalone', // Token independiente (flush antes y después)
  SPLIT: 'split',           // Corta el buffer actual
  COMPOUND: 'compound'      // Partículas compuestas (consume múltiples tokens)
};

// Reglas por defecto - migradas del sistema original
const DEFAULT_RULES = [
  // === PRIORIDAD 1000+: Marcos temporales y expresiones fijas ===
  {
    id: 'temporal-frames',
    name: 'Marcos temporales (今まで, 最近, etc.)',
    priority: 1000,
    enabled: true,
    type: RULE_TYPES.STANDALONE,
    surfaces: ['今まで', '最近', 'ここしばらく'],
    condition: (t, i, tokens, buffer) => ['今まで', '最近', 'ここしばらく'].includes(t.surface_form),
    action: (t) => ({ consume: 1, output: t.surface_form, flush: true })
  },
  {
    id: 'daibun-standalone',
    name: '大分 como bloque propio',
    priority: 999,
    enabled: true,
    type: RULE_TYPES.STANDALONE,
    surfaces: ['大分'],
    condition: (t) => t.surface_form === '大分',
    action: (t) => ({ consume: 1, output: t.surface_form, flush: true })
  },
  {
    id: 'otsukare-standalone',
    name: 'お疲れ como bloque propio',
    priority: 998,
    enabled: true,
    type: RULE_TYPES.STANDALONE,
    surfaces: ['お疲れ'],
    condition: (t) => t.surface_form === 'お疲れ',
    action: (t) => ({ consume: 1, output: t.surface_form, flush: true })
  },

  // === PRIORIDAD 900: Patrones con contexto ===
  {
    id: 'chotto-verb',
    name: 'ちょっと + verbo (unir)',
    priority: 900,
    enabled: true,
    type: RULE_TYPES.MERGE,
    surfaces: ['ちょっと'],
    condition: (t, i, tokens) => t.surface_form === 'ちょっと' && tokens[i + 1]?.pos === '動詞',
    action: (t) => ({ consume: 1, output: t.surface_form, flush: false })
  },
  {
    id: 'chotto-discursive',
    name: 'ちょっと discursivo (independiente)',
    priority: 899,
    enabled: true,
    type: RULE_TYPES.STANDALONE,
    surfaces: ['ちょっと'],
    condition: (t, i, tokens) => t.surface_form === 'ちょっと' && tokens[i + 1]?.pos !== '動詞',
    action: (t) => ({ consume: 1, output: 'ちょっと', flush: true })
  },

  // === PRIORIDAD 800: Condicionales ===
  {
    id: 'conditionals',
    name: 'Condicionales (ば, たら, なら)',
    priority: 800,
    enabled: true,
    type: RULE_TYPES.MERGE,
    surfaces: ['ば', 'たら', 'なら'],
    condition: (t, i, tokens) => ['ば', 'たら', 'なら'].includes(t.surface_form) && tokens[i - 1]?.pos === '動詞',
    action: (t) => ({ consume: 1, output: t.surface_form, flush: true })
  },

  // === PRIORIDAD 750: Partículas compuestas ===
  {
    id: 'niwa-compound',
    name: 'には (partícula compuesta)',
    priority: 750,
    enabled: true,
    type: RULE_TYPES.COMPOUND,
    surfaces: ['に'],
    condition: (t, i, tokens) => t.surface_form === 'に' && tokens[i + 1]?.surface_form === 'は',
    action: (t, i, tokens) => ({ consume: 2, output: 'には', flush: true })
  },
  {
    id: 'dewa-compound',
    name: 'では (partícula compuesta)',
    priority: 750,
    enabled: true,
    type: RULE_TYPES.COMPOUND,
    surfaces: ['で'],
    condition: (t, i, tokens) => t.surface_form === 'で' && tokens[i + 1]?.surface_form === 'は',
    action: (t, i, tokens) => ({ consume: 2, output: 'では', flush: true })
  },

  // === PRIORIDAD 700: Expresiones fijas ===
  {
    id: 'sasugani',
    name: 'さすがに (expresión fija)',
    priority: 700,
    enabled: true,
    type: RULE_TYPES.COMPOUND,
    surfaces: ['さすが'],
    condition: (t, i, tokens) => t.surface_form === 'さすが' && tokens[i + 1]?.surface_form === 'に',
    action: () => ({ consume: 2, output: 'さすがに', flush: true })
  },
  {
    id: 'tokuseino',
    name: '特製の (valorativo)',
    priority: 700,
    enabled: true,
    type: RULE_TYPES.COMPOUND,
    surfaces: ['特製'],
    condition: (t, i, tokens) => t.surface_form === '特製' && tokens[i + 1]?.surface_form === 'の',
    action: () => ({ consume: 2, output: '特製の', flush: true })
  },

  // === PRIORIDAD 650: Interjecciones combinadas ===
  {
    id: 'eitsu-interjection',
    name: 'えいっ (interjección combinada)',
    priority: 650,
    enabled: true,
    type: RULE_TYPES.COMPOUND,
    surfaces: ['え'],
    condition: (t, i, tokens) => t.surface_form === 'え' && (tokens[i + 1]?.surface_form === 'いっ' || tokens[i + 1]?.surface_form === 'い'),
    action: (t, i, tokens) => ({ consume: 2, output: t.surface_form + tokens[i + 1].surface_form, flush: true })
  },

  // === PRIORIDAD 600: Interjecciones independientes ===
  {
    id: 'interjections',
    name: 'Interjecciones (感動詞)',
    priority: 600,
    enabled: true,
    type: RULE_TYPES.STANDALONE,
    pos: ['感動詞'],
    condition: (t) => t.pos === '感動詞',
    action: (t) => ({ consume: 1, output: t.surface_form, flush: true })
  },

  // === PRIORIDAD 550: Adverbios discursivos ===
  {
    id: 'adverb-blocks',
    name: 'Adverbios discursivos',
    priority: 550,
    enabled: true,
    type: RULE_TYPES.STANDALONE,
    surfaces: ['やっと', 'もしかして', 'あえて', '全然', 'まったく', 'ゆっくり', 'とても', 'せっかく', 'まあ', 'いや', 'えっと'],
    condition: (t) => t.pos === '副詞' && ['やっと', 'もしかして', 'あえて', '全然', 'まったく', 'ゆっくり', 'とても', 'せっかく', 'まあ', 'いや', 'えっと'].includes(t.surface_form),
    action: (t) => ({ consume: 1, output: t.surface_form, flush: true })
  },

  // === PRIORIDAD 500: Prefijos honoríficos ===
  {
    id: 'honorific-prefix',
    name: 'Prefijos honoríficos + sustantivo',
    priority: 500,
    enabled: true,
    type: RULE_TYPES.MERGE,
    pos: ['接頭詞'],
    condition: (t, i, tokens) => t.pos === '接頭詞' && tokens[i + 1]?.pos === '名詞',
    action: (t) => ({ consume: 1, output: t.surface_form, flush: false })
  },

  // === PRIORIDAD 450: Circunstancia で ===
  {
    id: 'de-circumstance',
    name: 'で circunstancial',
    priority: 450,
    enabled: true,
    type: RULE_TYPES.MERGE,
    surfaces: ['で'],
    condition: (t, i, tokens) => t.surface_form === 'で' && (tokens[i + 1]?.pos === '名詞' || (tokens[i + 1]?.pos === '接頭詞' && tokens[i + 2]?.pos === '名詞')),
    action: (t) => ({ consume: 1, output: t.surface_form, flush: true })
  },

  // === PRIORIDAD 400: Modificador N を Vた ===
  {
    id: 'wo-vta-modifier',
    name: 'Nを Vた (modificador largo)',
    priority: 400,
    enabled: true,
    type: RULE_TYPES.MERGE,
    surfaces: ['を'],
    condition: (t, i, tokens) => t.surface_form === 'を' && tokens[i + 1]?.pos === '動詞' && tokens[i + 2]?.surface_form === 'た',
    action: (t) => ({ consume: 1, output: t.surface_form, flush: false })
  },

  // === PRIORIDAD 350: Acción preparatoria Nを Vて ===
  {
    id: 'wo-vte-preparatory',
    name: 'Nを Vて (acción preparatoria)',
    priority: 350,
    enabled: true,
    type: RULE_TYPES.MERGE,
    surfaces: ['を'],
    condition: (t, i, tokens) => t.surface_form === 'を' && tokens[i + 1]?.pos === '動詞' && tokens[i + 2]?.surface_form === 'て',
    action: (t) => ({ consume: 1, output: t.surface_form, flush: false })
  },

  // === PRIORIDAD 300: Patrones de expresión ===
  {
    id: 'janaidesu-pattern',
    name: 'じゃないですか～ patrón',
    priority: 300,
    enabled: true,
    type: RULE_TYPES.COMPOUND,
    surfaces: ['じゃ'],
    condition: (t, i, tokens) => {
      if (t.surface_form !== 'じゃ') return false;
      const seq = ['ない', 'です', 'か'];
      for (let j = 0; j < seq.length; j++) {
        if (tokens[i + 1 + j]?.surface_form !== seq[j]) return false;
      }
      return true;
    },
    action: (t, i, tokens) => {
      let result = 'じゃないですか';
      let consume = 4;
      if (tokens[i + 4]?.surface_form === '～') {
        result += '～';
        consume = 5;
      }
      return { consume, output: result, flush: true };
    }
  },
  {
    id: 'mitaidesu-pattern',
    name: 'みたいですね patrón',
    priority: 300,
    enabled: true,
    type: RULE_TYPES.COMPOUND,
    surfaces: ['みたい'],
    condition: (t, i, tokens) => {
      if (t.surface_form !== 'みたい') return false;
      return tokens[i + 1]?.surface_form === 'です' && tokens[i + 2]?.surface_form === 'ね';
    },
    action: () => ({ consume: 3, output: 'みたいですね', flush: true })
  },

  // === PRIORIDAD 200: Partículas básicas ===
  {
    id: 'basic-particles',
    name: 'Partículas básicas (も, が, を, に, は)',
    priority: 200,
    enabled: true,
    type: RULE_TYPES.MERGE,
    surfaces: ['も', 'が', 'を', 'に', 'は'],
    condition: (t) => ['も', 'が', 'を', 'に', 'は'].includes(t.surface_form),
    action: (t) => ({ consume: 1, output: t.surface_form, flush: true })
  },
  {
    id: 'tte-particle',
    name: 'って partícula',
    priority: 200,
    enabled: true,
    type: RULE_TYPES.MERGE,
    surfaces: ['って'],
    condition: (t) => t.surface_form === 'って',
    action: (t) => ({ consume: 1, output: t.surface_form, flush: true })
  },

  // === PRIORIDAD 100: Puntuación ===
  {
    id: 'pause-comma',
    name: 'Pausa (、)',
    priority: 100,
    enabled: true,
    type: RULE_TYPES.MERGE,
    surfaces: ['、'],
    condition: (t) => t.surface_form === '、',
    action: (t, i, tokens, buffer, units) => {
      if (buffer === '' && units.length > 0) {
        return { consume: 1, output: '', flush: false, appendToLast: '、' };
      }
      return { consume: 1, output: '、', flush: true };
    }
  },
  {
    id: 'strong-close',
    name: 'Cierre fuerte (。！？)',
    priority: 100,
    enabled: true,
    type: RULE_TYPES.MERGE,
    surfaces: ['。', '！', '？'],
    condition: (t) => ['。', '！', '？'].includes(t.surface_form),
    action: (t) => ({ consume: 1, output: t.surface_form, flush: true })
  }
];

// Motor de reglas
class RulesEngine {
  constructor() {
    this.rules = [];
    this.loadRules();
  }

  // Cargar reglas desde localStorage o usar las por defecto
  loadRules() {
    const saved = localStorage.getItem('jp-reader-rules');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Reconstruir funciones desde strings si es necesario
        this.rules = this.hydrateRules(parsed);
      } catch (e) {
        console.error('Error loading rules, using defaults:', e);
        this.rules = [...DEFAULT_RULES];
      }
    } else {
      this.rules = [...DEFAULT_RULES];
    }
    this.sortRules();
  }

  // Guardar reglas en localStorage
  saveRules() {
    const toSave = this.rules.map(r => ({
      ...r,
      // No guardamos las funciones, solo los datos
      condition: r.conditionStr || null,
      action: r.actionStr || null
    }));
    localStorage.setItem('jp-reader-rules', JSON.stringify(toSave));
  }

  // Ordenar reglas por prioridad (mayor primero)
  sortRules() {
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  // Hidratar reglas (convertir strings a funciones si es necesario)
  hydrateRules(savedRules) {
    return savedRules.map(saved => {
      // Buscar la regla por defecto para obtener las funciones
      const defaultRule = DEFAULT_RULES.find(d => d.id === saved.id);
      if (defaultRule) {
        return {
          ...defaultRule,
          ...saved,
          condition: defaultRule.condition,
          action: defaultRule.action
        };
      }
      // Regla personalizada sin funciones por defecto
      return {
        ...saved,
        condition: this.createConditionFromConfig(saved),
        action: this.createActionFromConfig(saved)
      };
    });
  }

  // Crear función de condición desde configuración
  createConditionFromConfig(config) {
    return (t, i, tokens) => {
      // Verificar surfaces
      if (config.surfaces && config.surfaces.length > 0) {
        if (!config.surfaces.includes(t.surface_form)) return false;
      }
      // Verificar pos
      if (config.pos && config.pos.length > 0) {
        if (!config.pos.includes(t.pos)) return false;
      }
      // Verificar siguiente token si se especifica
      if (config.nextSurface) {
        if (tokens[i + 1]?.surface_form !== config.nextSurface) return false;
      }
      if (config.nextPos) {
        if (tokens[i + 1]?.pos !== config.nextPos) return false;
      }
      // Verificar token anterior si se especifica
      if (config.prevPos) {
        if (tokens[i - 1]?.pos !== config.prevPos) return false;
      }
      return true;
    };
  }

  // Crear función de acción desde configuración
  createActionFromConfig(config) {
    return (t, i, tokens) => {
      let output = config.outputTemplate || t.surface_form;
      let consume = config.consume || 1;
      
      // Reemplazar placeholders en el template
      if (output.includes('{current}')) {
        output = output.replace('{current}', t.surface_form);
      }
      if (output.includes('{next}') && tokens[i + 1]) {
        output = output.replace('{next}', tokens[i + 1].surface_form);
      }
      
      return {
        consume,
        output,
        flush: config.type === RULE_TYPES.STANDALONE || config.type === RULE_TYPES.COMPOUND
      };
    };
  }

  // Agregar nueva regla
  addRule(rule) {
    // Generar ID único si no tiene
    if (!rule.id) {
      rule.id = 'custom-' + Date.now();
    }
    
    // Crear funciones si no las tiene
    if (!rule.condition) {
      rule.condition = this.createConditionFromConfig(rule);
    }
    if (!rule.action) {
      rule.action = this.createActionFromConfig(rule);
    }
    
    this.rules.push(rule);
    this.sortRules();
    this.saveRules();
    return rule;
  }

  // Actualizar regla existente
  updateRule(id, updates) {
    const index = this.rules.findIndex(r => r.id === id);
    if (index === -1) return null;
    
    const rule = { ...this.rules[index], ...updates };
    
    // Recrear funciones si se actualizó la configuración
    if (updates.surfaces || updates.pos || updates.nextSurface || updates.nextPos || updates.prevPos) {
      rule.condition = this.createConditionFromConfig(rule);
    }
    if (updates.outputTemplate || updates.consume || updates.type) {
      rule.action = this.createActionFromConfig(rule);
    }
    
    this.rules[index] = rule;
    this.sortRules();
    this.saveRules();
    return rule;
  }

  // Eliminar regla
  deleteRule(id) {
    const index = this.rules.findIndex(r => r.id === id);
    if (index === -1) return false;
    
    this.rules.splice(index, 1);
    this.saveRules();
    return true;
  }

  // Habilitar/deshabilitar regla
  toggleRule(id) {
    const rule = this.rules.find(r => r.id === id);
    if (rule) {
      rule.enabled = !rule.enabled;
      this.saveRules();
    }
    return rule;
  }

  // Obtener todas las reglas
  getRules() {
    return this.rules;
  }

  // Obtener regla por ID
  getRule(id) {
    return this.rules.find(r => r.id === id);
  }

  // Resetear a reglas por defecto
  resetToDefaults() {
    this.rules = [...DEFAULT_RULES];
    this.sortRules();
    localStorage.removeItem('jp-reader-rules');
  }

  // Construir unidades usando el sistema de reglas
  buildUnits(tokens) {
    const units = [];
    let buffer = '';

    const flush = () => {
      if (buffer) {
        units.push(buffer);
        buffer = '';
      }
    };

    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      const surf = t.surface_form;

      // Ignorar espacios
      if (/^\s+$/.test(surf)) {
        flush();
        i++;
        continue;
      }

      // Buscar regla que aplique
      let matched = false;
      for (const rule of this.rules) {
        if (!rule.enabled) continue;
        
        try {
          if (rule.condition(t, i, tokens, buffer, units)) {
            const result = rule.action(t, i, tokens, buffer, units);
            
            // Flush antes si es STANDALONE o COMPOUND
            if (rule.type === RULE_TYPES.STANDALONE || rule.type === RULE_TYPES.COMPOUND) {
              flush();
            }
            
            // Agregar al último unit si se especifica
            if (result.appendToLast && units.length > 0) {
              units[units.length - 1] += result.appendToLast;
            } else if (result.output) {
              buffer += result.output;
            }
            
            // Flush después si se indica
            if (result.flush) {
              flush();
            }
            
            i += result.consume;
            matched = true;
            break;
          }
        } catch (e) {
          console.error(`Error in rule ${rule.id}:`, e);
        }
      }

      // Si ninguna regla aplica, agregar al buffer
      if (!matched) {
        buffer += surf;
        i++;
      }
    }

    flush();
    return units;
  }
}

// Instancia global
const rulesEngine = new RulesEngine();

// Función de compatibilidad con el sistema anterior
function buildUnits(tokens) {
  return rulesEngine.buildUnits(tokens);
}
