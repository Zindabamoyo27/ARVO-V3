// AR Notes App - Main JavaScript

// ========================================
// State Management
// ========================================
const AppState = {
    notes: [],
    userLocation: null,
    currentView: 'map',
    watchId: null,
    cameraStream: null,
    deferredPrompt: null
};

// ========================================
// Constants
// ========================================
const NEARBY_RADIUS = 50; // meters
const LOCATION_OPTIONS = {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 10000
};

// ========================================
// DOM Elements
// ========================================
const elements = {
    // Views
    mapView: document.getElementById('mapView'),
    arView: document.getElementById('arView'),
    createView: document.getElementById('createView'),
    listView: document.getElementById('listView'),
    
    // Status
    locationStatus: document.getElementById('locationStatus'),
    locationText: document.getElementById('locationText'),
    notesCount: document.getElementById('notesCount'),
    countText: document.getElementById('countText'),
    
    // Map View
    locationInfo: document.getElementById('locationInfo'),
    nearbySection: document.getElementById('nearbySection'),
    nearbyNotesList: document.getElementById('nearbyNotesList'),
    emptyState: document.getElementById('emptyState'),
    
    // AR View
    cameraFeed: document.getElementById('cameraFeed'),
    arOverlay: document.getElementById('arOverlay'),
    arEmpty: document.getElementById('arEmpty'),
    
    // Create View
    noteText: document.getElementById('noteText'),
    charCount: document.getElementById('charCount'),
    privateToggle: document.getElementById('privateToggle'),
    privacyIcon: document.getElementById('privacyIcon'),
    privacyText: document.getElementById('privacyText'),
    createLocationInfo: document.getElementById('createLocationInfo'),
    saveNoteBtn: document.getElementById('saveNoteBtn'),
    
    // List View
    allNotesList: document.getElementById('allNotesList'),
    listEmpty: document.getElementById('listEmpty'),
    
    // Navigation
    navBtns: document.querySelectorAll('.nav-btn'),
    
    // Overlays
    loadingOverlay: document.getElementById('loadingOverlay'),
    toastContainer: document.getElementById('toastContainer'),
    
    // Install
    installPrompt: document.getElementById('installPrompt'),
    installBtn: document.getElementById('installBtn'),
    dismissBtn: document.getElementById('dismissBtn')
};

// ========================================
// Initialization
// ========================================
async function init() {
    console.log('🚀 Initializing AR Notes App...');
    
    // Load notes from storage
    await loadNotes();
    
    // Setup location tracking
    setupLocationTracking();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup PWA install
    setupPWA();
    
    // Hide loading overlay
    setTimeout(() => {
        elements.loadingOverlay.classList.add('hidden');
    }, 1000);
    
    console.log('✅ App initialized');
}

// ========================================
// Storage Functions
// ========================================
async function loadNotes() {
    try {
        const result = await window.storage.list('note:');
        if (result && result.keys && result.keys.length > 0) {
            const notePromises = result.keys.map(async (key) => {
                try {
                    const data = await window.storage.get(key);
                    return data ? JSON.parse(data.value) : null;
                } catch (err) {
                    console.error(`Failed to load note ${key}:`, err);
                    return null;
                }
            });
            
            const loadedNotes = (await Promise.all(notePromises)).filter(n => n !== null);
            AppState.notes = loadedNotes;
            console.log(`📝 Loaded ${loadedNotes.length} notes`);
        } else {
            console.log('📝 No existing notes found');
        }
    } catch (err) {
        console.log('📝 Starting with empty notes:', err.message);
        AppState.notes = [];
    }
    
    updateNotesCount();
}

async function saveNote(note) {
    try {
        await window.storage.set(`note:${note.id}`, JSON.stringify(note));
        AppState.notes.push(note);
        console.log('💾 Note saved:', note.id);
        return true;
    } catch (err) {
        console.error('❌ Failed to save note:', err);
        showToast('Failed to save note', 'error');
        return false;
    }
}

async function deleteNote(noteId) {
    try {
        await window.storage.delete(`note:${noteId}`);
        AppState.notes = AppState.notes.filter(n => n.id !== noteId);
        console.log('🗑️ Note deleted:', noteId);
        return true;
    } catch (err) {
        console.error('❌ Failed to delete note:', err);
        showToast('Failed to delete note', 'error');
        return false;
    }
}

// ========================================
// Location Functions
// ========================================
function setupLocationTracking() {
    if (!navigator.geolocation) {
        showLocationError('Geolocation not supported on this device');
        return;
    }
    
    elements.locationText.textContent = 'Acquiring GPS...';
    
    AppState.watchId = navigator.geolocation.watchPosition(
        handleLocationSuccess,
        handleLocationError,
        LOCATION_OPTIONS
    );
}

function handleLocationSuccess(position) {
    AppState.userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp
    };
    
    // Update UI
    elements.locationText.textContent = 'Location acquired';
    elements.locationText.style.color = '#10b981';
    
    updateLocationDisplay();
    updateNearbyNotes();
    updateNotesCount();
}

function handleLocationError(error) {
    let message = 'Location unavailable';
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = 'Location permission denied';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'Location unavailable';
            break;
        case error.TIMEOUT:
            message = 'Location timeout';
            break;
    }
    
    showLocationError(message);
}

function showLocationError(message) {
    elements.locationText.textContent = message;
    elements.locationText.style.color = '#ef4444';
    elements.locationInfo.innerHTML = `<p style="color: #ef4444;">${message}</p>`;
    showToast(message, 'error');
}

function updateLocationDisplay() {
    if (!AppState.userLocation) return;
    
    const { lat, lng, accuracy } = AppState.userLocation;
    
    elements.locationInfo.innerHTML = `
        <p>Latitude: ${lat.toFixed(6)}°</p>
        <p>Longitude: ${lng.toFixed(6)}°</p>
        <p style="margin-top: 0.5rem;">Accuracy: ±${Math.round(accuracy)}m</p>
    `;
    
    elements.createLocationInfo.innerHTML = `
        <div style="font-size: 0.875rem; color: var(--text-secondary);">
            <p>Lat: ${lat.toFixed(6)}°</p>
            <p>Lng: ${lng.toFixed(6)}°</p>
        </div>
    `;
}

// ========================================
// Distance Calculation
// ========================================
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function getNearbyNotes() {
    if (!AppState.userLocation) return [];
    
    return AppState.notes.filter(note => {
        const distance = calculateDistance(
            AppState.userLocation.lat,
            AppState.userLocation.lng,
            note.location.lat,
            note.location.lng
        );
        return distance <= NEARBY_RADIUS;
    }).sort((a, b) => {
        const distA = calculateDistance(
            AppState.userLocation.lat,
            AppState.userLocation.lng,
            a.location.lat,
            a.location.lng
        );
        const distB = calculateDistance(
            AppState.userLocation.lat,
            AppState.userLocation.lng,
            b.location.lat,
            b.location.lng
        );
        return distA - distB;
    });
}

// ========================================
// UI Update Functions
// ========================================
function updateNearbyNotes() {
    const nearbyNotes = getNearbyNotes();
    
    if (nearbyNotes.length > 0) {
        elements.nearbySection.classList.remove('hidden');
        elements.emptyState.style.display = 'none';
        renderNotesList(nearbyNotes, elements.nearbyNotesList);
    } else {
        elements.nearbySection.classList.add('hidden');
        elements.emptyState.style.display = 'block';
    }
    
    updateARView(nearbyNotes);
}

function updateNotesCount() {
    const nearbyCount = getNearbyNotes().length;
    elements.countText.textContent = `${nearbyCount} nearby`;
}

function renderNotesList(notes, container) {
    if (notes.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = notes.map(note => {
        const distance = AppState.userLocation ? Math.round(calculateDistance(
            AppState.userLocation.lat,
            AppState.userLocation.lng,
            note.location.lat,
            note.location.lng
        )) : 0;
        
        const date = new Date(note.timestamp);
        const timeAgo = getTimeAgo(date);
        
        return `
            <div class="note-card" data-note-id="${note.id}">
                <div class="note-header">
                    <div class="note-meta">
                        <span class="note-badge ${note.isPrivate ? 'private' : 'public'}">
                            ${note.isPrivate ? '🔒' : '🌐'}
                            ${note.isPrivate ? 'Private' : 'Public'}
                        </span>
                        <span class="note-distance">📍 ${distance}m</span>
                    </div>
                    <button class="delete-btn" onclick="handleDeleteNote('${note.id}')">
                        🗑️ Delete
                    </button>
                </div>
                <p class="note-text">${escapeHtml(note.text)}</p>
                <div class="note-footer">
                    <span>${timeAgo}</span>
                </div>
            </div>
        `;
    }).join('');
}

function updateARView(notes) {
    if (AppState.currentView !== 'ar') return;
    
    elements.arOverlay.innerHTML = '';
    
    if (notes.length === 0) {
        elements.arEmpty.style.display = 'block';
        return;
    }
    
    elements.arEmpty.style.display = 'none';
    
    notes.forEach((note, index) => {
        const distance = Math.round(calculateDistance(
            AppState.userLocation.lat,
            AppState.userLocation.lng,
            note.location.lat,
            note.location.lng
        ));
        
        const arNote = document.createElement('div');
        arNote.className = 'ar-note';
        arNote.style.left = `${10 + (index * 15) % 70}%`;
        arNote.style.top = `${20 + (index * 20) % 50}%`;
        
        arNote.innerHTML = `
            <div class="ar-note-header">
                ${note.isPrivate ? '🔒' : '🌐'}
                <span>${distance}m away</span>
            </div>
            <div class="ar-note-text">${escapeHtml(note.text)}</div>
        `;
        
        elements.arOverlay.appendChild(arNote);
    });
}

function updateAllNotesList() {
    if (AppState.notes.length === 0) {
        elements.allNotesList.innerHTML = '';
        elements.listEmpty.style.display = 'block';
        return;
    }
    
    elements.listEmpty.style.display = 'none';
    
    const sortedNotes = [...AppState.notes].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    renderNotesList(sortedNotes, elements.allNotesList);
}

// ========================================
// View Navigation
// ========================================
function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    
    // Update navigation
    elements.navBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === viewName) {
            btn.classList.add('active');
        }
    });
    
    // Show selected view
    const viewMap = {
        'map': elements.mapView,
        'ar': elements.arView,
        'create': elements.createView,
        'list': elements.listView
    };
    
    if (viewMap[viewName]) {
        viewMap[viewName].classList.add('active');
        AppState.currentView = viewName;
    }
    
    // Handle view-specific logic
    if (viewName === 'ar') {
        startCamera();
    } else {
        stopCamera();
    }
    
    if (viewName === 'list') {
        updateAllNotesList();
    }
    
    if (viewName === 'create') {
        updateLocationDisplay();
    }
}

// ========================================
// Camera Functions
// ========================================
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        });
        
        elements.cameraFeed.srcObject = stream;
        AppState.cameraStream = stream;
        
        updateARView(getNearbyNotes());
    } catch (err) {
        console.error('📷 Camera access denied:', err);
        showToast('Camera access required for AR view', 'error');
        switchView('map');
    }
}

function stopCamera() {
    if (AppState.cameraStream) {
        AppState.cameraStream.getTracks().forEach(track => track.stop());
        AppState.cameraStream = null;
        elements.cameraFeed.srcObject = null;
    }
}

// ========================================
// Create Note Functions
// ========================================
function handleNoteTextChange() {
    const text = elements.noteText.value;
    const length = text.length;
    
    elements.charCount.textContent = length;
    elements.charCount.style.color = length > 280 ? '#ef4444' : 'var(--text-muted)';
    
    elements.saveNoteBtn.disabled = !text.trim() || length > 280 || !AppState.userLocation;
}

function handlePrivacyToggle() {
    const isPrivate = elements.privateToggle.checked;
    elements.privacyIcon.textContent = isPrivate ? '🔒' : '🌐';
    elements.privacyText.textContent = isPrivate ? 'Private Note' : 'Public Note';
}

async function handleSaveNote() {
    const text = elements.noteText.value.trim();
    
    if (!text || !AppState.userLocation) {
        showToast('Cannot save note', 'error');
        return;
    }
    
    const note = {
        id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: text,
        location: { ...AppState.userLocation },
        isPrivate: elements.privateToggle.checked,
        timestamp: new Date().toISOString(),
        author: 'You'
    };
    
    elements.saveNoteBtn.disabled = true;
    elements.saveNoteBtn.innerHTML = '<span class="icon">⏳</span> Saving...';
    
    const success = await saveNote(note);
    
    if (success) {
        showToast('Note saved successfully!', 'success');
        elements.noteText.value = '';
        elements.privateToggle.checked = false;
        handlePrivacyToggle();
        handleNoteTextChange();
        updateNearbyNotes();
        updateNotesCount();
        switchView('map');
    }
    
    elements.saveNoteBtn.innerHTML = '<span class="icon">💾</span> Save Note';
}

async function handleDeleteNote(noteId) {
    if (!confirm('Delete this note?')) return;
    
    const success = await deleteNote(noteId);
    
    if (success) {
        showToast('Note deleted', 'info');
        updateNearbyNotes();
        updateNotesCount();
        updateAllNotesList();
    }
}

// Make delete function globally accessible
window.handleDeleteNote = handleDeleteNote;

// ========================================
// Event Listeners
// ========================================
function setupEventListeners() {
    // Navigation
    elements.navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            switchView(btn.dataset.view);
        });
    });
    
    // Create note
    elements.noteText.addEventListener('input', handleNoteTextChange);
    elements.privateToggle.addEventListener('change', handlePrivacyToggle);
    elements.saveNoteBtn.addEventListener('click', handleSaveNote);
    
    // Install prompt
    elements.installBtn.addEventListener('click', handleInstallClick);
    elements.dismissBtn.addEventListener('click', () => {
        elements.installPrompt.classList.add('hidden');
    });
}

// ========================================
// PWA Functions
// ========================================
function setupPWA() {
    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(reg => {
            console.log('✅ Service Worker registered');
        }).catch(err => {
            console.error('❌ Service Worker registration failed:', err);
        });
    }
    
    // Handle install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        AppState.deferredPrompt = e;
        elements.installPrompt.classList.remove('hidden');
    });
    
    // Handle app installed
    window.addEventListener('appinstalled', () => {
        console.log('✅ App installed');
        AppState.deferredPrompt = null;
        elements.installPrompt.classList.add('hidden');
        showToast('App installed successfully!', 'success');
    });
}

async function handleInstallClick() {
    if (!AppState.deferredPrompt) return;
    
    AppState.deferredPrompt.prompt();
    const { outcome } = await AppState.deferredPrompt.userChoice;
    
    console.log(`Install outcome: ${outcome}`);
    AppState.deferredPrompt = null;
    elements.installPrompt.classList.add('hidden');
}

// ========================================
// Utility Functions
// ========================================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideUp 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// Cleanup
// ========================================
window.addEventListener('beforeunload', () => {
    if (AppState.watchId) {
        navigator.geolocation.clearWatch(AppState.watchId);
    }
    stopCamera();
});

// ========================================
// Start App
// ========================================
document.addEventListener('DOMContentLoaded', init);