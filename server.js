const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Configuración de multer para guardar las imágenes en la carpeta 'uploads'
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    
    // Crear la carpeta 'uploads' si no existe
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Middleware para configurar headers de seguridad y caché
app.use((req, res, next) => {
  // Seguridad: X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Caché: Cache-Control
  if (req.url.match(/\.(css|js|png|jpg|jpeg|gif)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  }
  
  // Seguridad: Remover o minimizar el header 'Server'
  res.removeHeader('X-Powered-By');
  
  next();
});

// Middleware para servir archivos estáticos con opciones de caché
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1y',
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Ruta para manejar la subida de imágenes
app.post('/upload', upload.single('photo'), (req, res) => {
  const file = req.file;
  const imageUrl = `/uploads/${file.filename}`; // URL donde se podrá acceder a la imagen
  res.json({ url: imageUrl });
});

// Ruta para servir las imágenes de la carpeta 'uploads' con opciones de caché
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1y',
  immutable: true
}));

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor iniciado en http://localhost:${port}`);
});