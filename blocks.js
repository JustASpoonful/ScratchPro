/**
 * SCRATCH PRO - CORE KERNEL & BLOCK DEFINITIONS
 * * --- INSTRUCTIONS FOR AI ASSISTANTS ---
 * 1. TO ADD A NEW BLOCK:
 * A. Define visual block in Blockly.Blocks['block_name'].
 * B. Define code generator in gen.forBlock['block_name'].
 * C. Use 'await sleep(ms)' for any block that takes time or loops to prevent UI freezing.
 * D. Use 'self' to refer to the sprite executing the code.
 * E. Use 'state' to access global properties (stage, backdrops, etc.).
 * * 2. MISSING CATEGORIES TO IMPLEMENT:
 * - SENSING: (touching color?, distance to mouse, key pressed?, mouse x/y)
 * - OPERATORS: (+, -, *, /, random, <, >, =, and, or, not, join, length)
 * - SOUND: (play sound until done, start sound, stop all sounds, pitch effect)
 * - PEN: (erase all, stamp, pen down, pen up, set pen color)
 */

const state = {
    entities: [],
    stageEntity: null,
    activeEntityId: null,
    stage: { w: 380, h: 285 },
    isRunning: false,
    abortController: null, 
    backdrops: {
        'Void': '#000000',
        'Deep Space': 'linear-gradient(45deg, #020617 0%, #1e1b4b 100%)',
        'Neon Grid': 'linear-gradient(rgba(99, 102, 241, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 102, 241, 0.1) 1px, transparent 1px), #020617',
    },
    currentBackdrop: 'Deep Space',
    costumes: { 'star': 'M50 15 L58 42 L85 42 L63 58 L71 85 L50 68 L29 85 L37 58 L15 42 L42 42 Z' },
    
    init() {
        this.stageEntity = { id: 'STAGE', name: 'Stage', isStage: true, xml: '<xml xmlns="https://developers.google.com/blockly/xml"></xml>' };
        this.renderStageThumb();
        this.createSprite('Sprite1');
        this.setActive('s_0'); 
    },
    
    createSprite(name = null) {
        const id = `s_${this.entities.length}`;
        const entity = { 
            id, name: name || `Sprite${this.entities.length + 1}`, 
            x: this.stage.w / 2, y: this.stage.h / 2, direction: 90, 
            costume: 'star', dom: null, isStage: false,
            xml: '<xml xmlns="https://developers.google.com/blockly/xml"></xml>' 
        };
        this.entities.push(entity);
        this.renderSprite(entity);
        this.setActive(id);
        logToConsole(`Kernel: Created sprite <${entity.name}>`);
        return entity;
    },
    
    renderSprite(entity) {
        const div = document.createElement('div');
        div.className = 'sprite-entity';
        div.style.width = '44px'; div.style.height = '44px';
        div.innerHTML = `<svg viewBox="0 0 100 100" class="w-full h-full"><path d="${this.costumes[entity.costume]}" fill="var(--accent)" stroke="rgba(255,255,255,0.4)" stroke-width="3"/></svg>`;
        div.onclick = (e) => { e.stopPropagation(); this.setActive(entity.id); };
        
        let isDragging = false;
        div.onmousedown = (e) => { 
            isDragging = true; this.setActive(entity.id);
            document.onmousemove = (ev) => {
                if(!isDragging) return;
                const rect = document.getElementById('stage').getBoundingClientRect();
                entity.x = Math.max(0, Math.min(this.stage.w, ev.clientX - rect.left));
                entity.y = Math.max(0, Math.min(this.stage.h, ev.clientY - rect.top));
                this.updateUI();
            };
            document.onmouseup = () => isDragging = false;
        };
        document.getElementById('stage').appendChild(div);
        entity.dom = div;
    },

    setActive(id) {
        const old = this.getActiveEntity();
        if(old && workspace) old.xml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace));
        this.activeEntityId = id; 
        const current = this.getActiveEntity();
        if(current && workspace) {
            workspace.clear();
            try {
                const dom = Blockly.utils.xml.textToDom(current.xml);
                Blockly.Xml.domToWorkspace(dom, workspace);
            } catch(e) { console.error(e); }
        }
        this.updateUI(); 
    },
    
    getActiveEntity() { 
        return this.activeEntityId === 'STAGE' ? this.stageEntity : this.entities.find(e => e.id === this.activeEntityId); 
    },
    
    updateUI() {
        const stageDiv = document.getElementById('stage-backdrop');
        if(stageDiv) stageDiv.style.background = this.backdrops[this.currentBackdrop];

        this.entities.forEach(e => {
            if (e.dom) {
                e.dom.style.left = `${e.x - 22}px`; e.dom.style.top = `${e.y - 22}px`;
                e.dom.style.transform = `rotate(${e.direction - 90}deg)`;
                e.dom.classList.toggle('active', e.id === this.activeEntityId);
            }
        });

        const list = document.getElementById('sprite-list');
        if(list) {
            list.innerHTML = '';
            this.entities.forEach(e => {
                const thumb = document.createElement('div');
                thumb.className = `sprite-thumb ${e.id === this.activeEntityId ? 'active' : ''}`;
                thumb.innerHTML = `<svg class="w-8 h-8" viewBox="0 0 100 100"><path d="${this.costumes[e.costume]}" fill="var(--accent)"/></svg><span>${e.name}</span>`;
                thumb.onclick = () => this.setActive(e.id);
                list.appendChild(thumb);
            });
        }
        document.getElementById('active-name').innerText = this.getActiveEntity()?.name || 'Null';
    },

    renderStageThumb() {
        document.getElementById('stage-thumb-container').innerHTML = `
            <div id="thumb-STAGE" class="sprite-thumb w-full flex-1" onclick="state.setActive('STAGE')">
                <i class="fas fa-globe text-xl opacity-60"></i><span>Stage</span>
            </div>
        `;
    },

    async broadcast(msg) {
        logToConsole(`Broadcast: "${msg}"`);
        const targets = [...this.entities, this.stageEntity];
        targets.forEach(entity => {
            const tempWs = new Blockly.Workspace();
            try {
                Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(entity.xml), tempWs);
                tempWs.getBlocksByType('event_whenbroadcastreceived').forEach(block => {
                    if (block.getFieldValue('MESSAGE') === msg) {
                        const next = block.getNextBlock();
                        if(next) {
                            const code = gen.blockToCode(next);
                            const fn = new Function('state', 'self', 'moveSprite', 'sleep', 'logToConsole', `(async()=>{ ${code} })()`);
                            fn(this, entity, moveSprite, sleep, logToConsole);
                        }
                    }
                });
            } finally { tempWs.dispose(); }
        });
    }
};

/** --- BLOCK DEFINITIONS --- **/

// Events
Blockly.Blocks['event_whenflagclicked'] = { init: function() { this.appendDummyInput().appendField("when flag clicked"); this.setNextStatement(true); this.setColour("#FFBF00"); this.hat='cap'; } };
Blockly.Blocks['event_whenbroadcastreceived'] = { init: function() { this.appendDummyInput().appendField("when I receive").appendField(new Blockly.FieldTextInput("message1"), "MESSAGE"); this.setNextStatement(true); this.setColour("#FFBF00"); this.hat='cap'; } };
Blockly.Blocks['event_broadcast'] = { init: function() { this.appendValueInput("MESSAGE").setCheck("String").appendField("broadcast"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour("#FFBF00"); } };

// Motion
Blockly.Blocks['motion_move'] = { init: function() { this.appendValueInput("STEPS").setCheck("Number").appendField("move"); this.appendDummyInput().appendField("steps"); this.setInputsInline(true); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour("#4C97FF"); } };
Blockly.Blocks['motion_turn'] = { init: function() { 
    this.appendDummyInput().appendField(this.getFieldValue('DIRECTION') === 'RIGHT' ? "turn ↻" : "turn ↺");
    this.appendValueInput("DEGREES").setCheck("Number");
    this.setInputsInline(true); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour("#4C97FF"); 
} };
Blockly.Blocks['motion_goto_xy'] = { init: function() { this.appendDummyInput().appendField("go to x:"); this.appendValueInput("X").setCheck("Number"); this.appendDummyInput().appendField("y:"); this.appendValueInput("Y").setCheck("Number"); this.setInputsInline(true); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour("#4C97FF"); } };

// Looks & Control
Blockly.Blocks['looks_say'] = { init: function() { this.appendDummyInput().appendField("say"); this.appendValueInput("MESSAGE").setCheck(null); this.setInputsInline(true); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour("#9966FF"); } };
Blockly.Blocks['control_wait'] = { init: function() { this.appendDummyInput().appendField("wait"); this.appendValueInput("DURATION").setCheck("Number"); this.setInputsInline(true); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour("#FFAB19"); } };
Blockly.Blocks['control_forever'] = { init: function() { this.appendDummyInput().appendField("forever"); this.appendStatementInput("DO"); this.setPreviousStatement(true); this.setColour("#FFAB19"); } };

/** --- CODE GENERATORS --- **/

const gen = javascript.javascriptGenerator;
gen.forBlock['event_whenflagclicked'] = () => "";
gen.forBlock['event_whenbroadcastreceived'] = () => "";
gen.forBlock['event_broadcast'] = (b) => `await state.broadcast(${gen.valueToCode(b,'MESSAGE',javascript.Order.ATOMIC)});\n`;
gen.forBlock['motion_move'] = (b) => `if(!self.isStage) await moveSprite(self, ${gen.valueToCode(b,'STEPS',javascript.Order.ATOMIC)||0});\n`;
gen.forBlock['motion_turn'] = (b) => {
    const deg = gen.valueToCode(b,'DEGREES',javascript.Order.ATOMIC)||0;
    return `if(!self.isStage) { self.direction += ${deg}; state.updateUI(); await sleep(30); }\n`;
};
gen.forBlock['motion_goto_xy'] = (b) => `if(!self.isStage) { self.x = ${gen.valueToCode(b,'X',javascript.Order.ATOMIC)} + state.stage.w/2; self.y = state.stage.h/2 - ${gen.valueToCode(b,'Y',javascript.Order.ATOMIC)}; state.updateUI(); await sleep(30); }\n`;
gen.forBlock['control_wait'] = (b) => `await sleep(${gen.valueToCode(b,'DURATION',javascript.Order.ATOMIC)*1000});\n`;
gen.forBlock['control_forever'] = (b) => `while(true) {\n${gen.statementToCode(b,'DO')} await sleep(10);\n}\n`;
gen.forBlock['looks_say'] = (b) => `logToConsole("[" + self.name + "] " + ${gen.valueToCode(b,'MESSAGE',javascript.Order.ATOMIC)}); await sleep(100);\n`;
gen.forBlock['controls_repeat_ext'] = (block) => {
    const repeats = gen.valueToCode(block, 'TIMES', javascript.Order.ASSIGNMENT) || '0';
    return `for (let i = 0; i < ${repeats}; i++) {\n${gen.statementToCode(block, 'DO')} await sleep(10);\n}\n`;
};
gen.forBlock['controls_if'] = (block) => `if (${gen.valueToCode(block, 'IF0', javascript.Order.NONE) || 'false'}) {\n${gen.statementToCode(block, 'DO0')}}\n`;

/** --- SYSTEM RUNTIME --- **/

const workspace = Blockly.inject('blocklyDiv', {
    toolbox: document.getElementById('toolbox'),
    theme: Blockly.Themes.Modern,
    renderer: 'zelos',
    zoom: { controls: true, startScale: 0.8 },
    grid: { spacing: 25, length: 2, colour: 'rgba(255,255,255,0.05)', snap: true }
});

const logToConsole = (msg) => {
    const c = document.getElementById('console');
    c.innerHTML += `<div class="mb-1 border-l-2 border-indigo-500/30 pl-2"><span class="text-slate-200">${msg}</span></div>`;
    c.scrollTop = c.scrollHeight;
};

const sleep = (ms) => new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    state.abortController?.signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new Error('ABORTED'));
    });
});

async function moveSprite(entity, steps) { 
    const r = (entity.direction - 90) * (Math.PI / 180); 
    entity.x += Math.cos(r) * steps; entity.y += Math.sin(r) * steps; 
    state.updateUI(); await sleep(30);
}

function setTheme(theme) {
    document.body.className = `theme-${theme}`;
    document.querySelectorAll('.theme-pill').forEach(p => p.classList.remove('active'));
    document.getElementById(`pill-${theme}`)?.classList.add('active');
}

/** --- BUTTON LISTENERS --- **/

document.getElementById('runBtn').onclick = async () => {
    if (state.abortController) state.abortController.abort();
    state.abortController = new AbortController();
    const current = state.getActiveEntity();
    if(current) current.xml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace));
    
    [...state.entities, state.stageEntity].forEach(entity => {
        const tempWs = new Blockly.Workspace();
        try {
            Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(entity.xml), tempWs);
            tempWs.getBlocksByType('event_whenflagclicked').forEach(flag => {
                const next = flag.getNextBlock();
                if(next) {
                    const code = gen.blockToCode(next);
                    const fn = new Function('state', 'self', 'moveSprite', 'sleep', 'logToConsole', `(async()=>{ try { ${code} } catch(e){ if(e.message !== 'ABORTED') console.error(e); } })()`);
                    fn(state, entity, moveSprite, sleep, logToConsole);
                }
            });
        } finally { tempWs.dispose(); }
    });
};

document.getElementById('stopBtn').onclick = () => {
    if (state.abortController) state.abortController.abort();
    state.entities.forEach(e => { e.x = state.stage.w/2; e.y = state.stage.h/2; e.direction = 90; });
    state.updateUI();
};

document.getElementById('addSpriteBtn').onclick = () => {
    const n = prompt("Sprite Name:");
    if(n) state.createSprite(n.replace(/\s+/g, '_'));
};

document.getElementById('openModBtn').onclick = () => document.getElementById('modPanel').style.display = 'flex';
document.getElementById('closeModBtn').onclick = () => document.getElementById('modPanel').style.display = 'none';
document.getElementById('loadModBtn').onclick = () => {
    try { eval(document.getElementById('modInput').value); logToConsole("Kernel: Patch applied."); } 
    catch(e) { logToConsole("Error: " + e.message); }
};

window.onload = () => { state.init(); Blockly.svgResize(workspace); };
window.addEventListener('resize', () => Blockly.svgResize(workspace));
