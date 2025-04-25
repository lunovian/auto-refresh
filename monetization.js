/**
 * Extension Monetization Module
 * 
 * This module implements a custom approach to monetization with auto-switching
 * ads that works within Chrome's Content Security Policy restrictions.
 */

// Ad content options for rotation
const adOptions = [
  {
    title: "Auto Refresh Tools",
    description: "Making your browsing experience smoother",
    linkText: "Learn More",
    linkUrl: "https://aivionlabs.netlify.app"
  },
  {
    title: "Web Productivity Tools",
    description: "Boost your workflow with our suite of tools",
    linkText: "Explore Tools",
    linkUrl: "https://aivionlabs.netlify.app/tools"
  },
  {
    title: "Browser Extensions",
    description: "Discover our full collection of productivity extensions",
    linkText: "View Collection",
    linkUrl: "https://aivionlabs.netlify.app/extensions"
  },
  {
    title: "Custom Development",
    description: "Need a custom solution for your business?",
    linkText: "Contact Us",
    linkUrl: "https://aivionlabs.netlify.app/contact"
  }
];

let currentAdIndex = 0;
let adRotationInterval;

// Initialize monetization features
function initMonetization() {
  console.log('Initializing monetization features');
  
  // Create ad placeholders that comply with CSP
  createAdPlaceholders();
  
  // Setup auto-switching for ads
  setupAdRotation();
  
  // Track engagement for analytics
  trackEngagement();
}

// Create CSP-compliant ad placeholders that won't trigger errors
function createAdPlaceholders() {
  const adContainer = document.getElementById('ad-rotation-container');
  
  if (!adContainer) {
    console.warn('Ad rotation container not found');
    return;
  }
  
  // Clear any existing content
  adContainer.innerHTML = '';
  
  // Create a placeholder that visually looks like an ad but is fully CSP-compliant
  const placeholder = document.createElement('div');
  placeholder.id = 'rotating-ad';
  placeholder.className = 'csp-compliant-ad';
  placeholder.style.cssText = 'min-height: 150px; width: 100%; display: flex; align-items: center; justify-content: center; border-radius: 8px; position: relative; transition: all 0.5s ease;';
  
  // Set initial ad content
  updateAdContent(placeholder, adOptions[0]);
  
  // Add the company label for branding
  const adLabel = document.createElement('div');
  adLabel.textContent = 'aivionlabs.netlify.app';
  adLabel.style.cssText = 'position: absolute; top: 8px; left: 8px; font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 1px;';
  
  placeholder.appendChild(adLabel);
  adContainer.appendChild(placeholder);
  
  // Make the placeholder look clickable
  placeholder.style.cursor = 'pointer';
  placeholder.addEventListener('mouseenter', () => {
    placeholder.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
    placeholder.style.transform = 'translateY(-2px)';
    placeholder.style.transition = 'all 0.3s ease';
  });
  
  placeholder.addEventListener('mouseleave', () => {
    placeholder.style.boxShadow = 'none';
    placeholder.style.transform = 'translateY(0)';
  });
}

// Set up automatic ad rotation
function setupAdRotation() {
  // Rotate ads every 10 seconds
  adRotationInterval = setInterval(() => {
    currentAdIndex = (currentAdIndex + 1) % adOptions.length;
    const adElement = document.getElementById('rotating-ad');
    
    if (adElement) {
      // Add fade-out effect
      adElement.style.opacity = '0';
      
      setTimeout(() => {
        // Update content while it's invisible
        updateAdContent(adElement, adOptions[currentAdIndex]);
        // Fade back in
        adElement.style.opacity = '1';
      }, 300);
    }
  }, 10000); // Change ad every 10 seconds
}

// Update the content of an ad element
function updateAdContent(adElement, adData) {
  // Create or update ad content
  let adContent = adElement.querySelector('.ad-content');
  
  if (!adContent) {
    adContent = document.createElement('div');
    adContent.className = 'ad-content';
    adContent.style.cssText = 'text-align: center; padding: 20px; color: #666;';
    adElement.appendChild(adContent);
  }
  
  adContent.innerHTML = `
    <div style="font-size: 14px; margin-bottom: 12px;">Sponsored</div>
    <div style="font-size: 18px; margin-bottom: 16px; font-weight: bold; color: #81b622;">${adData.title}</div>
    <div style="font-size: 13px; margin-bottom: 12px;">${adData.description}</div>
    <a href="${adData.linkUrl}" target="_blank" style="display: inline-block; background-color: #81b622; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">${adData.linkText}</a>
  `;
  
  // Update click behavior to match the current ad
  const currentAdData = adData;
  adElement.onclick = function(e) {
    // Don't trigger if user clicked on the link directly (let default behavior happen)
    if (e.target.tagName === 'A') return;
    
    window.open(currentAdData.linkUrl, '_blank');
  };
}

// Track engagement metrics for internal analytics
function trackEngagement() {
  // Record page view for internal analytics
  const page = window.location.pathname.split('/').pop() || 'index';
  recordAnalyticsEvent('page_view', { page });
  
  // Track clicks on sponsorship link
  setTimeout(() => {
    const sponsorButton = document.getElementById('sponsor-button');
    if (sponsorButton) {
      sponsorButton.addEventListener('click', () => {
        recordAnalyticsEvent('sponsor_click', {
          page: window.location.pathname.split('/').pop() || 'index'
        });
      });
    }
    
    // Track ad clicks
    const rotatingAd = document.getElementById('rotating-ad');
    if (rotatingAd) {
      rotatingAd.addEventListener('click', () => {
        recordAnalyticsEvent('ad_click', {
          page: window.location.pathname.split('/').pop() || 'index',
          adIndex: currentAdIndex,
          adTitle: adOptions[currentAdIndex].title
        });
      });
    }
  }, 1000);
}

// Simple analytics event recording (CSP-compliant)
function recordAnalyticsEvent(eventName, eventData = {}) {
  try {
    // Store event in local storage for later sync when privacy-compliant
    const events = JSON.parse(localStorage.getItem('auto_refresh_analytics') || '[]');
    events.push({
      event: eventName,
      data: eventData,
      timestamp: new Date().toISOString()
    });
    
    // Keep only the last 100 events to avoid excessive storage usage
    if (events.length > 100) {
      events.splice(0, events.length - 100);
    }
    
    localStorage.setItem('auto_refresh_analytics', JSON.stringify(events));
  } catch (e) {
    console.error('Analytics recording error:', e);
  }
}

// Clean up when navigating away from the page
window.addEventListener('beforeunload', () => {
  if (adRotationInterval) {
    clearInterval(adRotationInterval);
  }
});

// Start monetization when the DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMonetization);
} else {
  initMonetization();
}
