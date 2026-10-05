// Inicializar el almacenamiento local y recuperar configuraciones
let notas = JSON.parse(localStorage.getItem('cornell_notes')) || [];
let notaActualId = null;
let colorTema = localStorage.getItem('cornell_theme_color') || '#2c3e50';
let colorFondo = localStorage.getItem('cornell_bg_color') || '#f8f9fa';
let userName = localStorage.getItem('cornell_user_name') || '';

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
    bgColorPicker: document.getElementById('bgColorPicker'),
    pdfArea: document.getElementById('pdfArea'),
    toast: document.getElementById('toast'),
    btnInstalar: document.getElementById('btnInstalar'),
    userNameDisplay: document.getElementById('userNameDisplay')
};

// --- Lógica del Nombre de Usuario ---
function verificarNombre() {
    if (!userName) {
        pedirNombre();
    } else {
        els.userNameDisplay.textContent = userName;
    }
}

function pedirNombre() {
    let ingresado = prompt("¡Bienvenido a Cuaderno Cornel. CC!\nPor favor, ingresa tu nombre completo para personalizar tus apuntes:");
    if (!ingresado || ingresado.trim() === "") {
        ingresado = "Estudiante (Clic para editar)";
    }
    userName = ingresado.trim();
    localStorage.setItem('cornell_user_name', userName);
    els.userNameDisplay.textContent = userName;
}

// Inicializar datos en la vista
aplicarColor(colorTema);
aplicarFondo(colorFondo);
els.colorPicker.value = colorTema;
els.bgColorPicker.value = colorFondo;
verificarNombre();

els.userNameDisplay.addEventListener('click', pedirNombre); // Permite editar el nombre con un clic

// --- Lógica del Botón de Instalación (PWA) ---
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    els.btnInstalar.style.display = 'inline-block'; 
});

els.btnInstalar.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') els.btnInstalar.style.display = 'none'; 
        deferredPrompt = null;
    }
});

// --- Registro y Control de Versiones (PWA) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                console.log('SW registrado');
                reg.update(); // Busca actualizaciones agresivamente
            })
            .catch(err => console.error('Error SW', err));
        
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload(); // Recarga si hay una versión nueva
            }
        });
    });
}

// --- Event Listeners ---
document.getElementById('btnNuevaNota').addEventListener('click', nuevaNota);
document.getElementById('btnGuardar').addEventListener('click', guardarManual);
document.getElementById('btnExportar').addEventListener('click', exportarPDF);
els.colorPicker.addEventListener('input', (e) => aplicarColor(e.target.value));
els.bgColorPicker.addEventListener('input', (e) => aplicarFondo(e.target.value));
document.getElementById('btnToggleMenu').addEventListener('click', () => els.sidebar.classList.toggle('open'));

['title', 'subject', 'date', 'cues', 'notes', 'summary'].forEach(id => {
    els[id].addEventListener('input', guardarActual);
});

// --- Funciones Principales ---
function aplicarColor(color) {
    document.documentElement.style.setProperty('--primary', color);
    document.getElementById('metaThemeColor').setAttribute('content', color);
    localStorage.setItem('cornell_theme_color', color);
}

function aplicarFondo(color) {
    document.documentElement.style.setProperty('--bg', color);
    localStorage.setItem('cornell_bg_color', color);
}

function renderLista() {
    els.list.innerHTML = '';
    notas.forEach(n => {
        const li = document.createElement('li');
        li.className = `note-item ${n.id === notaActualId ? 'active' : ''}`;
        li.innerHTML = `<span onclick="cargarNota(${n.id})">${n.title || 'Apunte sin título'}</span>
                        <button class="delete-btn" onclick="eliminarNota(event, ${n.id})" title="Borrar">🗑️</button>`;
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
        els.title.value = n.title; els.subject.value = n.subject; els.date.value = n.date;
        els.cues.value = n.cues; els.notes.value = n.notes; els.summary.value = n.summary;
    }
    renderLista();
    if(window.innerWidth <= 768) els.sidebar.classList.remove('open');
}

function guardarActual() {
    if (!notaActualId && notas.length > 0) notaActualId = notas[0].id;
    if (!notaActualId) { nuevaNota(); return; }
    const n = notas.find(item => item.id === notaActualId);
    if (n) {
        n.title = els.title.value; n.subject = els.subject.value; n.date = els.date.value;
        n.cues = els.cues.value; n.notes = els.notes.value; n.summary = els.summary.value;
        guardarStorage(); renderLista();
    }
}

function guardarManual() { guardarActual(); mostrarToast(); }

function mostrarToast() {
    els.toast.classList.add('show');
    setTimeout(() => els.toast.classList.remove('show'), 2500);
}

window.eliminarNota = function(e, id) {
    e.stopPropagation(); 
    if(!confirm("¿Borrar este apunte?")) return;
    notas = notas.filter(item => item.id !== id);
    guardarStorage();
    if (notaActualId === id) {
        if (notas.length > 0) cargarNota(notas[0].id);
        else { notaActualId = null; limpiarCampos(); }
    }
    renderLista();
}

function limpiarCampos() { 
    ['title', 'subject', 'date', 'cues', 'notes', 'summary'].forEach(id => els[id].value = ''); 
}

function guardarStorage() { 
    localStorage.setItem('cornell_notes', JSON.stringify(notas)); 
}

function exportarPDF() {
    const elemento = els.pdfArea;
    const nombreArchivo = els.title.value ? `${els.title.value}.pdf` : 'Apunte_Cornell.pdf';
    
    const textareas = elemento.querySelectorAll('textarea');
    textareas.forEach(ta => {
        ta.style.height = 'auto';
        ta.style.height = (ta.scrollHeight + 5) + 'px';
    });

    elemento.classList.add('pdf-mode');

    const opt = {
        margin: 10, filename: nombreArchivo, image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(elemento).save().then(() => {
        elemento.classList.remove('pdf-mode');
        textareas.forEach(ta => ta.style.height = '');
    });
}

// Iniciar
if (notas.length > 0) cargarNota(notas[0].id); else nuevaNota();
