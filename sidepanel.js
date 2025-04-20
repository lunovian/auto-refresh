let activeTab = null;
let refreshMode = "time"; // Default mode
let isRefreshing = false;
let refreshCounter = 0;
let refreshIntervalId = null;
let countdownIntervalId = null;
let nextRefreshTime = 0;
let lastSettings = {};

// DOM Elements
document.addEventListener("DOMContentLoaded", () => {
  // Set up mode tabs
  document.getElementById("timeMode").addEventListener("click", () => switchMode("time"));
  document.getElementById("conditionalMode").addEventListener("click", () => switchMode("conditional"));
  
  // Remove smart mode event listener since we removed the element
  
  // Control buttons
  document.getElementById("startRefresh").addEventListener("click", startRefresh);
  document.getElementById("stopRefresh").addEventListener("click", stopRefresh);
  
  // Add settings button handler
  const settingsButton = document.getElementById("settingsButton");
  if (settingsButton) {
    settingsButton.addEventListener("click", openSettings);
  } else {
    console.warn("Settings button not found in the DOM.");
  }

  // Load current state and settings
  loadSettings();
  
  // Check if refresh is already active for current tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      activeTab = tabs[0];
      updateTabInfo(activeTab); // Add this line to update tab info
      checkRefreshStatus();
    }
  });

  // Remove language-related code
  // loadUIStrings();
  // applyI18n();
});

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
  chrome.runtime.sendMessage({
    action: "startAutoRefresh",
    tabId: activeTab.id,
    mode: refreshMode,
    settings: settings
  }, response => {
    if (response && response.success) {
      updateUIForActive(true);
      // Request current count from background
      chrome.runtime.sendMessage({
        action: "getRefreshCount",
        tabId: activeTab.id
      }, countResponse => {
        if (countResponse && countResponse.count !== undefined) {
          refreshCounter = countResponse.count;
          document.getElementById("refreshCounter").textContent = refreshCounter;
        }
      });
    }
  });
}

// Stop refresh process
function stopRefresh() {
  if (!activeTab) return;
  
  chrome.runtime.sendMessage({
    action: "stopAutoRefresh",
    tabId: activeTab.id
  }, response => {
    if (response && response.success) {
      updateUIForActive(false);
      clearInterval(countdownIntervalId);
      document.getElementById("nextRefresh").textContent = "Refresh stopped";
      document.getElementById("timerBar").style.width = "0%";
      stopTickingSound(); // Stop ticking sound when refresh is manually stopped
    }
  });
}

// Check if the current tab is being refreshed
function checkRefreshStatus() {
  if (!activeTab) return;
  
  chrome.runtime.sendMessage({
    action: "getRefreshState",
    tabId: activeTab.id
  }, response => {
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
}

// Collect settings based on current mode
function collectSettings() {
  const settings = {
    mode: refreshMode
  };
  
  switch (refreshMode) {
    case "time":
      settings.interval = parseInt(document.getElementById("refreshInterval").value);
      settings.unit = document.getElementById("timeUnit").value;
      break;
      
    case "conditional":
      settings.interval = parseInt(document.getElementById("refreshInterval_conditional").value);
      settings.unit = document.getElementById("refreshIntervalUnit_conditional").value;
      settings.conditionType = document.getElementById("conditionType").value;
      settings.conditionValue = document.getElementById("conditionValue").value;
      settings.monitorSelector = document.getElementById("monitorSelector").value;
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
      // Default to time mode if smart mode was previously selected or no mode is set
      switchMode("time");
    }
    
    if (result.lastSettings) {
      lastSettings = result.lastSettings;
      
      // Apply settings to UI
      if (lastSettings.mode === "time") {
        document.getElementById("refreshInterval").value = lastSettings.interval || 30;
        if (lastSettings.unit) {
          document.getElementById("timeUnit").value = lastSettings.unit;
        }
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
      }
    }
  });
}

// Update UI to reflect active/inactive state
function updateUIForActive(isActive) {
  isRefreshing = isActive;
  
  document.getElementById("statusBadge").className = isActive 
    ? "status-badge status-active" 
    : "status-badge status-inactive";
  
  document.getElementById("statusBadge").textContent = isActive ? "Active" : "Inactive";
  
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
      
      // Initial update of the countdown display
      updateCountdown();
      
      // Start playing ticking sound
      startTickingSound();
      
      // Set up interval for countdown updates - update every second
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
  
  // Request the latest timer info from background script
  chrome.runtime.sendMessage({
    action: "getCountdownInfo",
    tabId: activeTab.id
  }, response => {
    if (response && response.timerInfo) {
      const timerInfo = response.timerInfo;
      const timeLeft = timerInfo.remaining;
      const timerBar = document.getElementById("timerBar");
      const timerLabel = document.getElementById("nextRefresh");
      
      // Ensure the timer bar is visible regardless of mode
      timerBar.style.display = 'block';
      
      // Make sure we always show a time display unless we're actually at 0
      if (timeLeft <= 0) {
        timerLabel.textContent = "Refreshing soon...";
        timerBar.style.width = "100%";
        timerBar.classList.add("pulse");
      } else {
        // Format time display (same for all modes)
        const timeDisplay = formatTimeDisplay(timeLeft);
        
        // Debug to console if timer seems wrong
        if (timeLeft < 3 || timeLeft > 3600) {
          console.log("Current timer state:", response);
        }
        
        // Always set the timer text for all positive time values
        timerLabel.textContent = `Next refresh in: ${timeDisplay}`;
        
        // Update progress bar with smoother animation
        const percentComplete = 100 - timerInfo.percentage;
        timerBar.style.width = `${percentComplete}%`;
        
        // Add pulse effect when getting close to refresh time (last 10%)
        if (timerInfo.percentage <= 10) {
          timerBar.classList.add("pulse");
          timerLabel.style.opacity = "1";
        } else {
          timerBar.classList.remove("pulse");
          timerLabel.style.opacity = "0.8";
        }
      }
    }
  });
}

// Helper function to format time display
function formatTimeDisplay(timeLeft) {
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

// Helper function to get the current day abbreviation (mon, tue, etc.)
function getCurrentDay() {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return days[new Date().getDay()];
}

// Helper function to check if current time is within the specified range
function isInTimeRange(startTime, endTime) {
  if (!startTime || !endTime) return true;
  
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);
  
  const currentMinutesSinceMidnight = currentHours * 60 + currentMinutes;
  const startMinutesSinceMidnight = startHours * 60 + startMinutes;
  const endMinutesSinceMidnight = endHours * 60 + endMinutes;
  
  return currentMinutesSinceMidnight >= startMinutesSinceMidnight && 
         currentMinutesSinceMidnight <= endMinutesSinceMidnight;
}

// Convert time units to milliseconds
function convertToMilliseconds(value, unit) {
  switch (unit) {
    case "milliseconds":
      return value;
    case "seconds":
      return value * 1000;
    case "minutes":
      return value * 60 * 1000;
    case "hours":
      return value * 60 * 60 * 1000;
    default:
      return value * 1000; // default to seconds
  }
}

// Listen for refresh count updates from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Always acknowledge receipt immediately for any message
  if (sendResponse) {
    sendResponse({ received: true });
  }
  
  // Process specific message types
  if (message.action === "updateRefreshCount" && message.tabId === activeTab?.id) {
    refreshCounter = message.count;
    document.getElementById("refreshCounter").textContent = refreshCounter;
    
    // Animate the refresh icon
    const counterContainer = document.querySelector(".counter-container");
    counterContainer.classList.add("updated");
    setTimeout(() => {
      counterContainer.classList.remove("updated");
    }, 500);
    
    // This event happens right after a refresh, so update the timer display
    setTimeout(forceUpdateTimerDisplay, 250);
  }
  
  // Handle timer resets
  else if (message.action === "timerReset" && message.tabId === activeTab?.id) {
    console.log("timerReset received:", message);
    
    // Reset the countdown timer with the new next refresh time
    nextRefreshTime = message.nextRefresh;
    
    // Stop any existing interval
    if (countdownIntervalId) {
      clearInterval(countdownIntervalId);
      countdownIntervalId = null;
    }
    
    // Stop any existing ticking sound
    stopTickingSound();
    
    // Immediately update the timer display
    forceUpdateTimerDisplay();
    
    // Restart the ticking sound
    startTickingSound();
    
    // Set up a new interval for countdown updates
    countdownIntervalId = setInterval(() => {
      updateCountdown();
    }, 1000);
  }
  
  // Return false to indicate we've handled the message synchronously
  return false;
});

// Handle background script messages separately
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle specific messages from background script
  if (message.action === "autoRefreshStopped" && message.tabId === activeTab?.id) {
    updateUIForActive(false);
    sendResponse({ success: true });
  }
  else if (message.action === "conditionalCheckResult" && message.tabId === activeTab?.id) {
    // Handle conditional check results if needed
    sendResponse({ success: true });
  }
  
  // Return false for synchronous response
  return false;
});

// Function to open settings page
function openSettings() {
  // Use Chrome API directly rather than messaging
  chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
}

// Function to update tab information display
function updateTabInfo(tab) {
  if (!tab) return;
  
  const tabTitle = document.getElementById('tabTitle');
  const tabUrl = document.getElementById('tabUrl');
  const tabFavicon = document.getElementById('tabFavicon');
  
  if (tabTitle) tabTitle.textContent = tab.title || 'Unnamed Tab';
  
  if (tabUrl) {
    // Format the URL for display
    const url = new URL(tab.url);
    tabUrl.textContent = url.hostname + url.pathname;
    tabUrl.title = tab.url; // Full URL in tooltip
  }
  
  if (tabFavicon && tab.favIconUrl) {
    tabFavicon.src = tab.favIconUrl;
    tabFavicon.onerror = () => {
      tabFavicon.src = "icons/icon16.png"; // Fallback to extension icon
    };
  } else if (tabFavicon) {
    tabFavicon.src = "icons/icon16.png"; // Default extension icon
  }
}

// Listen for tab updates to refresh tab information
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (activeTab && tabId === activeTab.id) {
    // Update our stored activeTab object with latest data
    activeTab = tab;
    // Update the UI with new tab info
    updateTabInfo(tab);
  }
});

// Listen for tab activation changes
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    activeTab = tab;
    updateTabInfo(tab);
    checkRefreshStatus(); // Check if this tab has active refresh
  });
});

// Add a dedicated function to force update the timer display
function forceUpdateTimerDisplay() {
  if (!activeTab) return;
  
  chrome.runtime.sendMessage({
    action: "getCountdownInfo",
    tabId: activeTab.id
  }, response => {
    if (response && response.timerInfo) {
      const timerInfo = response.timerInfo;
      const timeLeft = timerInfo.remaining;
      const timerBar = document.getElementById("timerBar");
      const timerLabel = document.getElementById("nextRefresh");
      
      console.log("Force updating timer display:", {
        timeLeft: timeLeft,
        percentage: timerInfo.percentage,
        response
      });
      
      // Ensure the timer bar is visible
      timerBar.style.display = 'block';
      
      // Reset any pulse effect
      timerBar.classList.remove("pulse");
      
      if (timeLeft <= 0) {
        timerLabel.textContent = "Refreshing soon...";
        timerBar.style.width = "100%";
        timerBar.classList.add("pulse");
      } else {
        // Format time display
        const timeDisplay = formatTimeDisplay(timeLeft);
        timerLabel.textContent = `Next refresh in: ${timeDisplay}`;
        
        // Update progress bar
        const percentComplete = 100 - timerInfo.percentage;
        timerBar.style.width = `${percentComplete}%`;
      }
    }
  });
}

// Listen for refresh count and timer updates from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Update refresh counter on count update
  if (message.action === "updateRefreshCount" && message.tabId === activeTab?.id) {
    refreshCounter = message.count;
    document.getElementById("refreshCounter").textContent = refreshCounter;
    
    // Animate the refresh icon
    const counterContainer = document.querySelector(".counter-container");
    counterContainer.classList.add("updated");
    setTimeout(() => {
      counterContainer.classList.remove("updated");
    }, 500);
    
    // This event happens right after a refresh, so update the timer display
    setTimeout(forceUpdateTimerDisplay, 250);
  }
  
  // Handle timer resets
  if (message.action === "timerReset" && message.tabId === activeTab?.id) {
    console.log("timerReset received:", message);
    
    // Reset the countdown timer with the new next refresh time
    nextRefreshTime = message.nextRefresh;
    
    // Stop any existing interval
    if (countdownIntervalId) {
      clearInterval(countdownIntervalId);
      countdownIntervalId = null;
    }
    
    // Stop any existing ticking sound
    stopTickingSound();
    
    // Immediately update the timer display
    forceUpdateTimerDisplay();
    
    // Restart the ticking sound
    startTickingSound();
    
    // Set up a new interval for countdown updates
    countdownIntervalId = setInterval(() => {
      updateCountdown();
    }, 1000);
  }
  
  // Always return true for async responses
  return true;
});

// Update the countdown display function
function updateCountdown() {
  if (!activeTab) return;
  
  chrome.runtime.sendMessage({
    action: "getCountdownInfo",
    tabId: activeTab.id
  }, response => {
    if (response && response.timerInfo) {
      const timerInfo = response.timerInfo;
      const timeLeft = timerInfo.remaining;
      const timerBar = document.getElementById("timerBar");
      const timerLabel = document.getElementById("nextRefresh");
      
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
      timerLabel.textContent = `Next refresh in: ${timeDisplay}`;
      
      // Update progress bar
      const percentComplete = Math.max(0, Math.min(100, 100 - timerInfo.percentage));
      timerBar.style.width = `${percentComplete}%`;
      
      // Add pulse effect when getting close to refresh time (last 10%)
      if (timerInfo.percentage <= 10) {
        timerBar.classList.add("pulse");
        timerLabel.style.opacity = "1";
      } else {
        timerBar.classList.remove("pulse");
        timerLabel.style.opacity = "0.8";
      }
    }
  });
}

// Add a manual refresh button for testing
document.addEventListener("DOMContentLoaded", () => {
  // ...existing code...
  
  // DEBUG: Add ability to force update timers with double-click on the timer
  const timerContainer = document.querySelector(".next-refresh-container");
  if (timerContainer) {
    timerContainer.addEventListener("dblclick", () => {
      console.log("Force updating timer");
      forceUpdateTimerDisplay();
    });
  }
});

// Modify the start countdown function
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
      
      // Start playing ticking sound
      startTickingSound();
      
      // Set up interval for future updates
      countdownIntervalId = setInterval(() => {
        updateCountdown();
      }, 1000);
    }
  });
}