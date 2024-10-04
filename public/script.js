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
            // Opciones de compresión
            const options = {
                maxSizeMB: 1,
                maxWidthOrHeight: 1024,
                useWebWorker: true
            }

            const compressedFile = await imageCompression(file, options);
            
            const reader = new FileReader();
            reader.onload = async function (e) {
                const base64Image = e.target.result;
                if (foundClients.length > 0) {
                    foundClients[currentDuplicateIndex].photo = base64Image;
                    updatePhotoPreview(foundClients[currentDuplicateIndex]);
                    await saveClientToIndexedDB(foundClients[currentDuplicateIndex]);
                    showMessage("Foto cargada y comprimida con éxito", "success");
                } else {
                    showMessage("No hay cliente seleccionado para agregar la foto.", "error");
                }
            };
            reader.onerror = function () {
                showMessage("Error al cargar la imagen. Por favor, inténtalo de nuevo.", "error");
            };
            reader.readAsDataURL(compressedFile);
        } catch (error) {
            console.error("Error al comprimir la imagen:", error);
            showMessage("Error al procesar la imagen. Por favor, inténtalo de nuevo.", "error");
        }
    } else {
        showMessage("Selecciona un archivo de imagen válido.", "warning");
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

    // Asegurarse de que latitud y longitud se actualicen correctamente
    document.getElementById("latitud").value = client.latitud || "";
    document.getElementById("longitud").value = client.longitud || "";

    updatePhotoPreview(client);

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
    const photoContainer = document.getElementById("photoPreviewContainer");

    if (!photoPreview || !photoContainer) {
        console.error("Error: No se encontraron los elementos de vista previa de la foto");
        return;
    }

    cleanupPhotoPreview();

    if (client.photo) {
        // Crear una versión de baja resolución
        const lowResImage = document.createElement('img');
        lowResImage.src = client.photo;
        lowResImage.classList.add('blur-sm', 'w-full', 'h-full', 'object-cover');
        photoContainer.appendChild(lowResImage);

        // Cargar la imagen de alta resolución
        const highResImage = new Image();
        highResImage.onload = function() {
            lowResImage.remove();
            photoPreview.src = this.src;
            photoPreview.classList.remove('hidden');
            photoPreview.classList.add('w-full', 'h-full', 'object-cover');
        };
        highResImage.src = client.photo;
    } else if (client.urlWeb) {
        const urlWeb = client.urlWeb.trim();
        if (isValidUrl(urlWeb)) {
            photoPreview.src = urlWeb;
            photoPreview.classList.remove('hidden');
        } else {
            photoPreview.src = "https://via.placeholder.com/150?text=URL+no+válida";
            photoPreview.classList.remove('hidden');
        }
    } else {
        photoPreview.src = "https://via.placeholder.com/150?text=Sin+imagen";
        photoPreview.classList.remove('hidden');
    }
}
// **OTRAS FUNCIONES DE VALIDACIÓN Y FORMATEO**
// **Función para mostrar mensajes**
function showMessage(message, type = 'info', duration = 3000) {
    const messageContainer = document.getElementById('messageContainer');
    if (!messageContainer) {
        console.error('El contenedor de mensajes no existe en el DOM');
        return;
    }

    // Limpiar mensajes anteriores
    messageContainer.innerHTML = '';

    // Crear el elemento del mensaje
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.className = 'px-4 py-2 rounded shadow-md text-white';

    // Establecer el color de fondo según el tipo de mensaje
    switch (type) {
        case 'success':
            messageElement.classList.add('bg-green-500');
            break;
        case 'error':
            messageElement.classList.add('bg-red-500');
            break;
        case 'warning':
            messageElement.classList.add('bg-yellow-500');
            break;
        default:
            messageElement.classList.add('bg-blue-500');
    }

    // Añadir el mensaje al contenedor
    messageContainer.appendChild(messageElement);
    messageContainer.classList.remove('hidden');

    // Remover el mensaje después de la duración especificada
    setTimeout(() => {
        messageElement.remove();
        if (messageContainer.children.length === 0) {
            messageContainer.classList.add('hidden');
        }
    }, duration);
}

function isValidCoordinate(value, type) {
    // Eliminar espacios en blanco y reemplazar comas por puntos
    value = value.trim().replace(',', '.');
    
    // Expresión regular para validar el formato
    const regex = /^-?\d+(\.\d+)?$/;
    
    if (!regex.test(value)) {
        return false;
    }
    
    // Convertir a número
    const num = parseFloat(value);
    
    // Verificar si es un número válido y está en el rango correcto
    if (isNaN(num)) {
        return false;
    }
    
    if (type === 'latitud') {
        return num >= -90 && num <= 90;
    } else if (type === 'longitud') {
        return num >= -180 && num <= 180;
    }
    
    return false;
}

function validateLatitud(event) {
    const value = event.target.value;
    if (value === "" || isValidCoordinate(value, 'latitud')) {
        event.target.classList.remove('border-red-500');
        event.target.classList.add('border-green-500');
    } else {
        event.target.classList.remove('border-green-500');
        event.target.classList.add('border-red-500');
    }
}

function validateLongitud(event) {
    const value = event.target.value;
    if (value === "" || isValidCoordinate(value, 'longitud')) {
        event.target.classList.remove('border-red-500');
        event.target.classList.add('border-green-500');
    } else {
        event.target.classList.remove('border-green-500');
        event.target.classList.add('border-red-500');
    }
}

// **Función para validar si una cadena es una URL válida**
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;  
    }
}

// **13. Funciones para Guardar Información Adicional, latitud y longitud**
async function saveAdditionalInfo(event) {
    if (foundClients.length > 0) {
        foundClients[currentDuplicateIndex].additionalInfo = event.target.value;
        await saveClientToIndexedDB(foundClients[currentDuplicateIndex]);
    } else {
        alert("No hay cliente seleccionado para guardar información adicional.");
    }
}

async function saveLatitud(event) {
    const value = event.target.value;
    if (isValidCoordinate(value, 'latitud')) {
        if (foundClients.length > 0) {
            foundClients[currentDuplicateIndex].latitud = value;
            await saveClientToIndexedDB(foundClients[currentDuplicateIndex]);
            showMessage("Latitud guardada correctamente", "success");
        } else {
            showMessage("No hay cliente seleccionado para guardar latitud.", "error");
        }
    } else {
        showMessage("Latitud inválida. Debe ser un número entre -90 y 90, sin caracteres adicionales.", "error");
        event.target.value = foundClients[currentDuplicateIndex].latitud || "";
    }
}

async function saveLongitud(event) {
    const value = event.target.value;
    if (isValidCoordinate(value, 'longitud')) {
        if (foundClients.length > 0) {
            foundClients[currentDuplicateIndex].longitud = value;
            await saveClientToIndexedDB(foundClients[currentDuplicateIndex]);
            showMessage("Longitud guardada correctamente", "success");
        } else {
            showMessage("No hay cliente seleccionado para guardar longitud.", "error");
        }
    } else {
        showMessage("Longitud inválida. Debe ser un número entre -180 y 180, sin caracteres adicionales.", "error");
        event.target.value = foundClients[currentDuplicateIndex].longitud || "";
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
        showMessage("Hubo errores al procesar el archivo. Por favor, verifica el formato.");
        console.error("Errores al procesar el archivo:", parsedData.errors);
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

        // Inicializar campos adicionales
        clientData.additionalInfo = clientData.additionalInfo || "";
        clientData.photo = clientData.photo || null;
        clientData.latitud = clientData.latitud || "";
        clientData.longitud = clientData.longitud || "";

        return clientData;
    });

    if (clients.length > 0) {
        console.log("Clientes cargados:", clients.length);
        const searchContainer = document.getElementById("searchContainer");
        if (searchContainer) {
            searchContainer.classList.remove('hidden');
        }
        saveClientsToIndexedDB(clients);
        showMessage(`Se han cargado ${clients.length} clientes con éxito.`);
    } else {
        showMessage("No se encontraron datos válidos en el archivo.");
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

// **23. Función para generar el HTML estático**
async function generateStaticHtml() {
    console.log("Generando HTML estático para todos los clientes...");
    try {
        const clients = await db.clients.toArray();
        if (clients.length === 0) {
            showMessage("No hay clientes para generar el HTML. Por favor, carga algunos datos primero.", "warning");
            return;
        }

        const clientsHtml = await Promise.all(clients.map(async (client, index) => {
            const photoHtml = await getClientPhotoHtml(client);
            return `
                <div class="max-w-4xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden mb-8 page-break" data-client-id="${client.id || index}">
                    <div class="px-6 py-4 bg-gray-200 border-b border-gray-300">
                        <h1 class="text-2xl font-bold text-gray-800">INFORME DE VISITAS GESTIÓN TERRENA</h1>
                    </div>
                    <div class="p-6 space-y-6">
                        <div class="bg-gray-50 p-4 rounded-lg shadow">
                            <h2 class="text-xl font-semibold mb-4 flex items-center">
                                <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                DATOS CLIENTE
                            </h2>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                ${generateField('NOMBRE CLIENTE', client.nombreCliente)}
                                ${generateField('OPERACIÓN', client.operacion)}
                                ${generateField('PRODUCTO', client.producto)}
                                ${generateField('TELEFONO DEL CLIENTE', client.telefonoCliente)}
                                ${generateField('DIRECCIÓN DE LA VISITA', client.direccionVisita, 'col-span-2')}
                                ${generateField('TIPO DE DIRECCIÓN DE VISITA', client.tipoDireccionVisita, 'col-span-2')}
                                ${generateField('FECHA Y HORA DE VISITA', formatDate(client.fechaHoraVisita))}
                                ${generateField('NOMBRE DEL GESTOR', client.nombreGestor)}
                            </div>
                            <div class="mt-4">
                                <h3 class="font-semibold mb-2">GEOLOCALIZACIÓN DEL CLIENTE</h3>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    ${generateField('LATITUD', client.latitud)}
                                    ${generateField('LONGITUD', client.longitud)}
                                </div>
                            </div>
                        </div>

                        <div class="bg-gray-50 p-4 rounded-lg shadow">
                            <h2 class="text-xl font-semibold mb-4 flex items-center">
                                <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                ESTADO DE VISITA
                            </h2>
                            ${generateField('FECHA Y HORA PRÓXIMA VISITA', formatDate(client.agendamiento))}
                        </div>

                        <div class="bg-gray-50 p-4 rounded-lg shadow">
                            <h2 class="text-xl font-semibold mb-4 flex items-center">
                                <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                                GESTIÓN DOMICILIARIA
                            </h2>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                ${generateField('RIESGO', client.riesgo)}
                                ${generateField('EXIGIBLE', client.exigible)}
                                ${generateField('DIAS MORA', client.diasMora)}
                            </div>
                        </div>

                        <div class="bg-gray-50 p-4 rounded-lg shadow">
                            <h2 class="text-xl font-semibold mb-4 flex items-center">
                                <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                ANTECEDENTES
                            </h2>
                            ${generateField('RESUMEN', client.resumen, 'col-span-2')}
                        </div>

                        <div class="bg-gray-50 p-4 rounded-lg shadow">
                            <h2 class="text-xl font-semibold mb-4 flex items-center">
                                <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                                RESULTADO DE LA GESTIÓN
                            </h2>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                ${generateField('TIPO DE CONTACTO', client.tipoContacto)}
                                ${generateField('RESPUESTA DE CONTACTO', client.respuestaContacto)}
                                ${generateField('MOTIVO DE NO PAGO', client.motivoNoPago)}
                                ${generateField('OBSERVACIÓN', client.observacion, 'col-span-2')}
                            </div>
                        </div>

                        <div class="bg-gray-50 p-4 rounded-lg shadow">
                            <h2 class="text-xl font-semibold mb-4 flex items-center">
                                <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                PROMESA DE PAGO
                            </h2>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                ${generateField('FECHA COMPROMISO/PAGO', formatDate(client.fechaCompromisoPago))}
                                ${generateField('VALOR', client.valor)}
                                ${generateField('TELÉFONO NUEVO', client.telefonoNuevo)}
                            </div>
                        </div>

                        <div class="bg-gray-50 p-4 rounded-lg shadow">
                            <h2 class="text-xl font-semibold mb-4 flex items-center">
                                <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                INFORMACIÓN ADICIONAL
                            </h2>
                            ${generateField('', client.additionalInfo, 'col-span-2')}
                        </div>

                        <div class="bg-gray-50 p-4 rounded-lg shadow">
                            <h2 class="text-xl font-semibold mb-4 flex items-center">
                                <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                FOTO DE RESPALDO
                            </h2>
                            <div class="mt-2">
                                ${photoHtml}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }));

        const staticHtmlContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Informe de Visitas Gestión Terrena</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    @media print {
                        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                        .page-break { page-break-after: always; }
                    }
                    .client-image {
                        transition: opacity 500ms ease-in-out;
                    }
                </style>
            </head>
            <body class="bg-gray-100 p-8">
                ${clientsHtml.join('')}
                <script>
                    async function createBlurredPlaceholder(imageSrc) {
                        return new Promise((resolve) => {
                            const img = new Image();
                            img.crossOrigin = 'Anonymous';
                            img.onload = () => {
                                const canvas = document.createElement('canvas');
                                const ctx = canvas.getContext('2d');
                                canvas.width = 40;
                                canvas.height = 30;
                                ctx.filter = 'blur(4px)';
                                ctx.drawImage(img, 0, 0, 40, 30);
                                resolve(canvas.toDataURL('image/jpeg', 0.1));
                            };
                            img.onerror = () => resolve(null);
                            img.src = imageSrc;
                        });
                    }

                    function preloadImage(src) {
                        return new Promise((resolve, reject) => {
                            const img = new Image();
                            img.onload = () => resolve(img);
                            img.onerror = reject;
                            img.src = src;
                        });
                    }

                    function initImageHandling() {
                        const imageObserver = new IntersectionObserver((entries, observer) => {
                            entries.forEach(entry => {
                                if (entry.isIntersecting) {
                                    const img = entry.target;
                                    img.src = img.dataset.src;
                                    img.classList.remove('opacity-0');
                                    img.onload = () => {
                                        const clientId = img.closest('[data-client-id]')?.dataset.clientId;
                                        if (clientId) {
                                            localStorage.setItem(\`cachedImage_\${clientId}\`, img.src);
                                        }
                                    };
                                    observer.unobserve(img);
                                }
                            });
                        }, { rootMargin: '50px 0px', threshold: 0.01 });

                        document.querySelectorAll('img.client-image').forEach(img => {
                            imageObserver.observe(img);
                        });

                        const criticalImages = Array.from(document.querySelectorAll('img.client-image')).slice(0, 5);
                        criticalImages.forEach(img => {
                            preloadImage(img.dataset.src).then(() => {
                                img.src = img.dataset.src;
                                img.classList.remove('opacity-0');
                            });
                        });
                    }

                    document.addEventListener('DOMContentLoaded', initImageHandling);
                </script>
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

        showMessage("HTML estático generado y descargado con éxito.", "success");
    } catch (error) {
        console.error("Error al generar HTML estático:", error);
        showMessage("Error al generar el HTML estático. Por favor, inténtalo de nuevo.", "error");
    }
}

function generateField(label, value, className = '') {
    return `
        <div class="${className}">
            <label class="block text-sm font-medium text-gray-700">${label}</label>
            <p class="mt-1 p-2 w-full border border-gray-300 rounded-md bg-gray-50">${sanitizeInput(value) || 'N/A'}</p>
        </div>
    `;
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;  
    }
}

function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case "'": return '&#39;';
            case '"': return '&quot;';
        }
    });
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

async function createBlurredPlaceholder(imageSrc) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 40;
            canvas.height = 30;
            ctx.filter = 'blur(4px)';
            ctx.drawImage(img, 0, 0, 40, 30);
            resolve(canvas.toDataURL('image/jpeg', 0.1));
        };
        img.onerror = () => resolve(null);
        img.src = imageSrc;
    });
}

function preloadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function initImageHandling() {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('opacity-0');
                img.onload = () => {
                    const clientId = img.closest('[data-client-id]')?.dataset.clientId;
                    if (clientId) {
                        localStorage.setItem(`cachedImage_${clientId}`, img.src);
                    }
                };
                observer.unobserve(img);
            }
        });
    }, { rootMargin: '50px 0px', threshold: 0.01 });

    document.querySelectorAll('img.client-image').forEach(img => {
        imageObserver.observe(img);
    });

    const criticalImages = Array.from(document.querySelectorAll('img.client-image')).slice(0, 5);
    criticalImages.forEach(img => {
        preloadImage(img.dataset.src).then(() => {
            img.src = img.dataset.src;
            img.classList.remove('opacity-0');
        });
    });
}

async function getClientPhotoHtml(client) {
    let imageSrc = client.photo || client.urlWeb;
    if (!imageSrc) {
        return '<p class="text-gray-500">No hay foto disponible.</p>';
    }

    // Intentar obtener la imagen del almacenamiento local
    const cachedImage = localStorage.getItem(`cachedImage_${client.id}`);
    if (cachedImage) {
        imageSrc = cachedImage;
    }

    // Crear placeholder borroso
    const blurredPlaceholder = await createBlurredPlaceholder(imageSrc) || 
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 200'%3E%3Crect width='300' height='200' fill='%23cccccc'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='24px' fill='%23333333'%3ECargando...%3C/text%3E%3C/svg%3E";

    return `
        <div class="relative w-full h-96 bg-gray-200 rounded-lg overflow-hidden">
            <img
                src="${blurredPlaceholder}"
                data-src="${sanitizeInput(imageSrc)}"
                alt="Foto del cliente"
                class="client-image lazyload absolute inset-0 w-full h-full object-cover transition-opacity duration-500 opacity-0"
                loading="lazy"
            />
            <noscript>
                <img src="${sanitizeInput(imageSrc)}" 
                     alt="Foto del cliente" 
                     class="absolute inset-0 w-full h-full object-cover" />
            </noscript>
        </div>`;
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

    const latitudInput = document.getElementById("latitud");
    if (latitudInput) {
        latitudInput.addEventListener("input", validateLatitud);
        latitudInput.addEventListener("blur", saveLatitud);
    }

    const longitudInput = document.getElementById("longitud");
    if (longitudInput) {
        longitudInput.addEventListener("input", validateLongitud);
        longitudInput.addEventListener("blur", saveLongitud);
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

