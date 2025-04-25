// Default settings values - use unique name to avoid conflict with background.js
const SETTINGS_DEFAULT_VALUES = {
  // General settings
  showNotifications: true,
  confirmRefresh: true,
  defaultInterval: 30,
  startupRefreshMode: true,
  
  // Display settings
  theme: 'system',
  enableSoundEffects: true,
  enableTickingSound: true,
  
  // Behavior settings
  skipErrorPages: false,
  pauseOnFocus: false,
  smartRefresh: false,
  
  // Advanced settings
  enableResourceMonitoring: false,
  resourceCheckInterval: 5,
  blockAds: false,
  developerMode: false,
  
  // Ad preferences
  adPreferences: {
    enabled: true,
    frequency: 'medium', // low, medium, high, minimal
    minimalTracking: false,
    optOut: false
  }
};

// DOM elements
const elements = {
  // Tabs
  tabButtons: document.querySelectorAll('.tab-button'),
  tabContents: document.querySelectorAll('.tab-content'),

  // General settings
  showNotifications: document.getElementById('showNotifications'),
  defaultInterval: document.getElementById('defaultInterval'),
  startupRefreshMode: document.getElementById('startupRefreshMode'),
  
  // Display settings
  themeSelector: document.getElementById('themeSelector'),
  themeToggle: document.getElementById('themeToggle'),
  darkIcon: document.getElementById('darkIcon'),
  lightIcon: document.getElementById('lightIcon'),
  enableSoundEffects: document.getElementById('enableSoundEffects'),
  enableTickingSound: document.getElementById('enableTickingSound'),
  previewSound: document.getElementById('previewSound'),
  
  // Behavior settings
  confirmRefresh: document.getElementById('confirmRefresh'),
  skipErrorPages: document.getElementById('skipErrorPages'),
  pauseOnFocus: document.getElementById('pauseOnFocus'),
  smartRefresh: document.getElementById('smartRefresh'),
  
  // Advanced settings
  enableResourceMonitoring: document.getElementById('enableResourceMonitoring'),
  resourceCheckInterval: document.getElementById('resourceCheckInterval'),
  blockAds: document.getElementById('blockAds'),
  developerMode: document.getElementById('developerMode'),
  
  // Ad preferences
  adPreferences: document.getElementById('ad-preferences'),
  adEnabled: document.getElementById('ad-enabled'),
  adFrequency: document.getElementById('ad-frequency'),
  minimalTracking: document.getElementById('minimal-tracking'),
  analyticsOptOut: document.getElementById('analytics-opt-out'),
  
  // Action buttons
  saveButton: document.getElementById('saveButton'),
  resetButton: document.getElementById('resetButton'),
  statusMessage: document.getElementById('statusMessage')
};

// Audio elements for sound preview
let previewAudio = null;

// Load settings when the page loads
document.addEventListener('DOMContentLoaded', () => {
  setupTabNavigation();
  setupThemeToggle();
  setupSoundControls();
  setupInputValidation();
  loadSettings();
});

// Setup tab navigation
function setupTabNavigation() {
  elements.tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTabId = button.getAttribute('data-tab');
      
      // Update active tab button
      elements.tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Show appropriate tab content
      elements.tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === targetTabId) {
          content.classList.add('active');
        }
      });
    });
  });
}

// Setup theme toggle and selector
function setupThemeToggle() {
  // Theme toggle button click handler
  elements.themeToggle.addEventListener('click', () => {
    if (document.body.classList.contains('dark-mode')) {
      applyTheme('light');
      elements.themeSelector.value = 'light';
    } else {
      applyTheme('dark');
      elements.themeSelector.value = 'dark';
    }
  });
  
  // Theme selector change handler
  elements.themeSelector.addEventListener('change', () => {
    applyTheme(elements.themeSelector.value);
  });
  
  // Check system preference initially
  checkSystemTheme();
}

// Apply theme based on selection
function applyTheme(theme) {
  if (theme === 'system') {
    checkSystemTheme();
  } else if (theme === 'dark') {
    document.body.classList.add('dark-mode');
    elements.darkIcon.style.display = 'none';
    elements.lightIcon.style.display = 'block';
  } else {
    document.body.classList.remove('dark-mode');
    elements.darkIcon.style.display = 'block';
    elements.lightIcon.style.display = 'none';
  }
  
  // Save theme setting
  const currentSettings = getCurrentSettings();
  currentSettings.theme = theme;
  chrome.storage.sync.set({ 'autoRefreshSettings': currentSettings });
}

// Check system dark mode preference
function checkSystemTheme() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('dark-mode');
    elements.darkIcon.style.display = 'none';
    elements.lightIcon.style.display = 'block';
  } else {
    document.body.classList.remove('dark-mode');
    elements.darkIcon.style.display = 'block';
    elements.lightIcon.style.display = 'none';
  }
  
  // Add listener for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (elements.themeSelector.value === 'system') {
      if (e.matches) {
        document.body.classList.add('dark-mode');
        elements.darkIcon.style.display = 'none';
        elements.lightIcon.style.display = 'block';
      } else {
        document.body.classList.remove('dark-mode');
        elements.darkIcon.style.display = 'block';
        elements.lightIcon.style.display = 'none';
      }
    }
  });
}

// Setup sound control functionality
function setupSoundControls() {
  // Preview sound button
  elements.previewSound.addEventListener('click', () => {
    // Stop any currently playing preview
    if (previewAudio) {
      previewAudio.pause();
      previewAudio = null;
    }
    
    // Play a random ticking sound
    const randomSound = getRandomTickingSound();
    
    // Create and play audio
    previewAudio = new Audio(`sounds/${randomSound}`);
    previewAudio.play();
    
    // Show notification
    showNotification('Playing random ticking sound preview...');
  });
}

// Get a random ticking sound
function getRandomTickingSound() {
  const sounds = ['ticking_1.mp3', 'ticking_2.mp3', 'ticking_3.mp3', 'ticking_4.mp3', 'ticking_5.mp3'];
  const randomIndex = Math.floor(Math.random() * sounds.length);
  return sounds[randomIndex];
}

// Setup validation for number inputs
function setupInputValidation() {
  const defaultIntervalInput = elements.defaultInterval;
  const resourceCheckInput = elements.resourceCheckInterval;
  
  defaultIntervalInput.addEventListener('input', () => {
    validateNumberInput(defaultIntervalInput, 1, 86400);
  });
  
  resourceCheckInput.addEventListener('input', () => {
    validateNumberInput(resourceCheckInput, 1, 60);
  });
}

// Validate number inputs are within range
function validateNumberInput(inputElement, min, max) {
  const value = parseInt(inputElement.value);
  
  if (isNaN(value) || value < min || value > max) {
    inputElement.setCustomValidity(`Please enter a value between ${min} and ${max}`);
  } else {
    inputElement.setCustomValidity('');
  }
}

// Add event listeners for buttons
elements.saveButton.addEventListener('click', saveSettings);
elements.resetButton.addEventListener('click', resetToDefaults);

// Function to load settings from storage
function loadSettings() {
  chrome.storage.sync.get('autoRefreshSettings', (data) => {
    const settings = data.autoRefreshSettings || SETTINGS_DEFAULT_VALUES;
    
    // General settings
    elements.showNotifications.checked = settings.showNotifications;
    elements.defaultInterval.value = settings.defaultInterval;
    elements.startupRefreshMode.checked = settings.startupRefreshMode;
    
    // Display settings
    elements.themeSelector.value = settings.theme || 'system';
    applyTheme(settings.theme || 'system');
    elements.enableSoundEffects.checked = settings.enableSoundEffects !== undefined ? 
      settings.enableSoundEffects : SETTINGS_DEFAULT_VALUES.enableSoundEffects;
    elements.enableTickingSound.checked = settings.enableTickingSound !== undefined ? 
      settings.enableTickingSound : SETTINGS_DEFAULT_VALUES.enableTickingSound;
    
    // Behavior settings
    elements.confirmRefresh.checked = settings.confirmRefresh;
    if (elements.skipErrorPages) {
      elements.skipErrorPages.checked = settings.skipErrorPages !== undefined ? 
        settings.skipErrorPages : SETTINGS_DEFAULT_VALUES.skipErrorPages;
    }
    if (elements.pauseOnFocus) {
      elements.pauseOnFocus.checked = settings.pauseOnFocus !== undefined ? 
        settings.pauseOnFocus : SETTINGS_DEFAULT_VALUES.pauseOnFocus;
    }
    if (elements.smartRefresh) {
      elements.smartRefresh.checked = settings.smartRefresh !== undefined ? 
        settings.smartRefresh : SETTINGS_DEFAULT_VALUES.smartRefresh;
    }
    
    // Advanced settings
    elements.enableResourceMonitoring.checked = settings.enableResourceMonitoring;
    elements.resourceCheckInterval.value = settings.resourceCheckInterval;
    if (elements.blockAds) {
      elements.blockAds.checked = settings.blockAds !== undefined ? 
        settings.blockAds : SETTINGS_DEFAULT_VALUES.blockAds;
    }
    if (elements.developerMode) {
      elements.developerMode.checked = settings.developerMode !== undefined ? 
        settings.developerMode : SETTINGS_DEFAULT_VALUES.developerMode;
    }
    
    // Ad preferences
    if (elements.adEnabled) {
      elements.adEnabled.checked = settings.adPreferences.enabled;
    }
    
    if (elements.adFrequency) {
      elements.adFrequency.value = settings.adPreferences.frequency;
    }
    
    if (elements.minimalTracking) {
      elements.minimalTracking.checked = settings.adPreferences.minimalTracking;
    }
    
    if (elements.analyticsOptOut) {
      elements.analyticsOptOut.checked = settings.adPreferences.optOut;
    }
  });
}

// Get current settings from form
function getCurrentSettings() {
  // Start with default values to ensure all properties exist
  const currentSettings = { ...SETTINGS_DEFAULT_VALUES };
  
  // General settings
  currentSettings.showNotifications = elements.showNotifications.checked;
  currentSettings.defaultInterval = parseInt(elements.defaultInterval.value) || SETTINGS_DEFAULT_VALUES.defaultInterval;
  currentSettings.startupRefreshMode = elements.startupRefreshMode.checked;
  
  // Display settings
  currentSettings.theme = elements.themeSelector.value;
  currentSettings.enableSoundEffects = elements.enableSoundEffects.checked;
  currentSettings.enableTickingSound = elements.enableTickingSound.checked;
  
  // Behavior settings
  currentSettings.confirmRefresh = elements.confirmRefresh.checked;
  if (elements.skipErrorPages) {
    currentSettings.skipErrorPages = elements.skipErrorPages.checked;
  }
  if (elements.pauseOnFocus) {
    currentSettings.pauseOnFocus = elements.pauseOnFocus.checked;
  }
  if (elements.smartRefresh) {
    currentSettings.smartRefresh = elements.smartRefresh.checked;
  }
  
  // Advanced settings
  currentSettings.enableResourceMonitoring = elements.enableResourceMonitoring.checked;
  currentSettings.resourceCheckInterval = parseInt(elements.resourceCheckInterval.value) || 
    SETTINGS_DEFAULT_VALUES.resourceCheckInterval;
  if (elements.blockAds) {
    currentSettings.blockAds = elements.blockAds.checked;
  }
  if (elements.developerMode) {
    currentSettings.developerMode = elements.developerMode.checked;
  }
  
  // Ad preferences
  currentSettings.adPreferences.enabled = elements.adEnabled.checked;
  currentSettings.adPreferences.frequency = elements.adFrequency.value;
  currentSettings.adPreferences.minimalTracking = elements.minimalTracking.checked;
  currentSettings.adPreferences.optOut = elements.analyticsOptOut.checked;
  
  return currentSettings;
}

// Function to save settings
function saveSettings() {
  // Validate inputs before saving
  if (!elements.defaultInterval.checkValidity() || !elements.resourceCheckInterval.checkValidity()) {
    showStatusMessage('Please correct the errors before saving.', 'error');
    return;
  }
  
  const newSettings = getCurrentSettings();
  
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
  // Create a notification to confirm reset
  if (confirm('Are you sure you want to reset all settings to default values?')) {
    // Apply default settings to the form
    
    // General settings
    elements.showNotifications.checked = SETTINGS_DEFAULT_VALUES.showNotifications;
    elements.defaultInterval.value = SETTINGS_DEFAULT_VALUES.defaultInterval;
    elements.startupRefreshMode.checked = SETTINGS_DEFAULT_VALUES.startupRefreshMode;
    
    // Display settings
    elements.themeSelector.value = SETTINGS_DEFAULT_VALUES.theme;
    applyTheme(SETTINGS_DEFAULT_VALUES.theme);
    elements.enableSoundEffects.checked = SETTINGS_DEFAULT_VALUES.enableSoundEffects;
    elements.enableTickingSound.checked = SETTINGS_DEFAULT_VALUES.enableTickingSound;
    
    // Behavior settings
    elements.confirmRefresh.checked = SETTINGS_DEFAULT_VALUES.confirmRefresh;
    if (elements.skipErrorPages) {
      elements.skipErrorPages.checked = SETTINGS_DEFAULT_VALUES.skipErrorPages;
    }
    if (elements.pauseOnFocus) {
      elements.pauseOnFocus.checked = SETTINGS_DEFAULT_VALUES.pauseOnFocus;
    }
    if (elements.smartRefresh) {
      elements.smartRefresh.checked = SETTINGS_DEFAULT_VALUES.smartRefresh;
    }
    
    // Advanced settings
    elements.enableResourceMonitoring.checked = SETTINGS_DEFAULT_VALUES.enableResourceMonitoring;
    elements.resourceCheckInterval.value = SETTINGS_DEFAULT_VALUES.resourceCheckInterval;
    if (elements.blockAds) {
      elements.blockAds.checked = SETTINGS_DEFAULT_VALUES.blockAds;
    }
    if (elements.developerMode) {
      elements.developerMode.checked = SETTINGS_DEFAULT_VALUES.developerMode;
    }
    
    // Ad preferences
    if (elements.adEnabled) {
      elements.adEnabled.checked = SETTINGS_DEFAULT_VALUES.adPreferences.enabled;
    }
    
    if (elements.adFrequency) {
      elements.adFrequency.value = SETTINGS_DEFAULT_VALUES.adPreferences.frequency;
    }
    
    if (elements.minimalTracking) {
      elements.minimalTracking.checked = SETTINGS_DEFAULT_VALUES.adPreferences.minimalTracking;
    }
    
    if (elements.analyticsOptOut) {
      elements.analyticsOptOut.checked = SETTINGS_DEFAULT_VALUES.adPreferences.optOut;
    }
    
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

// Function to show a notification banner
function showNotification(message, duration = 3000) {
  // Remove any existing notification
  const existingNotification = document.querySelector('.notification-banner');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'notification-banner';
  notification.textContent = message;
  
  // Add to body
  document.body.appendChild(notification);
  
  // Remove after duration
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, duration);
}