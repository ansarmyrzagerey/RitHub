const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  // Determine target based on environment
  // Priority: REACT_APP_BACKEND_URL > localhost (default for local dev)
  let target = process.env.REACT_APP_BACKEND_URL;

  // If target is localhost, force IPv4 to avoid ::1 issues
  // But don't modify Docker service names (like 'backend')
  if (target && target.includes('localhost') && !target.includes('backend')) {
    target = target.replace('localhost', '127.0.0.1');
  }

  // If not set, try to detect if we're in Docker
  if (!target) {
    // Check if we can reach backend service (Docker)
    // Default to localhost for local development
    target = 'http://127.0.0.1:5000';
  }

  console.log('=== PROXY CONFIGURATION ===');
  console.log('Target:', target);
  console.log('Environment:', process.env.NODE_ENV);
  console.log('REACT_APP_BACKEND_URL:', process.env.REACT_APP_BACKEND_URL || 'not set (using default)');
  console.log('===========================');

  app.use(
    '/api',
    createProxyMiddleware({
      target: target,
      changeOrigin: true,
      secure: false,
      logLevel: 'warn',
      // The backend expects /api prefix
      // http-proxy-middleware should strip /api, but if it doesn't, we handle both cases
      pathRewrite: (path, req) => {
        // If path already starts with /api, use it as-is
        // Otherwise, add /api prefix (in case it was stripped)
        const newPath = path.startsWith('/api') ? path : '/api' + path;
        console.log('[PROXY] Rewriting:', path, '->', newPath);
        return newPath;
      },
      onProxyReq: (proxyReq, req, res) => {
        console.log('[PROXY] Proxying:', req.method, req.originalUrl, '-> ', target + proxyReq.path);
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log('[PROXY] Response:', proxyRes.statusCode, req.method, req.originalUrl);
      },
      onError: (err, req, res) => {
        console.error('[PROXY] Error proxying', req.method, req.originalUrl, ':', err.message);
        console.error('[PROXY] Target was:', target);
        console.error('[PROXY] Make sure backend is running on', target);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Proxy error - Backend not reachable',
            message: err.message,
            target: target,
            hint: 'Make sure backend is running. Check TROUBLESHOOTING.md'
          });
        }
      }
    })
  );

  // Proxy /uploads to backend for static file serving
  app.use(
    '/uploads',
    createProxyMiddleware({
      target: target,
      changeOrigin: true,
      secure: false,
      logLevel: 'warn',
      onProxyReq: (proxyReq, req, res) => {
        console.log('[PROXY] Proxying upload:', req.method, req.originalUrl, '-> ', target + proxyReq.path);
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log('[PROXY] Upload response:', proxyRes.statusCode, req.method, req.originalUrl);
      },
      onError: (err, req, res) => {
        console.error('[PROXY] Error proxying upload', req.method, req.originalUrl, ':', err.message);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Proxy error - Backend not reachable',
            message: err.message,
            target: target
          });
        }
      }
    })
  );

  // Don't proxy favicon - let it fail gracefully
  app.use('/favicon.ico', (req, res) => {
    res.status(204).end();
  });
};

