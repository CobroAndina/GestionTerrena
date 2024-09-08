let clients = [];
let currentClientIndex = 0;
let foundClients = [];
let currentDuplicateIndex = 0;
let currentFilePath = localStorage.getItem('lastUsedFilePath') || "proyecto/datos/clientes.json";
let fileLastModified = null;

// Inicialización de IndexedDB con Dexie
const db = new Dexie('ClientDatabase');
db.version(1).stores({
    clients: '++id, identificacionCliente, photo'
});

// Función para comprimir imagen
async function compressImage(imageFile) {
    const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true
    }
    try {
        const compressedFile = await imageCompression(imageFile, options);
        return compressedFile;
    } catch (error) {
        console.error("Error al comprimir la imagen:", error);
        return null;
    }
}

// Función para manejar la carga de fotos
async function handlePhotoUpload(event) {
  const file = event.target.files[0];
  if (file && file.type.startsWith("image/")) {
      try {
          console.log('Imagen original:', file.size / 1024 / 1024, 'MB');

          const options = {
              maxSizeMB: 1,
              maxWidthOrHeight: 1920,
              useWebWorker: true
          };

          const compressedFile = await imageCompression(file, options);
          console.log('Imagen comprimida:', compressedFile.size / 1024 / 1024, 'MB');

          const reader = new FileReader();
          reader.onload = async function (e) {
              const base64Image = e.target.result;
              if (foundClients.length > 0) {
                  foundClients[currentDuplicateIndex].photo = base64Image;
                  updatePhotoPreview(base64Image);
                  await saveClientToIndexedDB(foundClients[currentDuplicateIndex]);
              } else {
                  console.error("No hay cliente seleccionado para agregar la foto");
              }
          };
          reader.onerror = function (error) {
              console.error("Error al leer la imagen:", error);
              alert("Error al cargar la imagen. Por favor, inténtalo de nuevo.");
          };
          reader.readAsDataURL(compressedFile);
      } catch (error) {
          console.error("Error al comprimir la imagen:", error);
          alert("Error al procesar la imagen. Por favor, inténtalo de nuevo.");
      }
  } else {
      alert("Selecciona un archivo de imagen válido.");
  }
}

// Función para guardar cliente en IndexedDB
async function saveClientToIndexedDB(client) {
  try {
      // Asegurarse de que la foto tenga el formato correcto antes de guardar
      if (client.photo && !client.photo.startsWith('data:image')) {
          client.photo = 'data:image/jpeg;base64,' + client.photo;
      }
      await db.clients.put(client);
      console.log("Cliente guardado en IndexedDB");
  } catch (error) {
      console.error("Error al guardar en IndexedDB:", error);
  }
}

// Función para cargar clientes desde IndexedDB
async function loadClientsFromIndexedDB() {
    try {
        clients = await db.clients.toArray();
        console.log("Clientes cargados desde IndexedDB:", clients.length);
    } catch (error) {
        console.error("Error al cargar desde IndexedDB:", error);
    }
}

// Función para aceptar la versión JSON
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
          
          // Asegurarse de que las fotos tengan el formato correcto
          clients = data.map(client => {
              if (client.photo && !client.photo.startsWith('data:image')) {
                  client.photo = 'data:image/jpeg;base64,' + client.photo;
              }
              return client;
          });
            if (clients.length > 0) {
                document.getElementById("searchContainer").style.display = "flex";
                console.log("Clientes cargados desde JSON:", clients.length);
                updateFilePathDisplay();
                document.getElementById("fileInfoContainer").style.display = "none";
                document.getElementById("acceptJsonButton").style.display = "none";
                localStorage.setItem('lastUsedFilePath', currentFilePath);
                
                // Guardar clientes en IndexedDB
                await db.clients.clear(); // Limpiar base de datos existente
                await db.clients.bulkAdd(clients);
                console.log("Clientes guardados en IndexedDB");
            } else {
                alert("El archivo JSON no contiene datos de clientes.");
            }
          } catch (error) {
            console.error("Error al parsear JSON:", error);
            alert("Error al cargar el archivo JSON. Por favor, verifica el formato.");
        }
    };
    reader.onerror = function (error) {
        console.error("Error al leer el archivo:", error);
        alert("Error al leer el archivo. Por favor, inténtalo de nuevo.");
    };
    reader.readAsText(file);
}

// Función para buscar cliente
async function searchClient() {
    const searchTerm = sanitizeInput(document.getElementById("searchInput").value.trim().toLowerCase());
    console.log("Buscando cliente con ID:", searchTerm);

    if (!isValidClientId(searchTerm)) {
        alert("Por favor, introduce un ID de cliente válido.");
        return;
    }

    foundClients = await db.clients
        .where('identificacionCliente')
        .equalsIgnoreCase(searchTerm)
        .toArray();

    if (foundClients.length > 0) {
        console.log("Clientes encontrados:", foundClients.length);
        currentDuplicateIndex = 0;
        showClient(foundClients[currentDuplicateIndex]);
        if (foundClients.length > 1) {
            alert(`Se encontraron ${foundClients.length} visitas al mismo cliente. Usa los botones de navegación para recorrerlos.`);
        }
    } else {
        console.log("No se encontró cliente con ese ID");
        alert("No se encontró cliente con ese ID.");
    }
    updateNavigationButtons();
}

async function showClient(client) {
  if (!client) {
      console.error("No se encontró cliente para mostrar.");
      return;
  }

  cleanupPhotoPreview(); // Limpiamos la imagen previa

  console.log("Mostrando cliente:", JSON.stringify(client, null, 2));

  document.getElementById("clientForm").style.display = "block";

  Object.keys(client).forEach(key => {
      const element = document.getElementById(key);
      if (element) {
          console.log(`Procesando campo: ${key}`);
          if (element.type === "date") {
              element.value = formatDate(client[key]);
              console.log(`Campo de fecha ${key} actualizado:`, element.value);
          } else if (key === "photo") {
              console.log("Procesando foto:");
              updatePhotoPreview(client[key]);
          } else {
              element.value = sanitizeInput(client[key] || "");
              console.log(`Campo ${key} actualizado:`, element.value);
          }
      } else {
          console.warn(`No se encontró elemento para el campo ${key}`);
      }
  });

  console.log("Actualizando botones de navegación");
  updateNavigationButtons();
  
  console.log("Cliente mostrado completamente");
}
function cleanupPhotoPreview() {
  const photoPreview = document.getElementById("photo");
  if (photoPreview && photoPreview.src.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview.src);
      photoPreview.src = '';
  }
}

function updatePhotoPreview(base64Image) {
  console.log("Iniciando updatePhotoPreview");
  const photoPreview = document.getElementById("photo");
  
  if (!photoPreview) {
      console.error("Error: No se encontró el elemento con id 'photo'");
      return;
  }

  cleanupPhotoPreview(); // Limpiamos cualquier URL de objeto anterior

  if (base64Image) {
      console.log("Se recibió una imagen base64");
      try {
          // Verificamos si la cadena base64 tiene el formato correcto
          if (!base64Image.startsWith('data:image')) {
              base64Image = 'data:image/jpeg;base64,' + base64Image;
          }

          // Extraemos la parte base64 de la cadena
          const base64Content = base64Image.split(',')[1];

          if (!base64Content) {
              throw new Error("La cadena base64 no tiene el formato correcto");
          }

          // Convertimos la imagen base64 a Blob
          const byteCharacters = atob(base64Content);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], {type: 'image/jpeg'});
          
          // Creamos una URL para el Blob
          const imageUrl = URL.createObjectURL(blob);
          
          photoPreview.src = imageUrl;
          photoPreview.style.display = "block";
          photoPreview.alt = "Foto del cliente";
      } catch (error) {
          console.error("Error al procesar la imagen:", error);
          console.log("Contenido de base64Image (primeros 100 caracteres):", base64Image.substring(0, 100));
          photoPreview.src = "https://via.placeholder.com/150?text=Error+de+imagen";
          photoPreview.style.display = "block";
          photoPreview.alt = "Error al cargar la imagen";
      }
  } else {
      console.log("No se proporcionó imagen, mostrando placeholder");
      photoPreview.src = "https://via.placeholder.com/150?text=Sin+imagen";
      photoPreview.style.display = "block";
      photoPreview.alt = "No hay imagen disponible";
  }

  console.log("Finalizando updatePhotoPreview");
}

async function saveAdditionalInfo(event) {
  if (foundClients.length > 0) {
      foundClients[currentDuplicateIndex].additionalInfo = event.target.value;
      await saveClientToIndexedDB(foundClients[currentDuplicateIndex]);
  } else {
      console.error("No hay cliente seleccionado para guardar información adicional");
  }
}
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
      prevButton.disabled = currentDuplicateIndex === 0;
      nextButton.disabled = currentDuplicateIndex === foundClients.length - 1;
  }
}
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
          if (client.photo && client.photo.startsWith('data:image')) {
              // Eliminar el prefijo 'data:image/jpeg;base64,' para ahorrar espacio
              client.photo = client.photo.split(',')[1];
          }
      });

      const dataStr = JSON.stringify(clientsToSave, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = currentFilePath.split('/').pop();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert("Archivo JSON actualizado y guardado con éxito.");
  } catch (error) {
      console.error("Error al guardar JSON:", error);
      alert("Hubo un error al guardar el archivo JSON. Por favor, inténtalo de nuevo.");
  }
}

// Función para sanitizar input
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

// Función para validar ID de cliente
function isValidClientId(id) {
  // Implementa la lógica de validación según tus requisitos
  // Por ejemplo, asegurarse de que el ID tenga cierta longitud y formato
  return id && id.trim().length > 0 && /^\d+$/.test(id);
}

// Función para formatear fechas
function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString; // Si no es una fecha válida, devuelve el string original
  return date.toISOString().split('T')[0]; // Formato YYYY-MM-DD
}

// Función para actualizar la visualización de la ruta del archivo
function updateFilePathDisplay() {
  const filePathInput = document.getElementById("filePathInput");
  if (filePathInput) {
      filePathInput.value = currentFilePath;
  }
}

// Función para manejar la selección de archivos JSON
function handleJSONSelect(event) {
  console.log("Archivo JSON seleccionado...");
  const file = event.target.files[0];
  if (!file) {
      console.error("No se seleccionó ningún archivo");
      return;
  }
  currentFilePath = `proyecto/datos/${file.name}`;
  fileLastModified = new Date(file.lastModified);

  document.getElementById("fileInfo").textContent = `Archivo: ${file.name}, Última modificación: ${fileLastModified.toLocaleString()}`;
  document.getElementById("fileInfoContainer").style.display = "block";
  document.getElementById("acceptJsonButton").style.display = "inline-block";
  document.getElementById("clientForm").style.display = "none";
  
  updateFilePathDisplay();
}

// Función para manejar la selección de archivos CSV/TXT
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
  reader.onerror = function (error) {
      console.error("Error al leer el archivo:", error);
      alert("Error al leer el archivo. Por favor, inténtalo de nuevo.");
  };
  reader.readAsText(file);
}

// Función para procesar datos de CSV/TXT
function processData(data, separator) {
  console.log("Procesando datos del archivo...");
  const lines = data.split("\n");
  if (lines.length < 2) {
      alert("El archivo está vacío o no contiene datos válidos.");
      return;
  }
  const headers = parseCSVLine(lines[0], separator);
  console.log("Encabezados del archivo:", headers);

  clients = [];
  for (let i = 1; i < lines.length; i++) {
      const cleanedLine = lines[i].trim();
      if (cleanedLine === "") continue;

      const currentLine = parseCSVLine(cleanedLine, separator);
      if (currentLine.length === headers.length) {
          const client = {};
          for (let j = 0; j < headers.length; j++) {
              client[headers[j].trim()] = currentLine[j].trim();
          }
          client.additionalInfo = "";
          client.photo = null;
          clients.push(client);
      } else {
          console.log(`Línea ${i} saltada debido a formato incorrecto:`, currentLine);
      }
  }

  if (clients.length > 0) {
      console.log("Clientes cargados:", clients.length);
      document.getElementById("searchContainer").style.display = "flex";
      saveClientsToIndexedDB(clients);
  } else {
      alert("No se encontraron datos válidos en el archivo.");
  }
}

// Función para parsear líneas CSV
function parseCSVLine(line, separator = "|") {
  const regex = new RegExp(`\\${separator}(?=(?:(?:[^"]*"){2})*[^"]*$)`, "g");
  return line.split(regex).map((item) => item.replace(/(^"|"$)/g, "").trim());
}

// Función para guardar clientes en IndexedDB
async function saveClientToIndexedDB(client) {
  try {
      // Asegurarse de que la foto tenga el formato correcto antes de guardar
      if (client.photo && !client.photo.startsWith('data:image')) {
          client.photo = 'data:image/jpeg;base64,' + client.photo;
      }
      await db.clients.put(client);
      console.log("Cliente guardado en IndexedDB");
  } catch (error) {
      console.error("Error al guardar en IndexedDB:", error);
  }
}

// Función para actualizar la ruta del archivo
function updateFilePath() {
  const newPath = document.getElementById("filePathInput").value;
  if (newPath && newPath !== currentFilePath) {
      currentFilePath = newPath;
      localStorage.setItem('lastUsedFilePath', currentFilePath);
      console.log("Ruta de archivo actualizada:", currentFilePath);
  }
}

// Función para generar HTML estático
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
              <title>Clientes Exportados</title>
              <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; background-color: #f4f4f4; }
                  h1 { color: #2c3e50; text-align: center; margin-bottom: 30px; }
                  .client { background-color: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                  .client h2 { color: #3498db; border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-top: 0; }
                  .info-group { margin-bottom: 15px; }
                  .info-group label { font-weight: bold; display: block; margin-bottom: 5px; color: #2c3e50; }
                  .info-group p { margin: 0; padding: 8px; background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; }
                  img { max-width: 300px; height: auto; margin-top: 20px; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
                  @media (max-width: 768px) { body { padding: 10px; } .client { padding: 15px; } }
              </style>
          </head>
          <body>
              <h1>Información de Todos los Clientes</h1>
              ${clients.map((client, index) => `
                  <div class="client">
                      <h2>Cliente #${index + 1}</h2>
                      ${Object.entries(client).map(([key, value]) => {
                          if (key === 'photo') {
                              return value ? `<img src="${value}" alt="Foto del cliente">` : '';
                          } else {
                              return `
                                  <div class="info-group">
                                      <label>${key}:</label>
                                      <p>${sanitizeInput(value) || 'N/A'}</p>
                                  </div>
                              `;
                          }
                      }).join('')}
                  </div>
              `).join('')}
          </body>
          </html>
      `;

      const blob = new Blob([staticHtmlContent], { type: "text/html" });
      const downloadLink = document.createElement("a");
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = "todos_los_clientes.html";
      downloadLink.click();
      URL.revokeObjectURL(downloadLink.href);
  }).catch(error => {
      console.error("Error al generar HTML estático:", error);
      alert("Error al generar el HTML estático. Por favor, inténtalo de nuevo.");
  });
}

// Función para limpiar el formulario
function clearForm() {
  console.log("Limpiando formulario...");
  
  cleanupPhotoPreview(); // Limpiamos la imagen previa

  const formElements = document.querySelectorAll("#clientForm input, #clientForm textarea");
  formElements.forEach(element => {
      if (element.type === "file") {
          element.value = "";
      } else if (element.type === "date") {
          element.value = "";
      } else {
          element.value = "";
      }
  });

  updatePhotoPreview(null);

  document.getElementById("clientForm").style.display = "none";

  updateNavigationButtons();
  console.log("Formulario limpiado correctamente");
}
// Event Listeners
document.getElementById("jsonFile").addEventListener("change", handleJSONSelect);
document.getElementById("dataFile").addEventListener("change", handleFileSelect);
document.getElementById("prevClient").addEventListener("click", showPreviousDuplicate);
document.getElementById("nextClient").addEventListener("click", showNextDuplicate);
document.getElementById("photoUpload").addEventListener("change", handlePhotoUpload);
document.getElementById("additionalInfo").addEventListener("input", saveAdditionalInfo);
document.getElementById("searchButton").addEventListener("click", searchClient);
document.getElementById("downloadStaticHtmlButton").addEventListener("click", generateStaticHtml);
document.getElementById("downloadJsonButton").addEventListener("click", saveJSON);
document.getElementById("acceptJsonButton").addEventListener("click", acceptJsonVersion);
document.getElementById("filePathInput").addEventListener("change", updateFilePath);

// Inicialización
async function init() {
    updateFilePathDisplay();
    await loadClientsFromIndexedDB();
    // Aquí puedes agregar más lógica de inicialización si es necesario
}

// Llamar a la función de inicialización
init();