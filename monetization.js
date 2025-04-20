/**
 * Monetization integration for Auto Refresh extension
 * Using CSP-safe implementation (no external scripts)
 */

document.addEventListener('DOMContentLoaded', () => {
  try {
    // Initialize monetization features safely
    initializeMonetization();
  } catch (error) {
    console.error('Error in monetization initialization:', error);
  }
});

// Main initialization function
function initializeMonetization() {
  try {
    // Use placeholder ads instead of Google Ads due to CSP restrictions
    createPlaceholderAds();
    
    // Enhance Buy Me Coffee buttons with tracking
    enhanceBuyMeCoffeeButtons();
  } catch (error) {
    console.error('Critical error in monetization module:', error);
  }
}

// Create placeholder ads that comply with CSP
function createPlaceholderAds() {
  try {
    // Find ad containers
    const adContainers = document.querySelectorAll('.ad-container, .settings-ad-container');
    
    adContainers.forEach(container => {
      // Create a CSP-safe ad placeholder
      const placeholderAd = document.createElement('div');
      placeholderAd.className = 'ad-banner-container';
      placeholderAd.innerHTML = `
        <div class="ad-banner-header">
          <span class="ad-banner-label">Sponsored</span>
        </div>
        <div class="ad-banner-content">
          <h4>Auto Refresh Pro</h4>
          <p>Get more productivity features and support development.</p>
          <a href="settings.html#donation" class="ad-cta-button">Donate</a>
        </div>
      `;
      
      container.appendChild(placeholderAd);
      container.style.minHeight = 'auto';
    });
    
    console.log(`Created ${adContainers.length} placeholder ads`);
  } catch (error) {
    console.error('Failed to create placeholder ads:', error);
  }
}

// Enhance Buy Me Coffee buttons with tracking
function enhanceBuyMeCoffeeButtons() {
  try {
    // Find all Buy Me Coffee buttons
    const bmcButtons = document.querySelectorAll('.bmc-button, .custom-coffee-button, #bmc-button');
    
    // Add click tracking
    bmcButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Track click event
        console.log('Buy Me Coffee button clicked');
        
        // Save the donation attempt in storage for records
        chrome.storage.local.set({
          'lastDonationAttempt': {
            timestamp: Date.now(),
            source: window.location.pathname
          }
        });
      });
    });
    
    console.log(`Enhanced ${bmcButtons.length} Buy Me Coffee buttons`);
  } catch (error) {
    console.error('Error enhancing Buy Me Coffee buttons:', error);
  }
}

// Create a coffee cup icon for use in the sidebar
function createCoffeeCupIcon() {
  try {
    // Check if we're in the side panel
    const supportDevSection = document.getElementById('support-dev');
    if (supportDevSection) {
      const coffeeCupIcon = document.createElement('img');
      coffeeCupIcon.src = chrome.runtime.getURL('icons/coffee-cup.svg');
      coffeeCupIcon.alt = "Coffee cup";
      coffeeCupIcon.width = 20;
      coffeeCupIcon.height = 20;
      coffeeCupIcon.style.marginRight = '8px';
      
      const bmcButton = document.getElementById('bmc-button');
      if (bmcButton && !bmcButton.querySelector('img')) {
        bmcButton.insertBefore(coffeeCupIcon, bmcButton.firstChild);
      }
    }
  } catch (error) {
    console.error('Error creating coffee cup icon:', error);
  }
}

// Call the function when the DOM is ready
document.addEventListener('DOMContentLoaded', createCoffeeCupIcon);
