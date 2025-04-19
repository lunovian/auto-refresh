const refreshStates = new Map();
const refreshCounts = new Map();
const countdownTimers = new Map();

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
    unit: unit
  });
  
  // Save to persistent storage
  chrome.storage.local.set({
    ['countdown_' + tabId]: {
      endTime: endTime,
      totalSeconds: totalSeconds,
      unit: unit
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
  
  // Notify popup about the update
  chrome.runtime.sendMessage({
    action: 'updateRefreshCount',
    count: newCount,
    tabId: tabId
  });

  // Reset the countdown timer after refresh
  resetCountdownTimer(tabId);
}

// Reset countdown timer after refresh
function resetCountdownTimer(tabId) {
  const timerInfo = countdownTimers.get(tabId);
  if (!timerInfo) return;
  
  // Recalculate next refresh time
  const nextRefreshTime = Date.now() + timerInfo.totalInterval;
  timerInfo.nextRefreshTime = nextRefreshTime;
  countdownTimers.set(tabId, timerInfo);
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

// Check if current time meets the smart scheduling criteria
function checkSmartScheduling(settings) {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const currentDay = days[dayOfWeek];
  
  // Check if activeDays exists and if current day is enabled
  if (!settings.activeDays || !settings.activeDays[currentDay]) {
    return { 
      shouldRefresh: false, 
      reason: `Current day (${currentDay}) is not in active days schedule` 
    };
  }
  
  // Check time range if enabled
  if (settings.timeRangeEnabled) {
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute; // Convert to minutes since midnight
    
    const [startHour, startMinute] = settings.startTime.split(':').map(Number);
    const [endHour, endMinute] = settings.endTime.split(':').map(Number);
    
    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;
    
    if (currentTime < startTimeMinutes || currentTime > endTimeMinutes) {
      return { 
        shouldRefresh: false, 
        reason: `Current time (${now.toLocaleTimeString()}) is outside active hours (${settings.startTime}-${settings.endTime})` 
      };
    }
  }
  
  // All criteria met
  return { shouldRefresh: true, reason: "Smart scheduling criteria met" };
}

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
      startCountdownTimer(tabId, settings.interval * 1000, settings.intervalUnit);
      
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
      
      sendResponse({ success: true });
    }
    else if (mode === 'smart') {
      // Smart scheduling - checks both time and day constraints
      
      // Function to perform the smart refresh check
      const performSmartRefreshCheck = async () => {
        try {
          // Check if tab still exists
          const tab = await chrome.tabs.get(tabId);
          
          // Check if current time meets scheduling criteria
          const result = checkSmartScheduling(settings);
          
          // Update popup with latest scheduling status
          chrome.runtime.sendMessage({
            action: 'smartScheduleStatus',
            result: result,
            tabId: tabId
          });
          
          // Only refresh if criteria are met
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
          console.error("Error in smart refresh check:", error);
          stopRefreshForTab(tabId);
        }
      };
      
      // Perform an immediate check when starting
      performSmartRefreshCheck();
      
      // Set up the interval for future checks
      const interval = setInterval(performSmartRefreshCheck, settings.interval * 1000);
      
      refreshStates.set(tabId, {
        type: 'smart',
        interval: interval,
        settings: settings
      });
      
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
    sendResponse({ timerInfo: timerInfo });
    return false; // No async response needed
  }
  
  return false; // Default: no async response needed
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle settings page opening
  if (message.action === 'openSettingsPage') {
    chrome.tabs.create({ url: 'settings.html' });
    return false;
  }
  
  // Handle refresh state requests
  if (message.action === 'getRefreshState') {
    const tabId = message.tabId;
    const state = refreshStates.get(tabId) || { active: false };
    const count = refreshCounts.get(tabId) || 0;
    const timerInfo = getRemainingTime(tabId);
    
    sendResponse({ 
      active: !!state,
      mode: state?.type || 'none',
      count: count,
      settings: state?.settings,
      timerInfo: timerInfo
    });
    return false;
  }
  
  // Handle countdown timer info requests
  else if (message.action === 'getCountdownInfo') {
    const tabId = message.tabId;
    const timerInfo = getRemainingTime(tabId);
    sendResponse({ timerInfo: timerInfo });
    return false;
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
      
      // Start timer if using time-based refresh
      if (state.mode === 'time') {
        const interval = calculateInterval(state.settings.interval, state.settings.intervalUnit);
        startCountdownTimer(tabId, interval, state.settings.intervalUnit);
        
        // Start the actual refresh timer
        startRefreshTimer(tabId, interval, state.settings);
      }
      // Handle conditional refresh
      else if (state.mode === 'conditional') {
        startConditionalRefresh(tabId, state.settings);
      }
      // Handle smart scheduling
      else if (state.mode === 'smart') {
        checkAndStartSmartRefresh(tabId, state.settings);
      }
      
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
  
  return false; // Default: no async response needed
});

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

// Handle extension icon clicks - open the sidebar
chrome.action.onClicked.addListener((tab) => {
  // Open the side panel
  chrome.sidePanel.open({ tabId: tab.id });
  
  // For Microsoft Edge compatibility
  if (chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

// Handle messages for opening settings
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openSettingsPage') {
    chrome.tabs.create({ url: 'settings.html' });
    return false;
  }
  
  // Existing message handlers
  if (message.action === 'getRefreshState') {
    const tabId = message.tabId;
    const state = refreshStates.get(tabId) || { active: false };
    const count = refreshCounts.get(tabId) || 0;
    
    sendResponse({ 
      active: state.active, 
      mode: state.mode,
      settings: state.settings,
      count: count
    });
    return false; // No async response needed
  }
  
  // Handle countdown timer info requests - added for persistent timer
  else if (message.action === 'getCountdownInfo') {
    const tabId = message.tabId;
    const timerInfo = getRemainingTime(tabId);
    
    sendResponse({ timerInfo });
    return false; // No async response needed
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
      
      // Start timer if using time-based refresh
      if (state.mode === 'time') {
        const interval = calculateInterval(state.settings.interval, state.settings.intervalUnit);
        startCountdownTimer(tabId, interval, state.settings.intervalUnit);
        
        // Start the actual refresh timer
        startRefreshTimer(tabId, interval, state.settings);
      }
      // Handle conditional refresh
      else if (state.mode === 'conditional') {
        startConditionalRefresh(tabId, state.settings);
      }
      // Handle smart scheduling
      else if (state.mode === 'smart') {
        checkAndStartSmartRefresh(tabId, state.settings);
      }
      
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
  
  return false; // Default: no async response needed
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

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  stopRefreshForTab(tabId);
  refreshCounts.delete(tabId);
});