const cachePrefix = 'story-book-1';
const scope = '';
let notificationUrl = '';

function fetchFromCache(request) {
    return caches.match(request).then(response => {
        if (!response) {
            throw Error(`${request.url} not found in cache`);
        }
        return response;
    });
}

function offlineImage() {
    var offlineSVG = '<svg role="img" aria-labelledby="offline-title"' +
        ' viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">' +
        '<title id="offline-title">Offline</title>' +
        '<g fill="none" fill-rule="evenodd">' +
        '<path fill="#D8D8D8" d="M0 0h400v300H0z"/>' +
        '<text fill="#9B9B9B" font-family="Times New Roman,Times,serif"' +
        ' font-size="35" font-weight="bold">' +
        '<tspan x="55" y="0">Story Book Offline :(</tspan></text></g></svg>';
    return new Response(offlineSVG, {
        headers: {
            'Content-Type': 'image/svg+xml'
        }
    });
}

function isNavigateRequest(request) {
    return (request.mode === 'navigate' ||
        (request.method === 'GET' &&
            request.headers.get('accept').includes('text/html')));
}

function isImageRequest(request) {
    return (request.headers.get('Accept').indexOf('image') !== -1);
}

function readCacheFileList() {
    return fetch('cache-files.json').then(response => {
        return response.json().then(paths => {
            return paths.map(path => `${scope}/${path}`);
        });
    });
}

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(`${cachePrefix}-shell`).then(cache => {
            return readCacheFileList().then(files => {
                return cache.addAll(files);
            });
        }).then(() => self.skipWaiting())
    );
});




self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheKeys => {
            var oldCacheKeys = cacheKeys.filter(key => {
                return (key.indexOf(cachePrefix) !== 0);
            });
            var deletePromises = oldCacheKeys.map(oldKey => {
                return caches.delete(oldKey);
            });
            return Promise.all(deletePromises);
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    var request = event.request;
    if (isNavigateRequest(request)) {
        event.respondWith(
            fetch(request)
            .catch(() => fetchFromCache(request))
            .catch(() => caches.match(`${scope}/offline.html`))
        );
    } else if (isImageRequest(request)) {
        event.respondWith(
            fetchFromCache(request)
            .catch(() => fetch(request))
            .catch(() => offlineImage())
        );
    } else {
        event.respondWith(
            fetchFromCache(request)
            .catch(() => fetch(request))
        );
    }
});

self.addEventListener('push', function (event) {
    console.log('Push received: ', event);
    let _data = event.data ? JSON.parse(event.data.text()) : {};
    notificationUrl = _data.url;
    event.waitUntil(
        self.registration.showNotification(_data.title, {
            body: _data.message,
            icon: _data.icon,
            tag: _data.tag
        })
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({
            type: "window"
        })
        .then(function (clientList) {
            if (clients.openWindow) {
                return clients.openWindow(notificationUrl);
            }
        })
    );
});