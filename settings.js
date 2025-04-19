// Default settings values
const DEFAULT_SETTINGS = {
  showNotifications: true,
  confirmRefresh: true,
  defaultInterval: 30,
  enableResourceMonitoring: false,
  resourceCheckInterval: 5,
  startupRefreshMode: true
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
  statusMessage: document.getElementById('statusMessage')
};

// Load settings when the page loads
document.addEventListener('DOMContentLoaded', loadSettings);

// Add event listeners for buttons
elements.saveButton.addEventListener('click', saveSettings);
elements.resetButton.addEventListener('click', resetToDefaults);

// Function to load settings from storage
function loadSettings() {
  chrome.storage.sync.get('autoRefreshSettings', (data) => {
    const settings = data.autoRefreshSettings || DEFAULT_SETTINGS;
    
    // Populate form with saved settings
    elements.showNotifications.checked = settings.showNotifications;
    elements.confirmRefresh.checked = settings.confirmRefresh;
    elements.defaultInterval.value = settings.defaultInterval;
    elements.enableResourceMonitoring.checked = settings.enableResourceMonitoring;
    elements.resourceCheckInterval.value = settings.resourceCheckInterval;
    elements.startupRefreshMode.checked = settings.startupRefreshMode;
  });
}

// Function to save settings
function saveSettings() {
  const newSettings = {
    showNotifications: elements.showNotifications.checked,
    confirmRefresh: elements.confirmRefresh.checked,
    defaultInterval: parseInt(elements.defaultInterval.value) || DEFAULT_SETTINGS.defaultInterval,
    enableResourceMonitoring: elements.enableResourceMonitoring.checked,
    resourceCheckInterval: parseInt(elements.resourceCheckInterval.value) || DEFAULT_SETTINGS.resourceCheckInterval,
    startupRefreshMode: elements.startupRefreshMode.checked
  };
  
  // Validate input values
  if (newSettings.defaultInterval < 1) {
    newSettings.defaultInterval = DEFAULT_SETTINGS.defaultInterval;
    elements.defaultInterval.value = DEFAULT_SETTINGS.defaultInterval;
  }
  
  if (newSettings.resourceCheckInterval < 1) {
    newSettings.resourceCheckInterval = DEFAULT_SETTINGS.resourceCheckInterval;
    elements.resourceCheckInterval.value = DEFAULT_SETTINGS.resourceCheckInterval;
  }
  
  // Save to Chrome storage
  chrome.storage.sync.set({ 'autoRefreshSettings': newSettings }, () => {
    // Show success message
    showStatusMessage('Settings saved successfully!', 'success');
    
    // Notify background script about settings change
    chrome.runtime.sendMessage({
      action: 'settingsUpdated',
      settings: newSettings
    });
  });
}

// Function to reset settings to defaults
function resetToDefaults() {
  // Apply default settings to the form
  elements.showNotifications.checked = DEFAULT_SETTINGS.showNotifications;
  elements.confirmRefresh.checked = DEFAULT_SETTINGS.confirmRefresh;
  elements.defaultInterval.value = DEFAULT_SETTINGS.defaultInterval;
  elements.enableResourceMonitoring.checked = DEFAULT_SETTINGS.enableResourceMonitoring;
  elements.resourceCheckInterval.value = DEFAULT_SETTINGS.resourceCheckInterval;
  elements.startupRefreshMode.checked = DEFAULT_SETTINGS.startupRefreshMode;
  
  // Save default settings
  chrome.storage.sync.set({ 'autoRefreshSettings': DEFAULT_SETTINGS }, () => {
    showStatusMessage('Settings reset to defaults', 'success');
    
    // Notify background script about settings change
    chrome.runtime.sendMessage({
      action: 'settingsUpdated',
      settings: DEFAULT_SETTINGS
    });
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