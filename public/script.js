// script.js

// **Requerimientos Externos:**
// Asegúrate de incluir las siguientes librerías en tu archivo HTML antes de este script:
// 1. Dexie.js para manejar IndexedDB
// 2. imageCompression.js para comprimir imágenes
// 3. Papa Parse para parsear archivos CSV/TXT

// Ejemplo de inclusión en HTML:
// <script src="https://unpkg.com/dexie@3.2.2/dist/dexie.js"></script>
// <script src="https://unpkg.com/browser-image-compression@1.0.15/dist/browser-image-compression.js"></script>
// <script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.2/papaparse.min.js"></script>
// <script src="script.js"></script>

// **1. Declaración de Variables Globales**
let clients = [];
let foundClients = [];
let currentDuplicateIndex = 0;
let currentFilePath = localStorage.getItem('lastUsedFilePath') || "clientes.json";
let fileLastModified = null;

// **2. Inicialización de IndexedDB con Dexie**
const db = new Dexie('ClientDatabase');

// Versión 1 del esquema
db.version(1).stores({
    clients: '++id, &identificacionCliente, photo'
});

// Versión 2 del esquema (eliminando la restricción de unicidad)
db.version(2).stores({
    clients: '++id, identificacionCliente, photo'
}).upgrade(function (trans) {
    console.log('Actualizando la base de datos a la versión 2');
    // No es necesario realizar modificaciones en los datos existentes
});

// Manejo del evento 'blocked'
db.on('blocked', function() {
    alert('Por favor, cierra todas las demás pestañas que tengan abierta esta aplicación.');
});

// Abrir la base de datos y manejar errores
db.open().catch(function (error) {
    console.error('Error al abrir la base de datos:', error);
});


// **3. Mapeo de Encabezados a Nombres de Campo**
const headerToFieldName = {
    "NOMBRE CLIENTE": "nombreCliente",
    "OPERACIÓN": "operacion",
    "PRODUCTO": "producto",
    "TELEFONO DEL CLIENTE": "telefonoCliente",
    "DIRECCION DE LA VISITA": "direccionVisita",
    "TIPO DE DIRECCIÓN DE VISITA": "tipoDireccionVisita",
    "FECHA Y HORA DE VISITA": "fechaHoraVisita",
    "NOMBRE DEL GESTOR": "nombreGestor",
    "LATITUD": "latitud",
    "LONGITUD": "longitud",
    "RIESGO": "riesgo",
    "EXIGIBLE": "exigible",
    "DIAS MORA": "diasMora",
    "TIPO DE CONTACTO": "tipoContacto",
    "RESPUESTA DE CONTACTO": "respuestaContacto",
    "MOTIVO DE NO PAGO": "motivoNoPago",
    "OBSERVACIÓN": "observacion",
    "FECHA COMPROMISO/PAGO": "fechaCompromisoPago",
    "VALOR": "valor",
    "URL WEB": "urlWeb",
    "fechaGestionSistemaGestion": "fechaGestionSistemaGestion",
    "identificacionCliente": "identificacionCliente",
    "Agendamiento": "agendamiento",
    "Resumen": "resumen",
    "TELÉFONO NUEVO": "telefonoNuevo"
};

// **Funciones Utilitarias Comunes**
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case "'": return '&#39;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

function formatDate(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toISOString().slice(0, 16);
}

// **4. Función para Comprimir Imagen**
async function compressImage(imageFile) {
    const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true
    };
    try {
        const compressedFile = await imageCompression(imageFile, options);
        return compressedFile;
    } catch (error) {
        console.error("Error al comprimir la imagen:", error);
        return null;
    }
}

// **5. Función para Manejar la Carga de Fotos**
async function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith("image/")) {
        try {
            const compressedFile = await compressImage(file);
            if (!compressedFile) {
                alert("Error al comprimir la imagen. Por favor, inténtalo de nuevo.");
                return;
            }

            const reader = new FileReader();
            reader.onload = async function (e) {
                const base64Image = e.target.result;
                if (foundClients.length > 0) {
                    foundClients[currentDuplicateIndex].photo = base64Image;
                    updatePhotoPreview(foundClients[currentDuplicateIndex]);
                    await saveClientToIndexedDB(foundClients[currentDuplicateIndex]);
                } else {
                    alert("No hay cliente seleccionado para agregar la foto.");
                }
            };
            reader.onerror = function () {
                alert("Error al cargar la imagen. Por favor, inténtalo de nuevo.");
            };
            reader.readAsDataURL(compressedFile);
        } catch (error) {
            alert("Error al procesar la imagen. Por favor, inténtalo de nuevo.");
        }
    } else {
        alert("Selecciona un archivo de imagen válido.");
    }
}

// **6. Función para Guardar Cliente en IndexedDB**
async function saveClientToIndexedDB(client) {
    try {
        await db.clients.put(client);
        console.log("Cliente guardado en IndexedDB");
    } catch (error) {
        console.error("Error al guardar en IndexedDB:", error);
    }
}

// **7. Función para Cargar Clientes desde IndexedDB**
async function loadClientsFromIndexedDB() {
    try {
        if (!db.isOpen()) {
            await db.open();
        }
        clients = await db.clients.toArray();
        console.log("Clientes cargados desde IndexedDB:", clients.length);
    } catch (error) {
        console.error("Error al cargar desde IndexedDB:", error);
    }
}


// **8. Función para Aceptar la Versión JSON**
async function acceptJsonVersion() {
    const file = document.getElementById("jsonFile").files[0];
    if (!file) {
        alert("Por favor, seleccione un archivo JSON primero.");
        return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = JSON.parse(e.target.result);

            clients = data.map(client => {
                delete client.id;
                return client;
            });

            if (clients.length > 0) {
                document.getElementById("searchContainer").style.display = "flex";
                console.log("Clientes cargados desde JSON:", clients.length);
                updateFilePathDisplay();
                document.getElementById("fileInfoContainer").style.display = "none";
                document.getElementById("acceptJsonButton").style.display = "none";
                localStorage.setItem('lastUsedFilePath', currentFilePath);

                await db.clients.clear();
                await db.clients.bulkPut(clients);
                console.log("Clientes guardados en IndexedDB");
            } else {
                alert("El archivo JSON no contiene datos de clientes.");
            }
        } catch (error) {
            alert("Error al cargar el archivo JSON. Por favor, verifica el formato.");
        }
    };
    reader.onerror = function () {
        alert("Error al leer el archivo. Por favor, inténtalo de nuevo.");
    };
    reader.readAsText(file);
}

// **9. Función para Buscar Cliente**
async function searchClient() {
    const searchInputElement = document.getElementById("searchInput");
    const searchTermRaw = searchInputElement.value.trim();
    const searchTerm = searchTermRaw.toLowerCase();
    console.log("Buscando cliente con identificación:", searchTerm);

    if (!isValidClientId(searchTerm)) {
        alert("Por favor, introduce la identificación del cliente.");
        return;
    }

    try {
        foundClients = await db.clients
            .where('identificacionCliente')
            .equalsIgnoreCase(searchTerm)
            .toArray();

        if (foundClients.length > 0) {
            currentDuplicateIndex = 0;
            showClient(foundClients[currentDuplicateIndex]);
            if (foundClients.length > 1) {
                alert(`Se encontraron ${foundClients.length} registros para este cliente. Usa los botones de navegación para recorrerlos.`);
            }
        } else {
            alert("No se encontró cliente con esa identificación.");
        }
    } catch (error) {
        alert("Hubo un error al buscar el cliente. Por favor, inténtalo de nuevo.");
    }
    updateNavigationButtons();
}

// **10. Función para Mostrar Cliente**
async function showClient(client) {
    if (!client) {
        console.error("No se encontró cliente para mostrar.");
        return;
    }

    cleanupPhotoPreview();

    document.getElementById("clientForm").style.display = "grid";

    Object.keys(client).forEach(key => {
        const element = document.getElementById(key);
        if (element) {
            if (element.type === "date" || element.type === "datetime-local") {
                element.value = formatDate(client[key]);
            } else if (key === "photo" || key === "urlWeb") {
                // La vista previa se actualiza más abajo
            } else {
                element.value = client[key] || "";
            }
        }
    });

    updatePhotoPreview(client); // Pasar el objeto cliente completo

    updateNavigationButtons();
}

// **11. Función para Limpiar la Vista Previa de la Foto**
function cleanupPhotoPreview() {
    const photoPreview = document.getElementById("photo");
    if (photoPreview && photoPreview.src.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview.src);
        photoPreview.src = '';
    }
}

// **12. Función para Actualizar la Vista Previa de la Foto**
function updatePhotoPreview(client) {
    const photoPreview = document.getElementById("photo");

    if (!photoPreview) {
        console.error("Error: No se encontró el elemento con id 'photo'");
        return;
    }

    cleanupPhotoPreview();

    if (client.photo) {
        try {
            photoPreview.src = client.photo;
            photoPreview.style.display = "block";
            photoPreview.alt = "Foto del cliente";
            photoPreview.classList.remove('hidden');
        } catch (error) {
            console.error("Error al cargar la imagen del cliente:", error);
            photoPreview.src = "https://via.placeholder.com/150?text=Error+de+imagen";
            photoPreview.style.display = "block";
            photoPreview.alt = "Error al cargar la imagen";
            photoPreview.classList.remove('hidden');
        }
    } else if (client.urlWeb) {
        const urlWeb = client.urlWeb.trim();
        console.log("Intentando cargar la imagen desde URL WEB:", urlWeb);

        if (isValidUrl(urlWeb)) {
            photoPreview.src = urlWeb;
            photoPreview.style.display = "block";
            photoPreview.alt = "Foto del cliente desde URL WEB";
            photoPreview.classList.remove('hidden');
        } else {
            console.warn("URL WEB no es una URL válida:", urlWeb);
            photoPreview.src = "https://via.placeholder.com/150?text=URL+no+válida";
            photoPreview.style.display = "block";
            photoPreview.alt = "URL WEB no válida";
            photoPreview.classList.remove('hidden');
        }
    } else {
        photoPreview.src = "https://via.placeholder.com/150?text=Sin+imagen";
        photoPreview.style.display = "block";
        photoPreview.alt = "No hay imagen disponible";
        photoPreview.classList.remove('hidden');
    }
}

// Función para validar si una cadena es una URL válida
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;  
    }
}

// **13. Función para Guardar Información Adicional**
async function saveAdditionalInfo(event) {
    if (foundClients.length > 0) {
        foundClients[currentDuplicateIndex].additionalInfo = event.target.value;
        await saveClientToIndexedDB(foundClients[currentDuplicateIndex]);
    } else {
        alert("No hay cliente seleccionado para guardar información adicional.");
    }
}

// **14. Funciones para Navegar entre Duplicados**
function showPreviousDuplicate() {
    if (currentDuplicateIndex > 0) {
        currentDuplicateIndex--;
        showClient(foundClients[currentDuplicateIndex]);
    }
}

function showNextDuplicate() {
    if (currentDuplicateIndex < foundClients.length - 1) {
        currentDuplicateIndex++;
        showClient(foundClients[currentDuplicateIndex]);
    }
}

function updateNavigationButtons() {
    const prevButton = document.getElementById("prevClient");
    const nextButton = document.getElementById("nextClient");
    if (prevButton && nextButton) {
        prevButton.disabled = currentDuplicateIndex === 0 || foundClients.length === 0;
        nextButton.disabled = currentDuplicateIndex === foundClients.length - 1 || foundClients.length === 0;
    }
}

// **15. Función para Guardar JSON**
async function saveJSON() {
    console.log("Guardando JSON...");
    try {
        const allClients = await db.clients.toArray();
        if (allClients.length === 0) {
            alert("No hay datos de clientes para guardar. Por favor, carga algunos datos primero.");
            return;
        }

        const clientsToSave = JSON.parse(JSON.stringify(allClients));

        clientsToSave.forEach(client => {
            delete client.id;
        });

        const dataStr = JSON.stringify(clientsToSave, null, 2);
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(dataBlob);
        const a = document.createElement("a");
        a.href = url;
        const fileName = currentFilePath ? currentFilePath.split('/').pop() : 'clientes_actualizado.json';
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert("Archivo JSON actualizado y guardado con éxito.");
    } catch (error) {
        alert("Hubo un error al guardar el archivo JSON. Por favor, inténtalo de nuevo.");
    }
}

// **16. Función para Validar ID de Cliente**
function isValidClientId(id) {
    return id && id.trim().length > 0;
}

// **17. Función para Actualizar la Visualización de la Ruta del Archivo**
function updateFilePathDisplay() {
    const filePathInput = document.getElementById("filePathInput");
    if (filePathInput) {
        filePathInput.value = currentFilePath;
    }
}

// **18. Función para Manejar la Selección de Archivos JSON**
function handleJSONSelect(event) {
    console.log("Archivo JSON seleccionado...");
    const file = event.target.files[0];
    if (!file) {
        console.error("No se seleccionó ningún archivo");
        return;
    }
    currentFilePath = file.name;
    fileLastModified = new Date(file.lastModified);

    const fileInfoElement = document.getElementById("fileInfo");
    if (fileInfoElement) {
        fileInfoElement.textContent = `Archivo: ${file.name}, Última modificación: ${fileLastModified.toLocaleString()}`;
    }

    const fileInfoContainer = document.getElementById("fileInfoContainer");
    if (fileInfoContainer) {
        fileInfoContainer.classList.remove('hidden');
    }

    const acceptJsonButton = document.getElementById("acceptJsonButton");
    if (acceptJsonButton) {
        acceptJsonButton.classList.remove('hidden');
    }

    const clientForm = document.getElementById("clientForm");
    if (clientForm) {
        clientForm.classList.add('hidden');
    }

    updateFilePathDisplay();
}

// **19. Función para Manejar la Selección de Archivos CSV/TXT**
function handleFileSelect(event) {
    console.log("Cargando archivo CSV/TXT...");
    const file = event.target.files[0];
    if (!file) {
        console.error("No se seleccionó ningún archivo");
        return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        const fileExtension = file.name.split(".").pop().toLowerCase();
        if (fileExtension === "csv") {
            console.log("Procesando archivo CSV...");
            processData(text, ",");
        } else if (fileExtension === "txt") {
            console.log("Procesando archivo TXT...");
            processData(text, "|");
        } else {
            alert("Tipo de archivo no soportado. Sube un archivo CSV o TXT.");
        }
    };
    reader.onerror = function () {
        alert("Error al leer el archivo. Por favor, inténtalo de nuevo.");
    };
    reader.readAsText(file);
}

// **20. Función para Procesar Datos de CSV/TXT**
function processData(data, separator) {
    console.log("Procesando datos del archivo...");
    const parsedData = Papa.parse(data, {
        delimiter: separator,
        header: true,
        skipEmptyLines: true
    });

    if (parsedData.errors.length > 0) {
        alert("Hubo errores al procesar el archivo. Por favor, verifica el formato.");
        return;
    }

    const headers = parsedData.meta.fields;
    console.log("Encabezados del archivo:", headers);

    clients = parsedData.data.map(row => {
        const clientData = {};
        headers.forEach(header => {
            const trimmedHeader = header.trim();
            const fieldName = headerToFieldName[trimmedHeader];
            if (fieldName) {
                clientData[fieldName] = (row[header] || "").trim();
            }
        });
        clientData.additionalInfo = "";
        clientData.photo = null;
        return clientData;
    });

    if (clients.length > 0) {
        console.log("Clientes cargados:", clients.length);
        const searchContainer = document.getElementById("searchContainer");
        if (searchContainer) {
            searchContainer.classList.remove('hidden');
        }
        saveClientsToIndexedDB(clients);
    } else {
        alert("No se encontraron datos válidos en el archivo.");
    }
}

// **21. Función para Guardar Múltiples Clientes en IndexedDB**
async function saveClientsToIndexedDB(clientsArray) {
    try {
        await db.clients.clear();
        await db.clients.bulkPut(clientsArray);
        console.log("Clientes guardados en IndexedDB");
    } catch (error) {
        console.error("Error al guardar en IndexedDB:", error);
    }
}

// **22. Función para Actualizar la Ruta del Archivo**
function updateFilePath() {
    const newPath = document.getElementById("filePathInput").value;
    if (newPath && newPath !== currentFilePath) {
        currentFilePath = newPath;
        localStorage.setItem('lastUsedFilePath', currentFilePath);
        console.log("Ruta de archivo actualizada:", currentFilePath);
    }
}

// **23. Función para Generar HTML Estático Mejorado**
function generateStaticHtml() {
    console.log("Generando HTML estático para todos los clientes...");
    db.clients.toArray().then(clients => {
        if (clients.length === 0) {
            alert("No hay clientes para generar el HTML. Por favor, carga algunos datos primero.");
            return;
        }

        const staticHtmlContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Informe de Visitas Gestión Terrena</title>
                <!-- Bootstrap CSS -->
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <!-- Google Fonts -->
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
                <style>
                    body {
                        font-family: 'Roboto', sans-serif;
                        background-color: #f8f9fa;
                    }
                    .container {
                        margin-top: 20px;
                        margin-bottom: 20px;
                    }
                    .client-section {
                        margin-bottom: 40px;
                        page-break-inside: avoid;
                    }
                    .section-title {
                        font-size: 1.5rem;
                        font-weight: 700;
                        color: #343a40;
                        margin-bottom: 20px;
                        border-bottom: 2px solid #dee2e6;
                        padding-bottom: 10px;
                    }
                    .section {
                        background-color: #ffffff;
                        border: 1px solid #dee2e6;
                        border-radius: 8px;
                        padding: 20px;
                        margin-bottom: 20px;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    }
                    .field-label {
                        font-weight: 500;
                        color: #495057;
                    }
                    .field-value {
                        font-weight: 400;
                        color: #212529;
                    }
                    .photo {
                        max-width: 100%;
                        height: auto;
                        border-radius: 8px;
                        margin-top: 10px;
                    }
                    @media print {
                        body {
                            background-color: white;
                        }
                        .container {
                            margin: 0;
                            padding: 0;
                        }
                        .client-section {
                            page-break-after: always;
                        }
                        .no-print {
                            display: none;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <header class="mb-5 text-center">
                        <h1 class="display-4">Informe de Visitas Gestión Terrena</h1>
                        <p class="lead">Fecha de generación: ${new Date().toLocaleDateString('es-ES')}</p>
                    </header>
                    ${clients.map((client, index) => `
                        <section class="client-section">
                            <h2 class="section-title">Cliente #${index + 1}: ${sanitizeInput(client.nombreCliente) || 'N/A'}</h2>

                            <!-- DATOS CLIENTE -->
                            <div class="section">
                                <h3 class="h5 mb-4">Datos del Cliente</h3>
                                <div class="row">
                                    ${generateField('Nombre Cliente', client.nombreCliente)}
                                    <!-- ${generateField('Identificación', client.identificacionCliente)} -->
                                    ${generateField('Operación', client.operacion)}
                                    ${generateField('Producto', client.producto)}
                                    ${generateField('Teléfono del Cliente', client.telefonoCliente)}
                                    ${generateField('Dirección de la Visita', client.direccionVisita, true)}
                                    ${generateField('Tipo de Dirección de Visita', client.tipoDireccionVisita, true)}
                                    ${generateField('Fecha y Hora de Visita', formatDate(client.fechaHoraVisita))}
                                    ${generateField('Nombre del Gestor', client.nombreGestor)}
                                    ${generateField('Latitud', client.latitud)}
                                    ${generateField('Longitud', client.longitud)}
                                </div>
                            </div>

                            <!-- ESTADO DE VISITA -->
                            <div class="section">
                                <h3 class="h5 mb-4">Estado de Visita</h3>
                                ${generateField('Fecha y Hora Próxima Visita', formatDate(client.agendamiento))}
                            </div>

                            <!-- GESTIÓN DOMICILIARIA -->
                            <div class="section">
                                <h3 class="h5 mb-4">Gestión Domiciliaria</h3>
                                <div class="row">
                                    ${generateField('Riesgo', client.riesgo)}
                                    ${generateField('Exigible', client.exigible)}
                                    ${generateField('Días Mora', client.diasMora)}
                                </div>
                            </div>

                            <!-- ANTECEDENTES -->
                            <div class="section">
                                <h3 class="h5 mb-4">Antecedentes</h3>
                                ${generateField('Resumen', client.resumen, true)}
                            </div>

                            <!-- RESULTADO DE LA GESTIÓN -->
                            <div class="section">
                                <h3 class="h5 mb-4">Resultado de la Gestión</h3>
                                <div class="row">
                                    ${generateField('Tipo de Contacto', client.tipoContacto)}
                                    ${generateField('Respuesta de Contacto', client.respuestaContacto)}
                                    ${generateField('Motivo de No Pago', client.motivoNoPago)}
                                    ${generateField('Observación', client.observacion, true)}
                                </div>
                            </div>

                            <!-- PROMESA DE PAGO -->
                            <div class="section">
                                <h3 class="h5 mb-4">Promesa de Pago</h3>
                                <div class="row">
                                    ${generateField('Fecha Compromiso/Pago', formatDate(client.fechaCompromisoPago))}
                                    ${generateField('Valor', client.valor)}
                                    ${generateField('Teléfono Nuevo', client.telefonoNuevo)}
                                </div>
                            </div>

                            <!-- INFORMACIÓN ADICIONAL -->
                            <div class="section">
                                <h3 class="h5 mb-4">Información Adicional</h3>
                                ${generateField('', client.additionalInfo, true)}
                            </div>

                            <!-- FOTO DE RESPALDO -->
                            <div class="section">
                                <h3 class="h5 mb-4">Foto de Respaldo</h3>
                                <div>
                                    ${getClientPhotoHtml(client)}
                                </div>
                            </div>
                        </section>
                    `).join('')}
                    <div class="text-center no-print">
                        <button onclick="window.print()" class="btn btn-primary mt-4">Imprimir Informe</button>
                    </div>
                </div>
                <!-- Bootstrap JS (Opcional si necesitas funcionalidades JS de Bootstrap) -->
                <!-- <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script> -->
            </body>
            </html>
        `;

        const blob = new Blob([staticHtmlContent], { type: "text/html" });
        const downloadLink = document.createElement("a");
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = "informe_visitas_gestion_terrena.html";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(downloadLink.href);
    }).catch(error => {
        console.error("Error al generar el HTML estático:", error);
        alert("Error al generar el HTML estático. Por favor, inténtalo de nuevo.");
    });
}

// Función para generar campos en el HTML
function generateField(label, value, fullWidth = false) {
    return `
        <div class="${fullWidth ? 'col-12' : 'col-md-6'} mb-3">
            ${label ? `<p class="field-label mb-1">${label}</p>` : ''}
            <p class="field-value">${sanitizeInput(value) || 'N/A'}</p>
        </div>
    `;
}

// Función para obtener el HTML de la foto del cliente
function getClientPhotoHtml(client) {
    if (client.photo) {
        return `<img src="${client.photo}" alt="Foto del cliente" class="photo img-fluid">`;
    } else if (client.urlWeb) {
        const urlWeb = client.urlWeb.trim();
        console.log("Cargando imagen desde URL WEB en HTML estático:", urlWeb);
        if (isValidUrl(urlWeb)) {
            return `<img src="${urlWeb}" alt="Foto del cliente desde URL WEB" class="photo img-fluid">`;
        } else {
            return '<p>URL WEB no es válida.</p>';
        }
    } else {
        return '<p>No hay foto disponible.</p>';
    }
}

// Función para validar si una cadena es una URL válida
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;  
    }
}

// **24. Función para Limpiar el Formulario**
function clearForm() {
    console.log("Limpiando formulario...");

    cleanupPhotoPreview();

    const formElements = document.querySelectorAll("#clientForm input, #clientForm textarea");
    formElements.forEach(element => {
        if (element.type === "file") {
            element.value = "";
        } else {
            element.value = "";
        }
    });

    updatePhotoPreview(null);

    const clientForm = document.getElementById("clientForm");
    if (clientForm) {
        clientForm.classList.add('hidden');
    }

    updateNavigationButtons();
    console.log("Formulario limpiado correctamente");
}

// **25. Listeners de Eventos con Verificación de Existencia de Elementos**
document.addEventListener('DOMContentLoaded', () => {
    const jsonFileInput = document.getElementById("jsonFile");
    if (jsonFileInput) {
        jsonFileInput.addEventListener("change", handleJSONSelect);
    }

    const dataFileInput = document.getElementById("dataFile");
    if (dataFileInput) {
        dataFileInput.addEventListener("change", handleFileSelect);
    }

    const prevClientButton = document.getElementById("prevClient");
    if (prevClientButton) {
        prevClientButton.addEventListener("click", showPreviousDuplicate);
    }

    const nextClientButton = document.getElementById("nextClient");
    if (nextClientButton) {
        nextClientButton.addEventListener("click", showNextDuplicate);
    }

    const photoUploadInput = document.getElementById("photoUpload");
    if (photoUploadInput) {
        photoUploadInput.addEventListener("change", handlePhotoUpload);
    }

    const additionalInfoInput = document.getElementById("additionalInfo");
    if (additionalInfoInput) {
        additionalInfoInput.addEventListener("input", saveAdditionalInfo);
    }

    const searchButton = document.getElementById("searchButton");
    if (searchButton) {
        searchButton.addEventListener("click", searchClient);
    }

    const downloadStaticHtmlButton = document.getElementById("downloadStaticHtmlButton");
    if (downloadStaticHtmlButton) {
        downloadStaticHtmlButton.addEventListener("click", generateStaticHtml);
    }

    const downloadJsonButton = document.getElementById("downloadJsonButton");
    if (downloadJsonButton) {
        downloadJsonButton.addEventListener("click", saveJSON);
    }

    const acceptJsonButton = document.getElementById("acceptJsonButton");
    if (acceptJsonButton) {
        acceptJsonButton.addEventListener("click", acceptJsonVersion);
    }

    const filePathInput = document.getElementById("filePathInput");
    if (filePathInput) {
        filePathInput.addEventListener("change", updateFilePath);
    }

    const clearFormButton = document.getElementById("clearFormButton");
    if (clearFormButton) {
        clearFormButton.addEventListener("click", clearForm);
    }
});

// **26. Función de Inicialización**
async function init() {
    try {
        await db.open();
        updateFilePathDisplay();
        await loadClientsFromIndexedDB();
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
    }
}


// **27. Llamar a la Función de Inicialización cuando el DOM esté Cargado**
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await db.open();
        init();
    } catch (error) {
        console.error('Error al abrir la base de datos:', error);
    }
});

