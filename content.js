// Content script for Auto-Refresh extension
let resourceMonitoring = false;
let formProtectionEnabled = false;
let monitoredResources = [];
let resourceLastModified = new Map();
let formsWithChanges = new Set();

// Track which resources have changed since monitoring started
const changedResourcesTracker = new Set();

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startResourceMonitoring') {
        startResourceMonitoring(message.resources);
        sendResponse({ success: true });
        return true;
    }
    
    if (message.action === 'stopResourceMonitoring') {
        stopResourceMonitoring();
        sendResponse({ success: true });
        return true;
    }
    
    if (message.action === 'enableFormProtection') {
        enableFormProtection();
        sendResponse({ success: true });
        return true;
    }
    
    if (message.action === 'disableFormProtection') {
        disableFormProtection();
        sendResponse({ success: true });
        return true;
    }
    
    if (message.action === 'checkFormStatus') {
        sendResponse({ 
            hasUnsavedChanges: formsWithChanges.size > 0,
            formCount: formsWithChanges.size
        });
        return true;
    }
    
    if (message.action === 'checkResourceStatus') {
        sendResponse({
            isMonitoring: resourceMonitoring,
            resources: Array.from(monitoredResources),
            changedResources: getChangedResources()
        });
        return true;
    }
});

// Resource Monitoring Feature
function startResourceMonitoring(resources) {
    stopResourceMonitoring(); // Clear any existing monitoring
    
    if (!resources || resources.length === 0) {
        // Default to monitoring all stylesheets and scripts if no specific resources provided
        const allLinks = document.querySelectorAll('link[rel="stylesheet"], script[src]');
        resources = Array.from(allLinks).map(el => el.href || el.src).filter(url => url);
    }
    
    monitoredResources = resources;
    resourceMonitoring = true;
    
    // Initialize with current resource timestamps
    checkResourcesForChanges();
    
    // Set up periodic checking
    window._resourceCheckInterval = setInterval(checkResourcesForChanges, 5000);
    
    console.log('Resource monitoring started for:', resources);
}

function stopResourceMonitoring() {
    if (window._resourceCheckInterval) {
        clearInterval(window._resourceCheckInterval);
        window._resourceCheckInterval = null;
    }
    resourceMonitoring = false;
    monitoredResources = [];
    resourceLastModified.clear();
    changedResourcesTracker.clear();
}

function checkResourcesForChanges() {
    if (!resourceMonitoring || monitoredResources.length === 0) return;
    
    monitoredResources.forEach(url => {
        fetch(url, { 
            method: 'HEAD',
            cache: 'no-store'
        })
        .then(response => {
            if (!response.ok) throw new Error('Resource fetch failed');
            
            const lastModified = response.headers.get('last-modified');
            const etag = response.headers.get('etag');
            
            // Generate a resource identifier
            const resourceId = lastModified || etag || Date.now().toString();
            
            // Check if we have a previous version to compare against
            if (resourceLastModified.has(url) && 
                resourceLastModified.get(url) !== resourceId) {
                // Resource has changed
                console.log('Resource changed:', url);
                
                // Add to changed resources tracker
                changedResourcesTracker.add(url);
                
                // Check if we can refresh
                if (formProtectionEnabled && formsWithChanges.size > 0) {
                    console.log('Refresh prevented due to unsaved form changes');
                    
                    // Notify the user about the pending refresh
                    chrome.runtime.sendMessage({
                        action: 'refreshPending',
                        reason: 'Resource updated but forms have unsaved changes'
                    });
                } else {
                    // Safe to refresh
                    chrome.runtime.sendMessage({
                        action: 'resourceChanged',
                        url: url
                    });
                }
            }
            
            // Store the current resource identifier
            resourceLastModified.set(url, resourceId);
        })
        .catch(error => console.warn(`Failed to check resource ${url}:`, error));
    });
}

function getChangedResources() {
    return Array.from(changedResourcesTracker);
}

// Form Protection Feature
function enableFormProtection() {
    disableFormProtection(); // Clear any existing handlers
    
    formProtectionEnabled = true;
    formsWithChanges.clear();
    
    // Monitor for changes in form input elements
    document.addEventListener('input', handleFormInput);
    document.addEventListener('change', handleFormChange);
    
    // Find all forms and add submit listeners to clear their "unsaved" status
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', handleFormSubmit);
    });
    
    console.log('Form protection enabled');
}

function disableFormProtection() {
    if (formProtectionEnabled) {
        document.removeEventListener('input', handleFormInput);
        document.removeEventListener('change', handleFormChange);
        
        document.querySelectorAll('form').forEach(form => {
            form.removeEventListener('submit', handleFormSubmit);
        });
        
        formProtectionEnabled = false;
        formsWithChanges.clear();
        console.log('Form protection disabled');
    }
}

function handleFormInput(event) {
    if (!formProtectionEnabled) return;
    
    const form = event.target.closest('form');
    if (form) {
        formsWithChanges.add(form);
        
        // Notify the extension about form state
        chrome.runtime.sendMessage({
            action: 'formStateChanged',
            hasUnsavedChanges: true,
            formCount: formsWithChanges.size
        });
    }
}

function handleFormChange(event) {
    if (!formProtectionEnabled) return;
    
    // Handle changes to select dropdowns, checkboxes, etc.
    const form = event.target.closest('form');
    if (form) {
        formsWithChanges.add(form);
        
        chrome.runtime.sendMessage({
            action: 'formStateChanged',
            hasUnsavedChanges: true,
            formCount: formsWithChanges.size
        });
    }
}

function handleFormSubmit(event) {
    if (!formProtectionEnabled) return;
    
    // Remove the form from our unsaved changes set
    formsWithChanges.delete(event.target);
    
    // Notify the extension
    chrome.runtime.sendMessage({
        action: 'formStateChanged',
        hasUnsavedChanges: formsWithChanges.size > 0,
        formCount: formsWithChanges.size
    });
}

// Initialize when content script loads
function initialize() {
    // Check if we should restore monitoring based on extension state
    chrome.runtime.sendMessage({ action: 'getContentScriptState' }, response => {
        // Handle chrome.runtime.lastError to prevent uncaught errors
        if (chrome.runtime.lastError) {
            console.warn('Failed to get content script state:', chrome.runtime.lastError.message);
            return;
        }
        
        if (response && response.resourceMonitoring) {
            startResourceMonitoring(response.monitoredResources);
        }
        
        if (response && response.formProtection) {
            enableFormProtection();
        }
    });
}

initialize();