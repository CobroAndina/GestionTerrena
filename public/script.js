document.addEventListener("DOMContentLoaded", function () {
  let clients = [];
  let currentClientIndex = 0;
  let foundClients = [];
  let currentDuplicateIndex = 0;
  let currentFilePath = localStorage.getItem('lastUsedFilePath') || "proyecto/datos/clientes.json";
  let fileLastModified = null;

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

  // Inicializar la visualización de la ruta del archivo
  updateFilePathDisplay();

  function clearForm() {
    console.log("Limpiando formulario...");
    
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

    const photoPreview = document.getElementById("photoPreview");
    if (photoPreview) {
      photoPreview.src = "";
      photoPreview.style.display = "none";
    }

    // Ocultar el formulario después de limpiarlo
    document.getElementById("clientForm").style.display = "none";

    updateNavigationButtons();
    console.log("Formulario limpiado correctamente");
  }

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
  
  function updateFilePathDisplay() {
    const filePathInput = document.getElementById("filePathInput");
    if (filePathInput) {
      filePathInput.value = currentFilePath;
    }
  }
  
  function updateFilePath() {
    const newPath = document.getElementById("filePathInput").value;
    if (newPath && newPath !== currentFilePath) {
      currentFilePath = newPath;
      localStorage.setItem('lastUsedFilePath', currentFilePath);
      console.log("Ruta de archivo actualizada:", currentFilePath);
    }
  }

  function acceptJsonVersion() {
    const file = document.getElementById("jsonFile").files[0];
    if (!file) {
      alert("Por favor, seleccione un archivo JSON primero.");
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = JSON.parse(e.target.result);
        
        // Limpiar el formulario y resetear las variables globales
        clearForm();
        clients = [];
        foundClients = [];
        currentClientIndex = 0;
        currentDuplicateIndex = 0;
        
        // Cargar los nuevos datos
        clients = data;
        if (clients.length > 0) {
          document.getElementById("searchContainer").style.display = "flex";
          console.log("Clientes cargados desde JSON:", clients.length);
          updateFilePathDisplay();
          document.getElementById("fileInfoContainer").style.display = "none";
          document.getElementById("acceptJsonButton").style.display = "none";
          localStorage.setItem('lastUsedFilePath', currentFilePath);
          
          // No mostrar ningún cliente automáticamente
          // showClient(clients[0]);
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
      // No mostrar automáticamente el primer cliente
      // showClient(clients[0]);
    } else {
      alert("No se encontraron datos válidos en el archivo.");
    }
  }

  function parseCSVLine(line, separator = "|") {
    const regex = new RegExp(`\\${separator}(?=(?:(?:[^"]*"){2})*[^"]*$)`, "g");
    return line.split(regex).map((item) => item.replace(/(^"|"$)/g, "").trim());
  }

  function searchClient() {
    const searchTerm = sanitizeInput(document.getElementById("searchInput").value.trim().toLowerCase());
    console.log("Buscando cliente con ID:", searchTerm);

    if (!isValidClientId(searchTerm)) {
      alert("Por favor, introduce un ID de cliente válido.");
      return;
    }

    foundClients = clients.filter((client) => {
      const identificacion = client.identificacionCliente
        ? client.identificacionCliente.trim().toLowerCase()
        : "";
      return identificacion === searchTerm;
    });

    if (foundClients.length > 0) {
      console.log("Clientes encontrados:", foundClients.length);
      currentDuplicateIndex = 0;
      showClient(foundClients[currentDuplicateIndex]);
      if (foundClients.length > 1) {
        alert(
          `Se encontraron ${foundClients.length} visitas al mismo cliente. Usa los botones de navegación para recorrerlos.`
        );
      }
    } else {
      console.log("No se encontró cliente con ese ID");
      alert("No se encontró cliente con ese ID.");
    }
    updateNavigationButtons();
  }

  function showClient(client) {
    if (!client) {
      console.error("No se encontró cliente para mostrar.");
      return;
    }

    console.log("Mostrando cliente:", client);

    document.getElementById("clientForm").style.display = "block";

    Object.keys(client).forEach(key => {
      const element = document.getElementById(key);
      if (element) {
        if (element.type === "date") {
          element.value = formatDate(client[key]);
        } else if (key === "photo") {
          const photoPreview = document.getElementById("photoPreview");
          if (client[key]) {
            photoPreview.src = client[key];
            photoPreview.style.display = "block";
          } else {
            photoPreview.style.display = "none";
          }
        } else {
          element.value = sanitizeInput(client[key] || "");
        }
      }
    });

    updateNavigationButtons();
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

  function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = function (e) {
        if (foundClients.length > 0) {
          foundClients[currentDuplicateIndex].photo = e.target.result;
          const photoPreview = document.getElementById("photoPreview");
          photoPreview.src = e.target.result;
          photoPreview.style.display = "block";
        } else {
          console.error("No hay cliente seleccionado para agregar la foto");
        }
      };
      reader.onerror = function (error) {
        console.error("Error al leer la imagen:", error);
        alert("Error al cargar la imagen. Por favor, inténtalo de nuevo.");
      };
      reader.readAsDataURL(file);
    } else {
      alert("Selecciona un archivo de imagen válido.");
    }
  }

  function saveAdditionalInfo(event) {
    if (foundClients.length > 0) {
      foundClients[currentDuplicateIndex].additionalInfo = event.target.value;
    } else {
      console.error("No hay cliente seleccionado para guardar información adicional");
    }
  }

  function generateStaticHtml() {
    console.log("Generando HTML estático para todos los clientes...");
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
            <h2>Visita #${index + 1}</h2>
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
  }

  function saveJSON() {
    console.log("Guardando JSON...");
    if (clients.length === 0) {
      alert("No hay datos de clientes para guardar. Por favor, carga algunos datos primero.");
      return;
    }

    const dataStr = JSON.stringify(clients, null, 2);
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
  }

  // Funciones de utilidad

  function isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  function formatDate(dateString) {
    if (!dateString) return "";
    if (!isValidDate(dateString)) return dateString;
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  }

  function isValidClientId(id) {
    // Implementa la lógica de validación según tus requisitos
    return id && id.trim().length > 0;
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

  // Función para manejar errores de manera centralizada
  function handleError(error, message) {
    console.error(message, error);
    alert(`${message} Por favor, inténtalo de nuevo o contacta al soporte.`);
  }

  // Inicialización y configuración adicional
  function init() {
    updateFilePathDisplay();
    // Aquí puedes agregar más lógica de inicialización si es necesario
  }

  // Llamar a la función de inicialización
  init();

});





