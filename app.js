"use strict";
/* ============================================================
   CUADERNO CORNELL v2
   Mismas claves de almacenamiento que la v1 (cornell_notes,
   cornell_theme_color, cornell_bg_color, cornell_user_name):
   quien actualiza conserva todos sus apuntes.
   ============================================================ */
let notas = [];
try { notas = JSON.parse(localStorage.getItem('cornell_notes')) || []; } catch (e) { notas = []; }
notas.forEach(n => { if (!n.updatedAt) n.updatedAt = n.id || Date.now(); });

let notaActualId = null;
let colorTema = localStorage.getItem('cornell_theme_color') || '#2c3e50';
let colorFondo = localStorage.getItem('cornell_bg_color') || '#f8f9fa';
let userName = localStorage.getItem('cornell_user_name') || '';
let filtroBusqueda = '';

const $ = id => document.getElementById(id);
const els = {
    list: $('notesList'), title: $('noteTitle'), subject: $('noteSubject'), date: $('noteDate'),
    cues: $('cues'), notes: $('notes'), summary: $('summary'), sidebar: $('sidebar'),
    colorPicker: $('colorPicker'), bgColorPicker: $('bgColorPicker'), pdfArea: $('pdfArea'),
    toast: $('toast'), btnInstalar: $('btnInstalar'), userNameDisplay: $('userNameDisplay'),
    search: $('searchInput'), saveStatus: $('saveStatus'), stats: $('statsBar'),
    nameModal: $('nameModal'), nameInput: $('nameInput'), helpModal: $('helpModal'),
    importFile: $('importFile')
};
const CAMPOS = ['title', 'subject', 'date', 'cues', 'notes', 'summary'];

/* ---------- Utilidades ---------- */
function fechaLocalISO(d) {
    const x = d || new Date();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const dd = String(x.getDate()).padStart(2, '0');
    return `${x.getFullYear()}-${m}-${dd}`;
}
function contarPalabras(t) { const m = (t || '').trim().match(/\S+/g); return m ? m.length : 0; }
function nombreArchivoSeguro(t) {
    return (t || 'Apunte_Cornell').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 80) || 'Apunte_Cornell';
}
function debounce(fn, ms) { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; }

/* ---------- Nombre del estudiante (modal, sin prompt) ---------- */
function verificarNombre() {
    if (!userName) { abrirNombre(true); }
    else { els.userNameDisplay.textContent = userName; }
}
function abrirNombre(primeraVez) {
    els.nameInput.value = userName || '';
    els.nameModal.classList.add('open');
    if (!primeraVez) setTimeout(() => els.nameInput.focus(), 50);
}
function guardarNombre() {
    const v = els.nameInput.value.trim();
    userName = v || 'Estudiante (clic para editar)';
    localStorage.setItem('cornell_user_name', userName);
    els.userNameDisplay.textContent = userName;
    els.nameModal.classList.remove('open');
}
els.userNameDisplay.addEventListener('click', () => abrirNombre(false));
$('btnGuardarNombre').addEventListener('click', guardarNombre);
els.nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') guardarNombre(); });

/* ---------- Ayuda: Método Cornell ---------- */
$('btnAyuda').addEventListener('click', () => els.helpModal.classList.add('open'));
$('btnCerrarAyuda').addEventListener('click', () => els.helpModal.classList.remove('open'));
[els.nameModal, els.helpModal].forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); }));

/* ---------- Instalación PWA ---------- */
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); deferredPrompt = e; els.btnInstalar.style.display = 'inline-block';
});
els.btnInstalar.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') els.btnInstalar.style.display = 'none';
        deferredPrompt = null;
    }
});

/* ---------- Service worker (sin recargas forzadas) ---------- */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => reg.update()).catch(() => {});
    });
}

/* ---------- Tema ---------- */
function aplicarColor(color) {
    document.documentElement.style.setProperty('--primary', color);
    $('metaThemeColor').setAttribute('content', color);
    localStorage.setItem('cornell_theme_color', color);
    els.colorPicker.value = color;
}
function aplicarFondo(color) {
    document.documentElement.style.setProperty('--bg', color);
    localStorage.setItem('cornell_bg_color', color);
}
els.colorPicker.addEventListener('input', e => aplicarColor(e.target.value));
els.bgColorPicker.addEventListener('input', e => aplicarFondo(e.target.value));
document.querySelectorAll('.preset').forEach(b => b.addEventListener('click', () => aplicarColor(b.dataset.color)));

/* ---------- Lista de notas (render seguro, sin innerHTML con datos) ---------- */
function notasOrdenadas() {
    return [...notas].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}
function coincide(n, q) {
    if (!q) return true;
    const t = `${n.title || ''} ${n.subject || ''} ${n.cues || ''} ${n.notes || ''} ${n.summary || ''}`.toLowerCase();
    return t.includes(q);
}
function renderLista() {
    els.list.innerHTML = '';
    const visibles = notasOrdenadas().filter(n => coincide(n, filtroBusqueda));
    if (visibles.length === 0) {
        const li = document.createElement('li');
        li.className = 'empty-list';
        li.textContent = filtroBusqueda ? 'Sin resultados para tu búsqueda.' : 'Aún no tienes apuntes. Toca «+ Nuevo».';
        els.list.appendChild(li);
        return;
    }
    visibles.forEach(n => {
        const li = document.createElement('li');
        li.className = 'note-item' + (n.id === notaActualId ? ' active' : '');

        const main = document.createElement('div');
        main.className = 'note-main';
        const tit = document.createElement('span');
        tit.className = 'note-title';
        tit.textContent = n.title || 'Apunte sin título';
        const meta = document.createElement('span');
        meta.className = 'note-meta';
        meta.textContent = [n.subject, n.date].filter(Boolean).join(' · ') || 'Sin materia ni fecha';
        main.append(tit, meta);
        main.addEventListener('click', () => cargarNota(n.id));

        const acts = document.createElement('div');
        acts.className = 'note-actions';
        const dup = document.createElement('button');
        dup.className = 'icon-btn'; dup.textContent = '⧉'; dup.title = 'Duplicar apunte';
        dup.setAttribute('aria-label', 'Duplicar apunte');
        dup.addEventListener('click', e => { e.stopPropagation(); duplicarNota(n.id); });
        const del = document.createElement('button');
        del.className = 'icon-btn delete-btn'; del.textContent = '🗑️'; del.title = 'Borrar apunte';
        del.setAttribute('aria-label', 'Borrar apunte');
        del.addEventListener('click', e => { e.stopPropagation(); eliminarNota(n.id); });
        acts.append(dup, del);

        li.append(main, acts);
        els.list.appendChild(li);
    });
}

/* ---------- CRUD ---------- */
function nuevaNota() {
    const nueva = {
        id: Date.now(), title: '', subject: '', date: fechaLocalISO(),
        cues: '', notes: '', summary: '', updatedAt: Date.now()
    };
    notas.push(nueva);
    guardarStorage();
    cargarNota(nueva.id);
    if (window.innerWidth <= 768) els.sidebar.classList.remove('open');
    els.title.focus();
}
function cargarNota(id) {
    notaActualId = id;
    const n = notas.find(item => item.id === id);
    if (n) {
        els.title.value = n.title || ''; els.subject.value = n.subject || ''; els.date.value = n.date || '';
        els.cues.value = n.cues || ''; els.notes.value = n.notes || ''; els.summary.value = n.summary || '';
    }
    renderLista();
    actualizarStats();
    if (window.innerWidth <= 768) els.sidebar.classList.remove('open');
}
function duplicarNota(id) {
    const n = notas.find(item => item.id === id);
    if (!n) return;
    const copia = { ...n, id: Date.now(), title: (n.title || 'Apunte sin título') + ' (copia)', updatedAt: Date.now() };
    notas.push(copia);
    guardarStorage();
    cargarNota(copia.id);
    mostrarToast('Apunte duplicado ⧉');
}
function eliminarNota(id) {
    if (!confirm('¿Borrar este apunte?')) return;
    notas = notas.filter(item => item.id !== id);
    guardarStorage();
    if (notaActualId === id) {
        if (notas.length > 0) cargarNota(notasOrdenadas()[0].id);
        else { notaActualId = null; limpiarCampos(); renderLista(); actualizarStats(); }
    } else renderLista();
}
function limpiarCampos() { CAMPOS.forEach(id => { els[id].value = ''; }); }

function guardarActual() {
    if (!notaActualId) { if (notas.length > 0) { notaActualId = notasOrdenadas()[0].id; } else { nuevaNota(); return; } }
    const n = notas.find(item => item.id === notaActualId);
    if (!n) return;
    n.title = els.title.value; n.subject = els.subject.value; n.date = els.date.value;
    n.cues = els.cues.value; n.notes = els.notes.value; n.summary = els.summary.value;
    n.updatedAt = Date.now();
    guardarStorage();
    const h = new Date();
    els.saveStatus.textContent = `Guardado ✓ ${String(h.getHours()).padStart(2, '0')}:${String(h.getMinutes()).padStart(2, '0')}`;
}
function guardarStorage() { localStorage.setItem('cornell_notes', JSON.stringify(notas)); }
function guardarManual() { guardarActual(); renderLista(); mostrarToast(); }
function mostrarToast(msg) {
    els.toast.textContent = msg || 'Guardado correctamente';
    els.toast.classList.add('show');
    setTimeout(() => els.toast.classList.remove('show'), 2500);
}

/* ---------- Estadísticas de la hoja ---------- */
function actualizarStats() {
    const c = contarPalabras(els.cues.value), n = contarPalabras(els.notes.value), s = contarPalabras(els.summary.value);
    const partes = [c >= 3, n >= 10, s >= 5];
    const pct = Math.round(partes.filter(Boolean).length / 3 * 100);
    els.stats.innerHTML = '';
    const txt = document.createElement('span');
    txt.textContent = `❓ Claves: ${c} palabras · 📝 Notas: ${n} · 🧾 Resumen: ${s} · Hoja al ${pct}%`;
    const meter = document.createElement('div'); meter.className = 'meter';
    const fill = document.createElement('div'); fill.style.width = pct + '%';
    meter.appendChild(fill);
    els.stats.append(txt, meter);
}

/* ---------- Respaldo: exportar / importar ---------- */
function exportarRespaldo() {
    const data = { app: 'cuaderno-cornell', version: 2, exportedAt: new Date().toISOString(), userName, notes: notas };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `respaldo-cornell-${fechaLocalISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    mostrarToast('Respaldo descargado ⬇️');
}
function importarRespaldo(file) {
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            const entrantes = Array.isArray(data) ? data : data.notes;
            if (!Array.isArray(entrantes)) throw new Error('formato');
            let nuevos = 0, actualizados = 0;
            entrantes.forEach(n => {
                if (!n || typeof n.id !== 'number') return;
                n.updatedAt = n.updatedAt || n.id;
                const i = notas.findIndex(x => x.id === n.id);
                if (i === -1) { notas.push(n); nuevos++; }
                else if ((n.updatedAt || 0) > (notas[i].updatedAt || 0)) { notas[i] = n; actualizados++; }
            });
            guardarStorage();
            if (notaActualId) cargarNota(notaActualId); else if (notas.length) cargarNota(notasOrdenadas()[0].id); else renderLista();
            mostrarToast(`Respaldo importado: ${nuevos} nuevos, ${actualizados} actualizados`);
        } catch (e) { alert('Ese archivo no es un respaldo válido del Cuaderno Cornell.'); }
    };
    reader.readAsText(file);
}

/* ---------- PDF e impresión ---------- */
/* El PDF se genera con jsPDF escribiendo el TEXTO (no una captura
   de pantalla): las líneas se ajustan y saltan de página, así el
   texto nunca sale cortado como pasaba con html2canvas. */
function textoParaPDF(t) {
    return (t || '').replace(/[^\x00-\xFF]/g, '').replace(/\r\n/g, '\n');
}
function envolverLinea(doc, texto, ancho) {
    const palabras = texto.split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return [''];
    const lineas = [];
    let actual = '';
    palabras.forEach(p => {
        const prueba = actual ? `${actual} ${p}` : p;
        if (doc.getTextWidth(prueba) <= ancho || !actual) actual = prueba;
        else { lineas.push(actual); actual = p; }
    });
    if (actual) lineas.push(actual);
    return lineas;
}
function lineasDe(doc, texto, ancho) {
    const out = [];
    textoParaPDF(texto).split('\n').forEach(par => {
        if (par.trim() === '') { out.push(''); return; }
        envolverLinea(doc, par, ancho).forEach(l => out.push(l));
    });
    return out;
}
function buildCornellPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const M = 12, ANCHO = 210 - M * 2, LIMITE = 297 - 14, SALTO = 5;
    const X_CUES = M, W_CUES = 55, X_NOTES = M + W_CUES + 6, W_NOTES = ANCHO - W_CUES - 6;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text(textoParaPDF(els.title.value) || 'Apunte Cornell', M, 16);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Estudiante: ${textoParaPDF(userName)}`, M, 23);
    doc.text(`Materia: ${textoParaPDF(els.subject.value) || '—'}`, M, 29);
    doc.text(`Fecha: ${els.date.value || '—'}`, 150, 29);
    doc.setDrawColor(120); doc.setLineWidth(0.4); doc.line(M, 32, M + ANCHO, 32);

    const cabeceraColumnas = y => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text('PALABRAS CLAVE / PREGUNTAS', X_CUES, y);
        doc.text('NOTAS DE CLASE', X_NOTES, y);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
        return y + 6;
    };
    let yTop = cabeceraColumnas(39);
    let yC = yTop, yN = yTop;
    const cues = lineasDe(doc, els.cues.value, W_CUES - 2);
    const notes = lineasDe(doc, els.notes.value, W_NOTES - 2);
    const total = Math.max(cues.length, notes.length);
    let divisorDesde = yTop - 9;
    const trazarDivisor = hasta => doc.line(X_CUES + W_CUES + 3, divisorDesde, X_CUES + W_CUES + 3, hasta);
    for (let i = 0; i < total; i++) {
        const necesitaC = i < cues.length, necesitaN = i < notes.length;
        if ((necesitaC && yC > LIMITE) || (necesitaN && yN > LIMITE)) {
            trazarDivisor(Math.max(yC, yN));
            doc.addPage();
            yTop = cabeceraColumnas(16); yC = yTop; yN = yTop; divisorDesde = yTop - 9;
        }
        if (necesitaC) { doc.text(cues[i], X_CUES, yC); yC += SALTO; }
        if (necesitaN) { doc.text(notes[i], X_NOTES, yN); yN += SALTO; }
    }
    trazarDivisor(Math.max(yC, yN));

    let yS = Math.max(yC, yN) + 6;
    if (yS > LIMITE - 20) { doc.addPage(); yS = 18; }
    doc.setLineWidth(0.4); doc.line(M, yS - 6, M + ANCHO, yS - 6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('RESUMEN / SÍNTESIS', M, yS);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    yS += 6;
    lineasDe(doc, els.summary.value, ANCHO - 2).forEach(l => {
        if (yS > LIMITE) { doc.addPage(); yS = 16; }
        doc.text(l, M, yS); yS += SALTO;
    });

    const paginas = doc.getNumberOfPages();
    for (let p = 1; p <= paginas; p++) {
        doc.setPage(p);
        doc.setFontSize(8); doc.setTextColor(140);
        doc.text(`Cuaderno Cornell · ${textoParaPDF(els.title.value) || 'Apunte'} · Página ${p} de ${paginas}`, M, 292);
        doc.setTextColor(0);
    }
    return doc;
}
function exportarPDF() {
    if (window.jspdf && window.jspdf.jsPDF) {
        try { buildCornellPDF().save(`${nombreArchivoSeguro(els.title.value)}.pdf`); return; }
        catch (e) { /* si algo falla, se ofrece la impresión */ }
    }
    window.print();
}
function expandirTextareas() {
    const tas = els.pdfArea.querySelectorAll('textarea');
    tas.forEach(ta => { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 5) + 'px'; });
    return tas;
}
window.addEventListener('beforeprint', expandirTextareas);
window.addEventListener('afterprint', () => {
    els.pdfArea.querySelectorAll('textarea').forEach(ta => { ta.style.height = ''; });
});

/* ---------- Eventos ---------- */
$('btnNuevaNota').addEventListener('click', nuevaNota);
$('btnGuardar').addEventListener('click', guardarManual);
$('btnExportar').addEventListener('click', exportarPDF);
$('btnImprimir').addEventListener('click', () => window.print());
$('btnRespaldo').addEventListener('click', exportarRespaldo);
$('btnImportar').addEventListener('click', () => els.importFile.click());
els.importFile.addEventListener('change', () => {
    if (els.importFile.files[0]) importarRespaldo(els.importFile.files[0]);
    els.importFile.value = '';
});
$('btnToggleMenu').addEventListener('click', () => els.sidebar.classList.toggle('open'));
els.search.addEventListener('input', () => { filtroBusqueda = els.search.value.trim().toLowerCase(); renderLista(); });

const autosave = debounce(() => { guardarActual(); renderLista(); }, 600);
CAMPOS.forEach(id => els[id].addEventListener('input', () => { autosave(); actualizarStats(); }));

document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); guardarManual(); }
});

/* ---------- Inicio ---------- */
aplicarColor(colorTema);
aplicarFondo(colorFondo);
els.bgColorPicker.value = colorFondo;
verificarNombre();
if (notas.length > 0) cargarNota(notasOrdenadas()[0].id); else nuevaNota();
