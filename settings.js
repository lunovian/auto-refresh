// Default settings values - use unique name to avoid conflict with background.js
const SETTINGS_DEFAULT_VALUES = {
  showNotifications: true,
  confirmRefresh: true,
  defaultInterval: 30,
  enableResourceMonitoring: false,
  resourceCheckInterval: 5,
  startupRefreshMode: true,
  enableSoundEffects: true,
  enableTickingSound: true // Add new setting for ticking sound
};

// DOM elements
const elements = {
  showNotifications: document.getElementById('showNotifications'),
  confirmRefresh: document.getElementById('confirmRefresh'),
  defaultInterval: document.getElementById('defaultInterval'),
  enableResourceMonitoring: document.getElementById('enableResourceMonitoring'),
  resourceCheckInterval: document.getElementById('resourceCheckInterval'),
  startupRefreshMode: document.getElementById('startupRefreshMode'),
  saveButton: document.getElementById('saveButton'),
  resetButton: document.getElementById('resetButton'),
  statusMessage: document.getElementById('statusMessage'),
  enableSoundEffects: document.getElementById('enableSoundEffects'),
  enableTickingSound: document.getElementById('enableTickingSound')
};

// Load settings when the page loads
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
});

// Add event listeners for buttons
elements.saveButton.addEventListener('click', saveSettings);
elements.resetButton.addEventListener('click', resetToDefaults);

// Function to load settings from storage
function loadSettings() {
  chrome.storage.sync.get('autoRefreshSettings', (data) => {
    const settings = data.autoRefreshSettings || SETTINGS_DEFAULT_VALUES;
    
    // Populate form with saved settings
    elements.showNotifications.checked = settings.showNotifications;
    elements.confirmRefresh.checked = settings.confirmRefresh;
    elements.defaultInterval.value = settings.defaultInterval;
    elements.enableResourceMonitoring.checked = settings.enableResourceMonitoring;
    elements.resourceCheckInterval.value = settings.resourceCheckInterval;
    elements.startupRefreshMode.checked = settings.startupRefreshMode;
    elements.enableSoundEffects.checked = settings.enableSoundEffects !== undefined ? 
      settings.enableSoundEffects : SETTINGS_DEFAULT_VALUES.enableSoundEffects;
    
    // Set new ticking sound option
    if (elements.enableTickingSound) {
      elements.enableTickingSound.checked = settings.enableTickingSound !== undefined ? 
        settings.enableTickingSound : SETTINGS_DEFAULT_VALUES.enableTickingSound;
    }
  });
}

// Function to save settings
function saveSettings() {
  const newSettings = {
    showNotifications: elements.showNotifications.checked,
    confirmRefresh: elements.confirmRefresh.checked,
    defaultInterval: parseInt(elements.defaultInterval.value) || SETTINGS_DEFAULT_VALUES.defaultInterval,
    enableResourceMonitoring: elements.enableResourceMonitoring.checked,
    resourceCheckInterval: parseInt(elements.resourceCheckInterval.value) || SETTINGS_DEFAULT_VALUES.resourceCheckInterval,
    startupRefreshMode: elements.startupRefreshMode.checked,
    enableSoundEffects: elements.enableSoundEffects.checked,
    enableTickingSound: elements.enableTickingSound ? elements.enableTickingSound.checked : SETTINGS_DEFAULT_VALUES.enableTickingSound
  };
  
  // Validate input values
  if (newSettings.defaultInterval < 1) {
    newSettings.defaultInterval = SETTINGS_DEFAULT_VALUES.defaultInterval;
    elements.defaultInterval.value = SETTINGS_DEFAULT_VALUES.defaultInterval;
  }
  
  if (newSettings.resourceCheckInterval < 1) {
    newSettings.resourceCheckInterval = SETTINGS_DEFAULT_VALUES.resourceCheckInterval;
    elements.resourceCheckInterval.value = SETTINGS_DEFAULT_VALUES.resourceCheckInterval;
  }
  
  // Save to Chrome storage
  chrome.storage.sync.set({ 'autoRefreshSettings': newSettings }, () => {
    // Show success message
    showStatusMessage('Settings saved successfully! Reloading extension...', 'success');
    
    // Notify background script about settings change
    chrome.runtime.sendMessage({
      action: 'settingsUpdated',
      settings: newSettings,
      reload: true
    });
    
    // Add small delay before reload to allow the message to be shown
    setTimeout(() => {
      chrome.runtime.reload();
    }, 1500);
  });
}

// Function to reset settings to defaults
function resetToDefaults() {
  // Apply default settings to the form
  elements.showNotifications.checked = SETTINGS_DEFAULT_VALUES.showNotifications;
  elements.confirmRefresh.checked = SETTINGS_DEFAULT_VALUES.confirmRefresh;
  elements.defaultInterval.value = SETTINGS_DEFAULT_VALUES.defaultInterval;
  elements.enableResourceMonitoring.checked = SETTINGS_DEFAULT_VALUES.enableResourceMonitoring;
  elements.resourceCheckInterval.value = SETTINGS_DEFAULT_VALUES.resourceCheckInterval;
  elements.startupRefreshMode.checked = SETTINGS_DEFAULT_VALUES.startupRefreshMode;
  elements.enableSoundEffects.checked = SETTINGS_DEFAULT_VALUES.enableSoundEffects;
  elements.enableTickingSound.checked = SETTINGS_DEFAULT_VALUES.enableTickingSound;
  
  // Save default settings
  chrome.storage.sync.set({ 'autoRefreshSettings': SETTINGS_DEFAULT_VALUES }, () => {
    showStatusMessage('Settings reset to defaults. Reloading extension...', 'success');
    
    // Notify background script about settings change
    chrome.runtime.sendMessage({
      action: 'settingsUpdated',
      settings: SETTINGS_DEFAULT_VALUES,
      reload: true
    });
    
    // Add small delay before reload to allow the message to be shown
    setTimeout(() => {
      chrome.runtime.reload();
    }, 1500);
  });
}

// Function to show status messages
function showStatusMessage(message, type) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status ${type}`;
  
  // Hide the message after 3 seconds
  setTimeout(() => {
    elements.statusMessage.className = 'status';
  }, 3000);
}