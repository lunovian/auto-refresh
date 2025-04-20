const refreshStates = new Map();
const refreshCounts = new Map();
const countdownTimers = new Map();

// Default settings values (duplicated from settings.js for persistence)
const DEFAULT_SETTINGS = {
  showNotifications: true,
  confirmRefresh: true,
  defaultInterval: 30,
  enableResourceMonitoring: false,
  resourceCheckInterval: 5,
  startupRefreshMode: true,
  language: 'en',
  enableSoundEffects: true,  // Add sound effects setting with default=true
  enableTickingSound: true  // Add ticking sound setting (default true)
};

// Function to calculate remaining time for countdown display
function getRemainingTime(tabId) {
  const timerData = countdownTimers.get(tabId);
  
  if (!timerData) {
    return { 
      remaining: 0,
      total: 0,
      unit: 'seconds',
      percentage: 0
    };
  }
  
  const now = Date.now();
  const remaining = Math.max(0, Math.ceil((timerData.endTime - now) / 1000));
  const total = timerData.totalSeconds;
  const percentage = Math.round((remaining / total) * 100);
  
  return {
    remaining: remaining,
    total: total,
    unit: timerData.unit,
    percentage: percentage
  };
}

// Start a countdown timer for UI display
function startCountdownTimer(tabId, intervalMs, unit) {
  const totalSeconds = Math.ceil(intervalMs / 1000);
  const endTime = Date.now() + intervalMs;
  
  countdownTimers.set(tabId, {
    endTime: endTime,
    totalSeconds: totalSeconds,
    totalInterval: intervalMs, // Add this field to store the original interval
    unit: unit || 'seconds' // Ensure unit has a default value
  });
  
  // Save to persistent storage
  chrome.storage.local.set({
    ['countdown_' + tabId]: {
      endTime: endTime,
      totalSeconds: totalSeconds,
      totalInterval: intervalMs,
      unit: unit || 'seconds'
    }
  });
}

// Helper function to increment refresh count and notify popup
function incrementRefreshCount(tabId) {
  const currentCount = refreshCounts.get(tabId) || 0;
  const newCount = currentCount + 1;
  refreshCounts.set(tabId, newCount);
  
  // Store count in persistent storage
  chrome.storage.local.set({ ['refreshCount_' + tabId]: newCount });
  
  // Notify popup about the update - include a flag to play a sound if needed
  chrome.runtime.sendMessage({
    action: 'updateRefreshCount',
    count: newCount,
    tabId: tabId,
    playSound: true  // Add this flag so the UI can play a sound if needed
  });

  // Reset the countdown timer after refresh
  resetCountdownTimer(tabId);
}

// Reset countdown timer after refresh
function resetCountdownTimer(tabId) {
  const timerInfo = countdownTimers.get(tabId);
  if (!timerInfo) return;
  
  // Calculate next refresh time - add a small buffer of 100ms to avoid edge cases
  const nextRefreshTime = Date.now() + timerInfo.totalInterval + 100;
  
  // Create a completely new timer object with the original interval
  const newTimerInfo = {
    endTime: nextRefreshTime,
    totalSeconds: Math.ceil(timerInfo.totalInterval / 1000),
    totalInterval: timerInfo.totalInterval,
    unit: timerInfo.unit
  };
  
  // Update the countdown timer with the new object
  countdownTimers.set(tabId, newTimerInfo);
  
  // Update in storage as well
  chrome.storage.local.set({
    ['countdown_' + tabId]: newTimerInfo
  });
  
  // Ensure messages are properly sent with proper delay
  setTimeout(() => {
    // Send a message to update the countdown in the UI
    const timerData = getRemainingTime(tabId);
    
    chrome.runtime.sendMessage({
      action: "timerReset",
      tabId: tabId,
      nextRefresh: nextRefreshTime,
      timerInfo: timerData,
      timestamp: Date.now()
    });
    
    console.log("Timer reset for tab", tabId, "New end time:", new Date(nextRefreshTime).toISOString());
  }, 200);
}

// Function to stop refresh for a tab
function stopRefreshForTab(tabId) {
  const state = refreshStates.get(tabId);
  if (state) {
    if (state.type === 'time' || state.type === 'conditional' || state.type === 'smart') {
      clearInterval(state.interval);
    }
    refreshStates.delete(tabId);
  }
  // Don't delete the countdown timer here as popup might still need it
}

// Function to show notification and ask user if they want to continue
async function askToContinueIteration(tabId) {
  return new Promise((resolve) => {
    const notificationId = `continue-iteration-${tabId}`;
    const notificationTimeout = 30000; // 30 seconds
    let timeoutId;
    
    // Create notification
    chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Auto Refresh',
      message: 'Continue to iterate?',
      buttons: [
        { title: 'Yes' },
        { title: 'No' }
      ],
      requireInteraction: true
    });
    
    // Set timeout to automatically stop if no response
    timeoutId = setTimeout(() => {
      chrome.notifications.clear(notificationId);
      cleanupListeners();
      resolve(false);
    }, notificationTimeout);
    
    // Handle user response
    const notificationListener = function(id, buttonIndex) {
      if (id === notificationId) {
        clearTimeout(timeoutId);
        chrome.notifications.clear(notificationId);
        cleanupListeners();
        resolve(buttonIndex === 0); // Yes button = index 0, No button = index 1
      }
    };
    
    // Handle notification being closed
    const notificationClosed = function(id) {
      if (id === notificationId) {
        clearTimeout(timeoutId);
        cleanupListeners();
        resolve(false);
      }
    };
    
    // Helper function to clean up all listeners
    function cleanupListeners() {
      chrome.notifications.onButtonClicked.removeListener(notificationListener);
      chrome.notifications.onClosed.removeListener(notificationClosed);
    }
    
    chrome.notifications.onButtonClicked.addListener(notificationListener);
    chrome.notifications.onClosed.addListener(notificationClosed);
  });
}

// Check if refresh should occur based on conditional rules
async function checkConditionalRefresh(tabId, settings) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      function: (settings) => {
        const target = settings.selector ? 
          document.querySelector(settings.selector) : 
          document.body;
          
        if (!target) return { shouldRefresh: false, reason: "Target element not found" };
        
        const content = settings.selector ? target.textContent : document.body.innerText;
        const normalizedContent = content.toLowerCase();
        const normalizedCondition = settings.conditionValue.toLowerCase();
        
        let shouldRefresh = false;
        let reason = "";
        
        switch (settings.conditionType) {
          case 'containsText':
            shouldRefresh = normalizedContent.includes(normalizedCondition);
            reason = shouldRefresh ? 
              `Text "${settings.conditionValue}" was found` : 
              `Text "${settings.conditionValue}" not found yet`;
            break;
          case 'notContainsText':
            shouldRefresh = !normalizedContent.includes(normalizedCondition);
            reason = shouldRefresh ? 
              `Text "${settings.conditionValue}" is not present` : 
              `Text "${settings.conditionValue}" is still present`;
            break;
          case 'textChanged':
            // Store the initial content in a global variable for future comparison
            if (!window._lastCheckedContent) {
              window._lastCheckedContent = normalizedContent;
              shouldRefresh = false;
              reason = "Initial content snapshot taken";
            } else {
              shouldRefresh = window._lastCheckedContent !== normalizedContent;
              reason = shouldRefresh ? 
                "Content has changed since last check" : 
                "No content changes detected";
              
              // Update the snapshot for future comparisons
              if (shouldRefresh) {
                window._lastCheckedContent = normalizedContent;
              }
            }
            break;
        }
        
        return { shouldRefresh, reason };
      },
      args: [settings]
    });
    
    return results[0]?.result || { shouldRefresh: false, reason: "Error executing script" };
  } catch (error) {
    console.error("Error in conditional refresh check:", error);
    return { shouldRefresh: false, reason: "Error: " + error.message };
  }
}

// Function to apply new settings to already active refresh processes
function applyNewSettingsToActiveRefreshes(newSettings) {
  // For each active refresh, apply relevant settings that can be changed without restart
  refreshStates.forEach((state, tabId) => {
    // Update form protection setting if it changed
    if (state.settings.formProtection !== newSettings.confirmRefresh) {
      state.settings.formProtection = newSettings.confirmRefresh;
      
      // Also update in content script if active
      chrome.tabs.sendMessage(tabId, {
        action: newSettings.confirmRefresh ? 'enableFormProtection' : 'disableFormProtection'
      }).catch(() => {
        // Silently fail if content script isn't ready yet
      });
    }
    
    // Update resource monitoring settings if they changed
    if (state.settings.enableResourceMonitoring !== newSettings.enableResourceMonitoring) {
      state.settings.enableResourceMonitoring = newSettings.enableResourceMonitoring;
      
      // Update in content script
      if (newSettings.enableResourceMonitoring) {
        chrome.tabs.sendMessage(tabId, {
          action: 'startResourceMonitoring',
          interval: newSettings.resourceCheckInterval
        }).catch(() => {
          // Silently fail if content script isn't ready yet
        });
      } else {
        chrome.tabs.sendMessage(tabId, {
          action: 'stopResourceMonitoring'
        }).catch(() => {
          // Silently fail if content script isn't ready yet
        });
      }
    }
    
    // Save updated state
    refreshStates.set(tabId, state);
  });
}

// Function to save important state before extension reload
function saveStateBeforeReload() {
  // Convert Map to Object for storage
  const refreshStatesObj = {};
  refreshStates.forEach((value, key) => {
    refreshStatesObj[key] = {
      type: value.type,
      settings: value.settings,
      // Don't store the interval as it will be invalid after reload
      // Will be recreated on extension reload
    };
  });
  
  const refreshCountsObj = {};
  refreshCounts.forEach((value, key) => {
    refreshCountsObj[key] = value;
  });
  
  // Save to local storage for restoration after reload
  chrome.storage.local.set({
    '_refreshStatesBeforeReload': refreshStatesObj,
    '_refreshCountsBeforeReload': refreshCountsObj
  });
}

// Function to restore state after extension reload
function restoreStateAfterReload() {
  chrome.storage.local.get(['_refreshStatesBeforeReload', '_refreshCountsBeforeReload'], (result) => {
    const states = result._refreshStatesBeforeReload;
    const counts = result._refreshCountsBeforeReload;
    
    // Restore refresh counts
    if (counts) {
      Object.entries(counts).forEach(([tabId, count]) => {
        refreshCounts.set(parseInt(tabId), count);
      });
    }
    
    // Restore active refresh states
    if (states) {
      Object.entries(states).forEach(([tabId, state]) => {
        const numTabId = parseInt(tabId);
        
        // Verify the tab still exists
        chrome.tabs.get(numTabId).then(tab => {
          // Tab exists, try to restore refresh state
          const settings = state.settings;
          
          // Use the message system to restart auto refresh with saved settings
          chrome.runtime.sendMessage({
            action: 'startAutoRefresh',
            tabId: numTabId,
            mode: state.type,
            settings: settings
          });
        }).catch(() => {
          // Tab no longer exists, skip restoration
          console.log(`Tab ${tabId} no longer exists, skipping refresh state restoration.`);
        });
      });
    }
    
    // Clean up the temporary storage
    chrome.storage.local.remove(['_refreshStatesBeforeReload', '_refreshCountsBeforeReload']);
  });
}

// Main message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, tabId, mode, settings } = message;

  if (action === 'startAutoRefresh') {
    stopRefreshForTab(tabId);
    
    // Initialize refresh count if needed
    if (!refreshCounts.has(tabId)) {
      chrome.storage.local.get(['refreshCount_' + tabId], (result) => {
        const count = result['refreshCount_' + tabId] || 0;
        refreshCounts.set(tabId, count);
      });
    }
    
    if (mode === 'time') {
      // Simple time-based refresh
      const interval = setInterval(async () => {
        // Check if tab still exists before refreshing
        try {
          const tab = await chrome.tabs.get(tabId);
          
          // Refresh the tab
          await chrome.tabs.reload(tabId);
          incrementRefreshCount(tabId);
          
          // No direct audio playback from service worker
          // Instead, the UI will handle sound effects via the updateRefreshCount message
          
          // Check if we should continue iteration
          const state = refreshStates.get(tabId);
          if (state?.settings?.continueIteration) {
            const shouldContinue = await askToContinueIteration(tabId);
            if (!shouldContinue) {
              stopRefreshForTab(tabId);
              chrome.storage.local.set({ ['isActive_' + tabId]: false });
              // Notify popup that auto-refresh has been stopped
              chrome.runtime.sendMessage({
                action: 'autoRefreshStopped',
                tabId: tabId
              });
            }
          }
        } catch (error) {
          // Tab no longer exists, clear the interval
          stopRefreshForTab(tabId);
        }
      }, settings.interval * 1000);
      
      refreshStates.set(tabId, {
        type: 'time',
        interval: interval,
        settings: settings
      });
      
      // Start countdown timer for time-based refresh
      startCountdownTimer(tabId, settings.interval * 1000, settings.unit);
      
      sendResponse({ success: true });
    } 
    else if (mode === 'conditional') {
      // Conditional refresh - check content periodically and refresh based on conditions
      const interval = setInterval(async () => {
        try {
          // Check if tab still exists
          const tab = await chrome.tabs.get(tabId);
          
          // Check if condition is met
          const result = await checkConditionalRefresh(tabId, settings);
          
          // Update the popup with the latest check result
          chrome.runtime.sendMessage({
            action: 'conditionalCheckResult',
            result: result,
            tabId: tabId
          });
          
          // Refresh if the condition is met
          if (result.shouldRefresh) {
            await chrome.tabs.reload(tabId);
            incrementRefreshCount(tabId);
            
            // Check if we should continue iteration
            const state = refreshStates.get(tabId);
            if (state?.settings?.continueIteration) {
              const shouldContinue = await askToContinueIteration(tabId);
              if (!shouldContinue) {
                stopRefreshForTab(tabId);
                chrome.storage.local.set({ ['isActive_' + tabId]: false });
                // Notify popup that auto-refresh has been stopped
                chrome.runtime.sendMessage({
                  action: 'autoRefreshStopped',
                  tabId: tabId
                });
              }
            }
          }
        } catch (error) {
          console.error("Error in conditional refresh interval:", error);
          stopRefreshForTab(tabId);
        }
      }, settings.interval * 1000);
      
      refreshStates.set(tabId, {
        type: 'conditional',
        interval: interval,
        settings: settings
      });
      
      // Start countdown timer for conditional refresh
      startCountdownTimer(tabId, settings.interval * 1000, settings.unit || 'seconds');
      
      sendResponse({ success: true });
    }
    
    return true; // Keep the message channel open for the async response
  } 
  else if (action === 'stopAutoRefresh') {
    stopRefreshForTab(tabId);
    // Remove countdown timer
    countdownTimers.delete(tabId);
    sendResponse({ success: true });
    return false; // No async response needed
  }
  else if (action === 'getRefreshState') {
    const state = refreshStates.get(tabId);
    const count = refreshCounts.get(tabId) || 0;
    const timerInfo = getRemainingTime(tabId);
    
    sendResponse({ 
      active: !!state,
      mode: state?.type || 'none',
      count: count,
      settings: state?.settings,
      timerInfo: timerInfo
    });
    return false; // No async response needed
  }
  else if (action === 'getCountdownInfo') {
    const timerInfo = getRemainingTime(tabId);
    const timer = countdownTimers.get(tabId);
    const now = Date.now();
    
    // Log timer state for debugging
    console.log(`getCountdownInfo for tab ${tabId}:`, {
      remaining: timerInfo.remaining,
      endTime: timer?.endTime ? new Date(timer.endTime).toISOString() : null,
      now: new Date(now).toISOString(),
      diff: timer?.endTime ? (timer.endTime - now) / 1000 : null
    });
    
    sendResponse({ 
      timerInfo: timerInfo,
      debugInfo: {
        currentTime: now,
        endTime: timer?.endTime,
        hasTimer: !!timer
      }
    });
    return false; // No async response needed
  }
  else if (action === 'settingsUpdated') {
    // Apply new settings to active refreshes if needed
    applyNewSettingsToActiveRefreshes(message.settings);
    
    if (message.reload) {
      // Save any important state before reload
      saveStateBeforeReload();
      
      // The actual reload will be handled by the settings.js file
      sendResponse({ success: true });
    }
    return true;
  }
  
  return false; // Default: no async response needed
});

// Additional message handler for other extension communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle settings page opening
  if (message.action === 'openSettingsPage') {
    // Use navigateTo instead of create when possible
    if (sender.tab) {
      chrome.tabs.update(sender.tab.id, { url: 'settings.html' });
    } else {
      chrome.tabs.create({ url: 'settings.html' });
    }
    sendResponse({ success: true });
    return true; // Keep the message channel open
  }
  
  // Handle content script state requests
  else if (message.action === 'getContentScriptState') {
    // Get tab information from sender if available
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ error: "No tab ID associated with this request" });
      return false; // No async response needed
    }
    
    // Get the refresh state for this tab
    const state = refreshStates.get(tabId);
    
    // Return relevant content script state information
    sendResponse({
      resourceMonitoring: state?.settings?.enableResourceMonitoring || false,
      monitoredResources: state?.settings?.monitoredResources || [],
      formProtection: state?.settings?.formProtection || false
    });
    
    return false; // No async response needed
  }

  // Handle setting new refresh state
  else if (message.action === 'setRefreshState') {
    const tabId = message.tabId;
    const state = message.state;
    
    if (state.active) {
      // Store refresh state
      refreshStates.set(tabId, {
        active: true,
        mode: state.mode,
        settings: state.settings
      });
      
      // Use the proper message to start the refresh
      chrome.runtime.sendMessage({
        action: 'startAutoRefresh',
        tabId: tabId,
        mode: state.mode,
        settings: state.settings
      });
      
      sendResponse({ success: true });
    } else {
      // Stop refresh for this tab
      stopRefreshForTab(tabId);
      sendResponse({ success: true });
    }
    return false; // No async response needed
  }
  
  // Handle reset refresh count request
  else if (message.action === 'resetRefreshCount') {
    const tabId = message.tabId;
    refreshCounts.set(tabId, 0);
    
    // Clear from persistent storage too
    chrome.storage.local.remove('refreshCount_' + tabId);
    
    sendResponse({ success: true, count: 0 });
    return false; // No async response needed
  }

  // Handle updating the continue iteration setting
  else if (message.action === 'updateIterationSetting') {
    const tabId = message.tabId;
    const state = refreshStates.get(tabId);
    
    if (state) {
      // Update the setting in the refresh state
      state.settings.continueIteration = message.continueIteration;
      refreshStates.set(tabId, state);
      
      // Acknowledge success
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, reason: "No active refresh for this tab" });
    }
    return false; // No async response needed
  }

  // Handle getting tab information
  else if (message.action === 'getTabInfo') {
    const tabId = message.tabId;
    
    if (!tabId) {
      sendResponse({ success: false, error: "No tab ID provided" });
      return false;
    }
    
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        sendResponse({ 
          success: false, 
          error: chrome.runtime.lastError.message 
        });
      } else {
        sendResponse({
          success: true,
          tab: {
            id: tab.id,
            title: tab.title,
            url: tab.url,
            favIconUrl: tab.favIconUrl
          }
        });
      }
    });
    
    return true; // Keep the message channel open for the async response
  }
  
  return false; // Default: no async response needed
});

// Handle extension icon clicks - open the sidebar
chrome.action.onClicked.addListener((tab) => {
  // Open the side panel
  chrome.sidePanel.open({ tabId: tab.id });
  
  // For Microsoft Edge compatibility
  if (chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

// When a tab is updated (e.g., navigated to a new URL)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // If this is a complete load and we have conditional monitoring 
  // for this tab, reset the text monitoring
  if (changeInfo.status === 'complete') {
    const state = refreshStates.get(tabId);
    if (state && state.type === 'conditional') {
      // Reset the text monitoring after page load
      chrome.scripting.executeScript({
        target: { tabId },
        function: () => {
          // Reset the cached content for text changed detection
          window._lastCheckedContent = null;
        }
      }).catch(err => console.error("Error resetting content monitoring:", err));
    }
  }
});

// Listen for extension installation or update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'update' || details.reason === 'install') {
    // For fresh installs, set default settings
    if (details.reason === 'install') {
      chrome.storage.sync.set({ 'autoRefreshSettings': DEFAULT_SETTINGS });
    }
  }
  
  // After an update or browser restart, try to restore previous state
  restoreStateAfterReload();
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  stopRefreshForTab(tabId);
  refreshCounts.delete(tabId);
});

// Add this function to reset all timers if needed
function forceRefreshAllTimers() {
  for (const [tabId, timerInfo] of countdownTimers.entries()) {
    resetCountdownTimer(tabId);
  }
}

// For debugging - allow resetting timers via message
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'forceRefreshTimers') {
    forceRefreshAllTimers();
    sendResponse({ success: true });
    return false; // Change to false since we're responding synchronously
  }
  
  // Add a catch-all response
  if (!message.action || typeof message.action !== 'string') {
    sendResponse({ error: "Invalid message format or missing action" });
    return false;
  }
  
  // Handle unknown actions with a proper response
  sendResponse({ error: `Unknown action: ${message.action}` });
  return false;
});