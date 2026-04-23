const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

// File filter for allowed types
const fileFilter = (req, file, cb) => {
  // Comprehensive list matching frontend (UploadForm.js)
  const allowedTypes = [
    // Programming Languages
    '.java', '.py', '.js', '.jsx', '.ts', '.tsx', '.c', '.cpp', '.cc', '.h', '.hpp',
    '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.kts', '.scala', '.r',
    '.m', '.mm', '.pl', '.sh', '.bash', '.ps1', '.lua', '.dart', '.groovy', '.sql',
    // Web Technologies
    '.html', '.htm', '.css', '.scss', '.sass', '.less', '.vue', '.svelte',
    // Data & Config
    '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.env', '.csv',
    // Documentation
    '.md', '.txt', '.pdf', '.rtf', '.tex',
    // Diagrams & Images
    '.uml', '.drawio', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
    // Code-related
    '.diff', '.patch', '.log'
  ];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${ext} is not allowed. Allowed types: ${allowedTypes.join(', ')}`), false);
  }
};

// File filter for bulk import files
const bulkImportFileFilter = (req, file, cb) => {
  const allowedTypes = ['.zip', '.csv', '.json'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${ext} is not allowed for bulk import. Allowed types: ${allowedTypes.join(', ')}`), false);
  }
};

// File filter for images (screenshots and highlight images)
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${ext} is not allowed. Allowed image types: ${allowedTypes.join(', ')}`), false);
  }
};

// Configure multer for regular uploads
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: fileFilter
});

// Configure multer for bulk imports
const bulkImportUpload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for bulk imports
  },
  fileFilter: bulkImportFileFilter
});

// Configure multer for image uploads (screenshots and highlight images)
const imageUpload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for images
  },
  fileFilter: imageFileFilter
});

module.exports = { upload, bulkImportUpload, imageUpload };