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
  document.getElementById("smartMode").addEventListener("click", () => switchMode("smart"));

  // Control buttons
  document.getElementById("startRefresh").addEventListener("click", startRefresh);
  document.getElementById("stopRefresh").addEventListener("click", stopRefresh);

  // Time range toggle for smart mode
  document.getElementById("timeRangeEnabled").addEventListener("change", function() {
    document.getElementById("timeRangeContainer").classList.toggle("hidden", !this.checked);
  });

  // Add settings button handler
  document.getElementById("settingsButton").addEventListener("click", openSettings);

  // Load current state and settings
  loadSettings();
  
  // Check if refresh is already active for current tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      activeTab = tabs[0];
      checkRefreshStatus();
    }
  });
});

// Switch between refresh modes
function switchMode(mode) {
  refreshMode = mode;
  
  // Update UI
  document.getElementById("timeMode").classList.toggle("active", mode === "time");
  document.getElementById("conditionalMode").classList.toggle("active", mode === "conditional");
  document.getElementById("smartMode").classList.toggle("active", mode === "smart");
  
  // Show/hide relevant settings
  document.getElementById("timeSettings").classList.toggle("active", mode === "time");
  document.getElementById("timeSettings").classList.toggle("hidden", mode !== "time");
  
  document.getElementById("conditionalSettings").classList.toggle("active", mode === "conditional");
  document.getElementById("conditionalSettings").classList.toggle("hidden", mode !== "conditional");
  
  document.getElementById("smartSettings").classList.toggle("active", mode === "smart");
  document.getElementById("smartSettings").classList.toggle("hidden", mode !== "smart");
  
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
      
    case "smart":
      settings.interval = parseInt(document.getElementById("refreshInterval_smart").value);
      settings.unit = document.getElementById("refreshIntervalUnit_smart").value;
      settings.activeDays = {
        mon: document.getElementById("day_mon").checked,
        tue: document.getElementById("day_tue").checked,
        wed: document.getElementById("day_wed").checked,
        thu: document.getElementById("day_thu").checked,
        fri: document.getElementById("day_fri").checked,
        sat: document.getElementById("day_sat").checked,
        sun: document.getElementById("day_sun").checked
      };
      settings.timeRangeEnabled = document.getElementById("timeRangeEnabled").checked;
      if (settings.timeRangeEnabled) {
        settings.timeRangeStart = document.getElementById("timeRangeStart").value;
        settings.timeRangeEnd = document.getElementById("timeRangeEnd").value;
      }
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
    if (result.lastRefreshMode) {
      switchMode(result.lastRefreshMode);
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
      else if (lastSettings.mode === "smart") {
        document.getElementById("refreshInterval_smart").value = lastSettings.interval || 30;
        if (lastSettings.unit) {
          document.getElementById("refreshIntervalUnit_smart").value = lastSettings.unit;
        }
        
        // Set active days
        if (lastSettings.activeDays) {
          document.getElementById("day_mon").checked = lastSettings.activeDays.mon !== false;
          document.getElementById("day_tue").checked = lastSettings.activeDays.tue !== false;
          document.getElementById("day_wed").checked = lastSettings.activeDays.wed !== false;
          document.getElementById("day_thu").checked = lastSettings.activeDays.thu !== false;
          document.getElementById("day_fri").checked = lastSettings.activeDays.fri !== false;
          document.getElementById("day_sat").checked = lastSettings.activeDays.sat !== false;
          document.getElementById("day_sun").checked = lastSettings.activeDays.sun !== false;
        }
        
        // Set time range
        document.getElementById("timeRangeEnabled").checked = lastSettings.timeRangeEnabled === true;
        document.getElementById("timeRangeContainer").classList.toggle("hidden", !lastSettings.timeRangeEnabled);
        
        if (lastSettings.timeRangeStart) {
          document.getElementById("timeRangeStart").value = lastSettings.timeRangeStart;
        }
        
        if (lastSettings.timeRangeEnd) {
          document.getElementById("timeRangeEnd").value = lastSettings.timeRangeEnd;
        }
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
  }
}

// Start countdown timer for next refresh
function startCountdown() {
  clearInterval(countdownIntervalId);
  
  // Request timer info from background
  chrome.runtime.sendMessage({
    action: "getCountdownInfo",
    tabId: activeTab.id
  }, response => {
    if (response && response.timerInfo) {
      const timerInfo = response.timerInfo;
      // Calculate next refresh time based on remaining time
      nextRefreshTime = Date.now() + (timerInfo.remaining * 1000);
      updateCountdown();
      
      countdownIntervalId = setInterval(() => {
        updateCountdown();
      }, 1000);
    }
  });
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
      
      if (timeLeft <= 0) {
        // We're past the refresh time, wait for a new one
        timerLabel.textContent = "Refreshing soon...";
        timerBar.style.width = "100%";
        timerBar.classList.add("pulse");
        return;
      }
      
      // Calculate time units
      const seconds = Math.floor(timeLeft % 60);
      const minutes = Math.floor((timeLeft / 60) % 60);
      const hours = Math.floor((timeLeft / (60 * 60)));
      
      // Format display
      let timeDisplay = "";
      if (hours > 0) {
        timeDisplay += `${hours}h `;
      }
      if (minutes > 0 || hours > 0) {
        timeDisplay += `${minutes}m `;
      }
      timeDisplay += `${seconds}s`;
      
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
  });
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
  if (message.action === "updateRefreshCount" && message.tabId === activeTab?.id) {
    refreshCounter = message.count;
    document.getElementById("refreshCounter").textContent = refreshCounter;
    
    // Animate the refresh icon
    const counterContainer = document.querySelector(".counter-container");
    counterContainer.classList.add("updated");
    setTimeout(() => {
      counterContainer.classList.remove("updated");
    }, 500);
    
    // Update the next refresh time
    if (message.nextRefresh) {
      nextRefreshTime = message.nextRefresh;
    }
  }
  
  // Always return true for async responses
  return true;
});

// Function to open settings page
function openSettings() {
  chrome.runtime.sendMessage({
    action: "openSettingsPage"
  });
}