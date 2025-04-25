/**
 * Resource availability checker for Auto Refresh extension
 * This script checks for missing resources and reports them
 */

document.addEventListener('DOMContentLoaded', async () => {
  // List of essential resources to check
  const essentialResources = [
    'icons/icon16.png',
    'icons/icon48.png',
    'icons/icon128.png',
    'icons/settings-gear.svg',
    'terms.html',
    'privacy.html',
    'ad-styles.css'
  ];
  
  // Optional resources that can be safely missing
  const optionalResources = [
    'translations.js' // Optional since we're using Chrome's i18n
  ];

  const missingResources = [];

  // Check each essential resource
  for (const resource of essentialResources) {
    try {
      const response = await fetch(chrome.runtime.getURL(resource), { method: 'HEAD' });
      if (!response.ok) {
        missingResources.push(resource);
      }
    } catch (error) {
      missingResources.push(resource);
      console.error(`Error checking resource ${resource}:`, error);
    }
  }
  
  // Check optional resources but don't add to warnings
  for (const resource of optionalResources) {
    try {
      const response = await fetch(chrome.runtime.getURL(resource), { method: 'HEAD' });
      if (!response.ok) {
        console.warn(`Optional resource missing: ${resource} - This is acceptable.`);
      }
    } catch (error) {
      console.warn(`Optional resource missing: ${resource} - This is acceptable.`);
    }
  }

  // Report any missing essential resources
  if (missingResources.length > 0) {
    console.error('Missing essential resources detected:', missingResources);
    
    // Create a warning for the user only if in development mode or if critical resources are missing
    if (missingResources.some(res => res.endsWith('.js'))) {
      const warningDiv = document.createElement('div');
      warningDiv.style.cssText = 'position:fixed; top:0; left:0; right:0; background:#f8d7da; color:#721c24; padding:10px; z-index:10000; border-bottom:1px solid #f5c6cb; text-align:center; font-family:sans-serif;';
      warningDiv.textContent = `Missing resources detected: ${missingResources.join(', ')}. Some features may not work correctly.`;
      document.body.appendChild(warningDiv);
    }
  }

  // Check for external script loading issues
  window.addEventListener('error', function(e) {
    if (e.target && e.target.tagName === 'SCRIPT' && e.target.src) {
      console.error(`Failed to load script: ${e.target.src}`);
      
      // Determine if it's a CSP issue
      if (e.message && e.message.includes('Content Security Policy')) {
        console.error('Content Security Policy blocked script loading. Check manifest.json CSP settings.');
        
        // Add the domain to the list of suggested CSP additions
        const scriptDomain = new URL(e.target.src).origin;
        console.info(`Consider adding "${scriptDomain}" to content_security_policy in manifest.json`);
      }
    }
  }, true); // Use capture to make sure we catch all errors
});