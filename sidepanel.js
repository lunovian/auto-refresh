let activeTab = null;
let refreshMode = "time"; // Default mode
let isRefreshing = false;
let refreshCounter = 0;
let refreshIntervalId = null;
let countdownIntervalId = null;
let nextRefreshTime = 0;
let lastSettings = {};
let isDarkMode = false;

// DOM Elements
document.addEventListener("DOMContentLoaded", () => {
  // Set up mode tabs
  document.getElementById("timeMode").addEventListener("click", () => switchMode("time"));
  document.getElementById("conditionalMode").addEventListener("click", () => switchMode("conditional"));
  
  // Control buttons
  document.getElementById("startRefresh").addEventListener("click", startRefresh);
  document.getElementById("stopRefresh").addEventListener("click", stopRefresh);
  
  // Add settings button handler
  const settingsButton = document.getElementById("settingsButton");
  if (settingsButton) {
    settingsButton.addEventListener("click", openSettings);
  }

  // Add theme toggle
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", toggleDarkMode);
    // Load theme preference
    chrome.storage.sync.get('darkMode', (data) => {
      if (data.darkMode) {
        toggleDarkMode();
      }
    });
  }

  // Setup preset buttons
  setupPresetButtons();
  
  // Setup collapsible sections
  setupCollapsibles();

  // Setup keyboard shortcuts
  setupKeyboardShortcuts();

  // Load current state and settings
  loadSettings();
  
  // Check if refresh is already active for current tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      activeTab = tabs[0];
      updateTabInfo(activeTab);
      checkRefreshStatus();
    }
  });
});

// Toggle dark mode
function toggleDarkMode() {
  isDarkMode = !isDarkMode;
  document.body.classList.toggle('dark-mode', isDarkMode);
  
  // Toggle icons
  document.getElementById('darkIcon').style.display = isDarkMode ? 'none' : 'block';
  document.getElementById('lightIcon').style.display = isDarkMode ? 'block' : 'none';
  
  // Save preference
  chrome.storage.sync.set({ darkMode: isDarkMode });
}

// Set up preset interval buttons
function setupPresetButtons() {
  const presetButtons = document.querySelectorAll('.preset-button');
  presetButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Get the value and unit from data attributes
      const value = button.getAttribute('data-value');
      const unit = button.getAttribute('data-unit');
      
      // Set values in the appropriate input fields based on current mode
      if (refreshMode === 'time') {
        document.getElementById('refreshInterval').value = value;
      } else {
        document.getElementById('refreshInterval_conditional').value = value;
        document.getElementById('refreshIntervalUnit_conditional').value = unit;
      }
      
      // Highlight the selected preset
      presetButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
    });
  });
}

// Set up collapsible sections
function setupCollapsibles() {
  const collapsibles = document.querySelectorAll('.collapsible-header');
  collapsibles.forEach(header => {
    header.addEventListener('click', () => {
      const section = header.parentElement;
      section.classList.toggle('collapsible-open');
    });
  });
}

// Set up keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Alt+R to start refresh
    if (e.altKey && e.key === 'r') {
      e.preventDefault();
      if (!isRefreshing) {
        startRefresh();
      }
    }
    
    // Escape to stop refresh
    if (e.key === 'Escape') {
      if (isRefreshing) {
        stopRefresh();
      }
    }
  });
}

// Update tab info display
function updateTabInfo(tab) {
  if (!tab) return;
  
  const favicon = document.getElementById("tabFavicon");
  const title = document.getElementById("tabTitle");
  const url = document.getElementById("tabUrl");
  
  if (favicon && title && url) {
    favicon.src = tab.favIconUrl || "icons/icon16.png";
    title.textContent = tab.title || "Unknown Page";
    url.textContent = new URL(tab.url).hostname || tab.url;
  }
}

// Refresh now function
function refreshNow() {
  if (!activeTab) return;
  
  chrome.tabs.reload(activeTab.id);
  incrementCounter();
}

// Reset counter function
function resetCounter() {
  refreshCounter = 0;
  document.getElementById("refreshCounter").textContent = "0";
  
  // Add animation
  const counterContainer = document.querySelector('.counter-container');
  counterContainer.classList.add('updated');
  
  // Remove animation class after animation completes
  setTimeout(() => {
    counterContainer.classList.remove('updated');
  }, 500);
  
  // If refresh is active, update the background script counter too
  if (isRefreshing && activeTab) {
    chrome.runtime.sendMessage({
      action: "resetRefreshCount",
      tabId: activeTab.id
    });
  }
}

// Increment counter with animation
function incrementCounter() {
  refreshCounter++;
  const counterElement = document.getElementById("refreshCounter");
  if (counterElement) {
    counterElement.textContent = refreshCounter;
    
    // Add animation
    const counterContainer = document.querySelector('.counter-container');
    counterContainer.classList.add('updated');
    
    // Remove animation class after animation completes
    setTimeout(() => {
      counterContainer.classList.remove('updated');
    }, 500);
  }
}

// Function to update the refresh counter with animation
function updateUserCount(count) {
  refreshCounter = count;
  const counterElement = document.getElementById("refreshCounter");
  
  if (counterElement) {
    counterElement.textContent = count;
    
    // Add animation
    const counterContainer = document.querySelector('.counter-container');
    if (counterContainer) {
      counterContainer.classList.add('updated');
      
      // Remove animation class after animation completes
      setTimeout(() => {
        counterContainer.classList.remove('updated');
      }, 500);
    }
  }
}

// Switch between refresh modes
function switchMode(mode) {
  refreshMode = mode;
  
  // Update UI
  document.getElementById("timeMode").classList.toggle("active", mode === "time");
  document.getElementById("conditionalMode").classList.toggle("active", mode === "conditional");
  
  // Show/hide relevant settings
  document.getElementById("timeSettings").classList.toggle("active", mode === "time");
  document.getElementById("timeSettings").classList.toggle("hidden", mode !== "time");
  
  document.getElementById("conditionalSettings").classList.toggle("active", mode === "conditional");
  document.getElementById("conditionalSettings").classList.toggle("hidden", mode !== "conditional");
  
  // Save mode preference
  chrome.storage.local.set({ lastRefreshMode: mode });
}

// Start refresh process
function startRefresh() {
  if (!activeTab) return;

  // Collect settings based on current mode
  const settings = collectSettings();
  
  // Save settings
  saveSettings(settings);
  
  // Send start message to background script
  try {
    chrome.runtime.sendMessage({
      action: "startAutoRefresh",
      tabId: activeTab.id,
      mode: refreshMode,
      settings: settings
    }, response => {
      if (chrome.runtime.lastError) {
        console.error("Error starting refresh:", chrome.runtime.lastError);
        return;
      }
      
      if (response && response.success) {
        updateUIForActive(true);
        // Request current count from background
        chrome.runtime.sendMessage({
          action: "getRefreshCount",
          tabId: activeTab.id
        }, countResponse => {
          if (chrome.runtime.lastError) {
            // Handle error silently
            return;
          }
          
          if (countResponse && countResponse.count !== undefined) {
            refreshCounter = countResponse.count;
            document.getElementById("refreshCounter").textContent = refreshCounter;
          }
        });
      }
    });
  } catch (error) {
    console.error("Error sending startAutoRefresh message:", error);
  }
}

// Stop refresh process
function stopRefresh() {
  if (!activeTab) return;
  
  try {
    chrome.runtime.sendMessage({
      action: "stopAutoRefresh",
      tabId: activeTab.id
    }, response => {
      if (chrome.runtime.lastError) {
        console.error("Error stopping refresh:", chrome.runtime.lastError);
        return;
      }
      
      if (response && response.success) {
        updateUIForActive(false);
        clearInterval(countdownIntervalId);
        document.getElementById("nextRefresh").textContent = "Refresh stopped";
        document.getElementById("timerBar").style.width = "0%";
        stopTickingSound(); // Stop ticking sound when refresh is manually stopped
      }
    });
  } catch (error) {
    console.error("Error sending stopAutoRefresh message:", error);
  }
}

// Check if the current tab is being refreshed
function checkRefreshStatus() {
  if (!activeTab) return;
  
  try {
    chrome.runtime.sendMessage({
      action: "getRefreshState",
      tabId: activeTab.id
    }, response => {
      if (chrome.runtime.lastError) {
        console.error("Error checking refresh status:", chrome.runtime.lastError);
        return;
      }
      
      if (response) {
        isRefreshing = response.active;
        updateUIForActive(isRefreshing);
        
        if (isRefreshing) {
          // Update refresh count
          if (response.count !== undefined) {
            refreshCounter = response.count;
            document.getElementById("refreshCounter").textContent = refreshCounter;
          }
          
          // Update next refresh time
          if (response.nextRefresh) {
            nextRefreshTime = response.nextRefresh;
            startCountdown();
          }
          
          // Update mode based on active settings
          if (response.settings && response.settings.mode) {
            switchMode(response.settings.mode);
          }
        }
      }
    });
  } catch (error) {
    console.error("Error sending getRefreshState message:", error);
  }
}

// Open settings page
function openSettings() {
  try {
    chrome.runtime.sendMessage({ action: "openSettings" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending openSettings message:", chrome.runtime.lastError);
        // Fallback to direct opening
        openSettingsFallback();
      }
    });
  } catch (error) {
    console.error("Error in openSettings:", error);
    openSettingsFallback();
  }
}

// Fallback function to open settings page directly
function openSettingsFallback() {
  try {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage().catch(error => {
        console.error("Error opening options page:", error);
        // Final fallback to direct URL open
        window.open(chrome.runtime.getURL('settings.html'), '_blank');
      });
    } else {
      // Fallback for browsers not supporting openOptionsPage
      window.open(chrome.runtime.getURL('settings.html'), '_blank');
    }
  } catch (error) {
    console.error("Ultimate fallback error:", error);
    // Last resort attempt
    const settingsUrl = chrome.runtime.getURL('settings.html');
    console.log("Attempting to open:", settingsUrl);
    window.open(settingsUrl, '_blank');
  }
}

// Collect settings based on current mode
function collectSettings() {
  const settings = {
    mode: refreshMode
  };
  
  // Common advanced options
  settings.pauseOnBlur = document.getElementById("pauseOnBlur")?.checked || false;
  settings.preserveScroll = document.getElementById("preserveScroll")?.checked || false;
  settings.skipErrors = document.getElementById("skipErrors")?.checked || false;
  settings.randomInterval = document.getElementById("randomInterval")?.checked || false;
  
  switch (refreshMode) {
    case "time":
      settings.interval = parseInt(document.getElementById("refreshInterval").value);
      break;
      
    case "conditional":
      settings.interval = parseInt(document.getElementById("refreshInterval_conditional").value);
      settings.unit = document.getElementById("refreshIntervalUnit_conditional").value;
      settings.conditionType = document.getElementById("conditionType").value;
      settings.conditionValue = document.getElementById("conditionValue").value;
      settings.monitorSelector = document.getElementById("monitorSelector").value;
      settings.actionAfterMet = document.getElementById("actionSelector").value;
      break;
  }
  
  return settings;
}

// Save settings to storage
function saveSettings(settings) {
  lastSettings = settings;
  chrome.storage.local.set({ 
    lastSettings: settings,
  });
}

// Load settings from storage
function loadSettings() {
  chrome.storage.local.get(["lastSettings", "lastRefreshMode"], (result) => {
    if (result.lastRefreshMode && (result.lastRefreshMode === "time" || result.lastRefreshMode === "conditional")) {
      switchMode(result.lastRefreshMode);
    } else {
      // Default to time mode
      switchMode("time");
    }
    
    if (result.lastSettings) {
      lastSettings = result.lastSettings;
      
      // Apply settings to UI
      if (lastSettings.pauseOnBlur !== undefined) {
        document.getElementById("pauseOnBlur").checked = lastSettings.pauseOnBlur;
      }
      
      if (lastSettings.preserveScroll !== undefined) {
        document.getElementById("preserveScroll").checked = lastSettings.preserveScroll;
      }
      
      if (lastSettings.skipErrors !== undefined) {
        document.getElementById("skipErrors").checked = lastSettings.skipErrors;
      }
      
      if (lastSettings.randomInterval !== undefined) {
        document.getElementById("randomInterval").checked = lastSettings.randomInterval;
      }
      
      if (lastSettings.mode === "time") {
        document.getElementById("refreshInterval").value = lastSettings.interval || 30;
        if (lastSettings.unit) {
        }
        
        // Highlight matching preset if any
        highlightMatchingPreset(lastSettings.interval, lastSettings.unit);
      } 
      else if (lastSettings.mode === "conditional") {
        document.getElementById("refreshInterval_conditional").value = lastSettings.interval || 15;
        if (lastSettings.unit) {
          document.getElementById("refreshIntervalUnit_conditional").value = lastSettings.unit;
        }
        if (lastSettings.conditionType) {
          document.getElementById("conditionType").value = lastSettings.conditionType;
        }
        document.getElementById("conditionValue").value = lastSettings.conditionValue || "";
        document.getElementById("monitorSelector").value = lastSettings.monitorSelector || "";
        
        if (lastSettings.actionAfterMet) {
          document.getElementById("actionSelector").value = lastSettings.actionAfterMet;
        }
        
        // Highlight matching preset if any
        highlightMatchingPreset(lastSettings.interval, lastSettings.unit);
      }
    }
  });
}

// Highlight matching preset button if the current settings match a preset
function highlightMatchingPreset(interval, unit) {
  const presetButtons = document.querySelectorAll('.preset-button');
  presetButtons.forEach(btn => {
    btn.classList.remove('active');
    
    const presetValue = btn.getAttribute('data-value');
    const presetUnit = btn.getAttribute('data-unit');
    
    if (parseInt(presetValue) === parseInt(interval) && presetUnit === unit) {
      btn.classList.add('active');
    }
  });
}

// Force an immediate update of the timer display
function forceUpdateTimerDisplay() {
  const now = Date.now();
  const timeLeft = Math.max(0, Math.round((nextRefreshTime - now) / 1000));
  
  updateTimerDisplay(timeLeft);
}

// Update the timer display with the given time left
function updateTimerDisplay(timeLeft) {
  const timerBar = document.getElementById("timerBar");
  const timerLabel = document.getElementById("nextRefresh");
  
  if (!timerBar || !timerLabel) return;
  
  // Format time display
  const timeDisplay = formatTimeDisplay(timeLeft);
  timerLabel.textContent = timeLeft > 0 ? timeDisplay : "Refreshing soon...";
  
  // Update status dot
  const statusDot = document.getElementById("statusDot");
  if (statusDot) {
    statusDot.classList.toggle("active", isRefreshing);
  }
}

// Update UI to reflect active/inactive state
function updateUIForActive(isActive) {
  isRefreshing = isActive;
  
  // Update status dot
  const statusDot = document.getElementById("statusDot");
  if (statusDot) {
    statusDot.classList.toggle("active", isActive);
  }
  
  document.getElementById("startRefresh").style.display = isActive ? "none" : "flex";
  document.getElementById("stopRefresh").style.display = isActive ? "flex" : "none";
  
  if (isActive) {
    startCountdown();
  } else {
    clearInterval(countdownIntervalId);
    document.getElementById("nextRefresh").textContent = "Refresh stopped";
    document.getElementById("timerBar").style.width = "0%";
    stopTickingSound(); // Stop ticking sound when refresh is stopped
  }
}

// Start countdown timer for next refresh
function startCountdown() {
  // Clear any existing intervals
  clearInterval(countdownIntervalId);
  stopTickingSound();
  
  // Request timer info from background
  chrome.runtime.sendMessage({
    action: "getCountdownInfo",
    tabId: activeTab.id
  }, response => {
    if (response && response.timerInfo) {
      const timerInfo = response.timerInfo;
      
      // Calculate next refresh time based on remaining time
      nextRefreshTime = Date.now() + (timerInfo.remaining * 1000);
      
      // Immediately update the display
      forceUpdateTimerDisplay();
      
      // Start playing ticking sound when close to refresh
      if (timerInfo.remaining <= 5) {
        startTickingSound();
      }
      
      // Set up interval for future updates
      countdownIntervalId = setInterval(() => {
        updateCountdown();
      }, 1000);
    }
  });
}

// Global ticker to track which sound to play (1-5)
let tickSoundIndex = 1;
let tickSoundIntervalId = null;

// Function to start the ticking sound sequence
function startTickingSound() {
  // Stop any existing ticking sound first
  stopTickingSound();
  
  // Get settings to check if ticking sound is enabled
  chrome.storage.sync.get('autoRefreshSettings', (data) => {
    const settings = data.autoRefreshSettings || {};
    
    // Only start if ticking sound is enabled
    if (settings.enableTickingSound !== false) { // Default to true if not set
      // Reset the tick sound index
      tickSoundIndex = 1;
      
      // Create the tick interval - plays a different sound each second
      tickSoundIntervalId = setInterval(() => {
        playTickSound();
        
        // Increment the tick sound index (1-5)
        tickSoundIndex = tickSoundIndex >= 5 ? 1 : tickSoundIndex + 1;
      }, 1000);
    }
  });
}

// Function to play a single tick sound
function playTickSound() {
  try {
    // Create a new audio element each time to avoid overlapping sounds
    if (window._currentTickSound) {
      window._currentTickSound.pause();
      window._currentTickSound = null;
    }
    
    const audio = new Audio(chrome.runtime.getURL(`sounds/ticking_${tickSoundIndex}.mp3`));
    audio.volume = 0.3; // Set volume to 30%
    
    // Store reference to current sound
    window._currentTickSound = audio;
    
    // Play the sound
    audio.play().catch(err => {
      console.log('Error playing ticking sound:', err);
    });
  } catch (error) {
    console.error('Error playing tick sound:', error);
  }
}

// Function to stop ticking sound
function stopTickingSound() {
  // Clear the tick interval if it exists
  if (tickSoundIntervalId) {
    clearInterval(tickSoundIntervalId);
    tickSoundIntervalId = null;
  }
  
  // Stop any currently playing tick sound
  if (window._currentTickSound) {
    window._currentTickSound.pause();
    window._currentTickSound = null;
  }
}

// Update the countdown display
function updateCountdown() {
  if (!activeTab) return;
  
  try {
    chrome.runtime.sendMessage({
      action: "getCountdownInfo",
      tabId: activeTab.id
    }, response => {
      if (chrome.runtime.lastError) {
        console.warn("Error getting countdown info:", chrome.runtime.lastError);
        return;
      }
      
      if (response && response.timerInfo) {
        const timerInfo = response.timerInfo;
        const timeLeft = timerInfo.remaining;
        const timerBar = document.getElementById("timerBar");
        const timerLabel = document.getElementById("nextRefresh");
        
        if (!timerBar || !timerLabel) return; // Guard against missing DOM elements
        
        // Start ticking sound when close to refresh
        if (timeLeft <= 5 && !tickSoundIntervalId) {
          startTickingSound();
        }
        
        // Ensure the timer bar is visible
        timerBar.style.display = 'block';
        
        // Check if we're in the "refreshing soon" state
        if (timeLeft <= 0) {
          timerLabel.textContent = "Refreshing soon...";
          timerBar.style.width = "100%";
          timerBar.classList.add("pulse");
          return;
        }
        
        // Format time display
        const timeDisplay = formatTimeDisplay(timeLeft);
        timerLabel.textContent = timeDisplay;
        
        // Update progress bar
        const percentComplete = Math.max(0, Math.min(100, 100 - timerInfo.percentage));
        timerBar.style.width = `${percentComplete}%`;
        
        // Add pulse effect when getting close to refresh time (last 10%)
        if (timerInfo.percentage <= 10) {
          timerBar.classList.add("pulse");
        } else {
          timerBar.classList.remove("pulse");
        }
      }
    });
  } catch (error) {
    console.error("Error sending getCountdownInfo message:", error);
  }
}

// Helper function to format time display
function formatTimeDisplay(timeLeft, unit) {
  // If no unit is specified, default to seconds for backward compatibility
  if (!unit) unit = 'seconds';
  
  switch(unit) {
    case 'milliseconds':
      if (timeLeft < 1000) {
        return `${timeLeft}ms`;
      } else {
        const seconds = Math.floor(timeLeft / 1000);
        const ms = timeLeft % 1000;
        return `${seconds}.${ms.toString().padStart(3, '0')}s`;
      }
    
    case 'minutes':
      return `${timeLeft}m`;
    
    case 'hours':
      return `${timeLeft}h`;
    
    case 'seconds':
    default:
      // Format seconds the same way as before
      const seconds = Math.floor(timeLeft % 60);
      const minutes = Math.floor((timeLeft / 60) % 60);
      const hours = Math.floor((timeLeft / (60 * 60)));
      
      let timeDisplay = "";
      if (hours > 0) {
        timeDisplay += `${hours}h `;
      }
      if (minutes > 0 || hours > 0) {
        timeDisplay += `${minutes}m `;
      }
      timeDisplay += `${seconds}s`;
      
      return timeDisplay;
  }
}