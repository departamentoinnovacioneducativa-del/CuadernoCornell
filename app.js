// Inicializar el almacenamiento local y recuperar el color guardado
let notas = JSON.parse(localStorage.getItem('cornell_notes')) || [];
let notaActualId = null;
let colorTema = localStorage.getItem('cornell_theme_color') || '#2c3e50';

// Referencias al DOM
const els = {
    list: document.getElementById('notesList'),
    title: document.getElementById('noteTitle'),
    subject: document.getElementById('noteSubject'),
    date: document.getElementById('noteDate'),
    cues: document.getElementById('cues'),
    notes: document.getElementById('notes'),
    summary: document.getElementById('summary'),
    sidebar: document.getElementById('sidebar'),
    colorPicker: document.getElementById('colorPicker'),
    pdfArea: document.getElementById('pdfArea'),
    toast: document.getElementById('toast')
};

// Aplicar el color guardado al iniciar la app
aplicarColor(colorTema);
els.colorPicker.value = colorTema;

// --- Registro del Service Worker (Para funcionar Offline PWA) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado correctamente'))
            .catch(err => console.error('Error al registrar Service Worker', err));
    });
}

// --- Event Listeners ---
document.getElementById('btnNuevaNota').addEventListener('click', nuevaNota);
document.getElementById('btnGuardar').addEventListener('click', guardarManual);
document.getElementById('btnExportar').addEventListener('click', exportarPDF);
els.colorPicker.addEventListener('input', (e) => aplicarColor(e.target.value));

// Menú Hamburguesa para móviles
document.getElementById('btnToggleMenu').addEventListener('click', () => {
    els.sidebar.classList.toggle('open');
});

// Autoguardado silencioso al escribir
['title', 'subject', 'date', 'cues', 'notes', 'summary'].forEach(id => {
    els[id].addEventListener('input', guardarActual);
});

// --- Funciones Principales ---

function aplicarColor(color) {
    // Cambia la variable CSS global y actualiza el color del tema móvil
    document.documentElement.style.setProperty('--primary', color);
    document.getElementById('metaThemeColor').setAttribute('content', color);
    localStorage.setItem('cornell_theme_color', color);
}

function renderLista() {
    els.list.innerHTML = '';
    notas.forEach(n => {
        const li = document.createElement('li');
        li.className = `note-item ${n.id === notaActualId ? 'active' : ''}`;
        li.innerHTML = `
            <span onclick="cargarNota(${n.id})">${n.title || 'Apunte sin título'}</span>
            <button class="delete-btn" onclick="eliminarNota(event, ${n.id})" title="Borrar apunte">🗑️</button>
        `;
        els.list.appendChild(li);
    });
}

function nuevaNota() {
    const nueva = {
        id: Date.now(),
        title: '',
        subject: '',
        date: new Date().toISOString().split('T')[0],
        cues: '',
        notes: '',
        summary: ''
    };
    notas.push(nueva);
    cargarNota(nueva.id);
    guardarStorage();
    
    if(window.innerWidth <= 768) els.sidebar.classList.remove('open');
}

window.cargarNota = function(id) {
    notaActualId = id;
    const n = notas.find(item => item.id === id);
    if (n) {
        els.title.value = n.title;
        els.subject.value = n.subject;
        els.date.value = n.date;
        els.cues.value = n.cues;
        els.notes.value = n.notes;
        els.summary.value = n.summary;
    }
    renderLista();
    
    if(window.innerWidth <= 768) els.sidebar.classList.remove('open');
}

function guardarActual() {
    if (!notaActualId && notas.length > 0) notaActualId = notas[0].id;
    if (!notaActualId) { nuevaNota(); return; }

    const n = notas.find(item => item.id === notaActualId);
    if (n) {
        n.title = els.title.value;
        n.subject = els.subject.value;
        n.date = els.date.value;
        n.cues = els.cues.value;
        n.notes = els.notes.value;
        n.summary = els.summary.value;
        guardarStorage();
        renderLista();
    }
}

function guardarManual() {
    guardarActual();
    mostrarToast();
}

function mostrarToast() {
    els.toast.classList.add('show');
    setTimeout(() => els.toast.classList.remove('show'), 2500); // Se oculta tras 2.5s
}

window.eliminarNota = function(e, id) {
    e.stopPropagation(); 
    if(!confirm("¿Estás seguro de que deseas eliminar este apunte?")) return;
    
    notas = notas.filter(item => item.id !== id);
    guardarStorage();
    
    if (notaActualId === id) {
        if (notas.length > 0) cargarNota(notas[0].id);
        else { notaActualId = null; limpiarCampos(); }
    }
    renderLista();
}

function limpiarCampos() {
    ['title', 'subject', 'date', 'cues', 'notes', 'summary'].forEach(id => {
        els[id].value = '';
    });
}

function guardarStorage() {
    localStorage.setItem('cornell_notes', JSON.stringify(notas));
}

// --- Generación de PDF Real con html2pdf.js ---
function exportarPDF() {
    const elemento = els.pdfArea;
    const nombreArchivo = els.title.value ? `${els.title.value}.pdf` : 'Apunte_Cornell.pdf';
    
    // 1. Expandir los textareas para que no se corte el texto oculto
    const textareas = elemento.querySelectorAll('textarea');
    textareas.forEach(ta => {
        ta.style.height = 'auto';
        ta.style.height = (ta.scrollHeight + 5) + 'px';
    });

    // 2. Aplicar clase que quita bordes de inputs para una vista limpia
    elemento.classList.add('pdf-mode');

    // 3. Configuración del documento PDF
    const opt = {
        margin:       10,
        filename:     nombreArchivo,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // 4. Generar y descargar
    html2pdf().set(opt).from(elemento).save().then(() => {
        // 5. Restaurar la vista normal al terminar
        elemento.classList.remove('pdf-mode');
        textareas.forEach(ta => ta.style.height = ''); // Devolver textareas a la normalidad
    });
}

// --- Inicio de la Aplicación ---
if (notas.length > 0) {
    cargarNota(notas[0].id);
} else {
    nuevaNota();
}
