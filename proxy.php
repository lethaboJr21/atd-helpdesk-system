<?php
/**
 * ATD Alliance Helpdesk Portal – PHP Reverse Proxy
 * File: portal.atdalliance.co.za/proxy.php  (or configured via .htaccess)
 *
 * This proxy forwards /api/* requests from the PHP server to the
 * Node.js backend running on localhost:3001, and serves the React
 * frontend for all other paths.
 *
 * SETUP:
 *   1. Copy the built React files (frontend/dist/*) to your PHP web root.
 *   2. Place this proxy.php there too.
 *   3. Use the .htaccess below to route traffic.
 */

$BACKEND_URL = 'http://127.0.0.1:3001';

$requestUri  = $_SERVER['REQUEST_URI'] ?? '/';
$method      = $_SERVER['REQUEST_METHOD'];
$body        = file_get_contents('php://input');

// Forward API requests to Node.js
if (strpos($requestUri, '/api/') === 0) {
    $targetUrl = $BACKEND_URL . $requestUri;
    if (!empty($_SERVER['QUERY_STRING'])) {
        $targetUrl .= '?' . $_SERVER['QUERY_STRING'];
    }

    $headers = [];
    foreach (getallheaders() as $name => $value) {
        $lower = strtolower($name);
        // Forward auth and content headers; skip host
        if (in_array($lower, ['authorization', 'content-type', 'accept', 'x-requested-with'])) {
            $headers[] = "$name: $value";
        }
    }

    $context = stream_context_create([
        'http' => [
            'method'        => $method,
            'header'        => implode("\r\n", $headers),
            'content'       => $body ?: null,
            'ignore_errors' => true,
            'timeout'       => 15,
        ]
    ]);

    $response = file_get_contents($targetUrl, false, $context);
    $statusLine = $http_response_header[0] ?? 'HTTP/1.1 502 Bad Gateway';
    preg_match('/HTTP\/\d\.\d\s+(\d+)/', $statusLine, $m);
    $statusCode = $m[1] ?? 502;

    http_response_code((int)$statusCode);

    // Forward relevant response headers
    foreach ($http_response_header as $header) {
        if (stripos($header, 'Content-Type:') === 0) {
            header($header);
        }
    }

    echo $response ?: json_encode(['error' => 'Backend unavailable']);
    exit;
}

// For all non-API requests, serve the React SPA index.html
// (React Router handles client-side navigation)
$distPath = __DIR__ . '/dist';
$indexFile = $distPath . '/index.html';

// Serve static assets (JS, CSS, images) directly
$filePath = $distPath . parse_url($requestUri, PHP_URL_PATH);
if (is_file($filePath)) {
    $ext = pathinfo($filePath, PATHINFO_EXTENSION);
    $mimeTypes = [
        'js'   => 'application/javascript',
        'css'  => 'text/css',
        'svg'  => 'image/svg+xml',
        'png'  => 'image/png',
        'ico'  => 'image/x-icon',
        'json' => 'application/json',
        'woff2'=> 'font/woff2',
    ];
    if (isset($mimeTypes[$ext])) {
        header('Content-Type: ' . $mimeTypes[$ext]);
    }
    readfile($filePath);
    exit;
}

// SPA fallback — send index.html for all other routes
if (file_exists($indexFile)) {
    header('Content-Type: text/html; charset=UTF-8');
    readfile($indexFile);
} else {
    http_response_code(503);
    echo '<h1>503 – Frontend not built</h1><p>Run <code>npm run build</code> in the frontend directory.</p>';
}
