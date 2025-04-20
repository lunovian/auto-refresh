/**
 * Ads Manager for Auto Refresh Extension
 * Handles displaying advertisements and affiliate offers
 */

class AdsManager {
  constructor() {
    this.adConfig = {
      enabled: true,
      premiumUser: false,
      adFrequency: 'medium', // low, medium, high
      lastAdShown: 0,
      adProviders: ['extension-ads', 'affiliate'],
      currentProvider: 0,
      // Tracking metrics
      impressions: 0,
      clicks: 0,
      lastRefresh: Date.now()
    };
    
    this.affiliateProducts = [
      {
        id: 'vpn-service',
        name: 'SecureNet VPN',
        description: 'Browse securely with unlimited bandwidth',
        link: 'https://example.com/vpn/?ref=autorefresh',
        image: 'ads/vpn-banner.png',
        ctaText: 'Try Free for 7 Days',
        category: 'security'
      },
      {
        id: 'dev-tool',
        name: 'DevToolkit Pro',
        description: 'Essential browser tools for web developers',
        link: 'https://example.com/devtoolkit/?ref=autorefresh',
        image: 'ads/dev-banner.png',
        ctaText: 'Download Free Trial',
        category: 'development'
      },
      {
        id: 'web-hosting',
        name: 'SpeedHost',
        description: 'Fast & reliable web hosting with 99.9% uptime',
        link: 'https://example.com/hosting/?ref=autorefresh',
        image: 'ads/hosting-banner.png',
        ctaText: '50% Off First Month',
        category: 'hosting'
      }
    ];
    
    // Cache analytics data locally
    this.analyticsCache = {
      adImpressions: [],
      adClicks: []
    };
    
    // Load config and premium status
    this.loadConfig();
  }
  
  /**
   * Load ad configuration from storage
   */
  async loadConfig() {
    try {
      const data = await chrome.storage.sync.get(['adConfig', 'premiumStatus']);
      if (data.adConfig) {
        this.adConfig = {...this.adConfig, ...data.adConfig};
      }
      
      // Check premium status
      if (data.premiumStatus && data.premiumStatus.active) {
        this.adConfig.premiumUser = true;
      }
      
    } catch (err) {
      console.error('Error loading ad config:', err);
    }
  }
  
  /**
   * Save ad configuration to storage
   */
  async saveConfig() {
    try {
      await chrome.storage.sync.set({ adConfig: this.adConfig });
    } catch (err) {
      console.error('Error saving ad config:', err);
    }
  }
  
  /**
   * Initialize ad manager
   */
  async initialize() {
    // Wait for config to load
    await this.loadConfig();
    
    // Don't initialize ads for premium users
    if (this.adConfig.premiumUser) return;
    
    // Upload any cached analytics
    this.uploadCachedAnalytics();
    
    console.log('Ad manager initialized');
    return true;
  }
  
  /**
   * Show banner ad in specified container
   * @param {string} containerId - DOM element ID for ad container
   * @returns {boolean} - Success status
   */
  async showBannerAd(containerId) {
    // Don't show ads to premium users
    if (this.adConfig.premiumUser) return false;
    
    const container = document.getElementById(containerId);
    if (!container) return false;
    
    // Check cooldown period based on frequency setting
    const now = Date.now();
    const cooldown = this.getAdCooldownPeriod();
    
    if (now - this.adConfig.lastAdShown < cooldown) {
      return false;
    }
    
    // Get random ad provider
    const providers = ['affiliate', 'extension-ads'];
    const provider = providers[Math.floor(Math.random() * providers.length)];
    
    // Show the ad based on provider type
    let success = false;
    if (provider === 'affiliate') {
      success = await this.showAffiliateBanner(container);
    } else {
      success = await this.showExtensionAdsBanner(container);
    }
    
    if (success) {
      // Update tracking data
      this.adConfig.lastAdShown = now;
      this.adConfig.impressions++;
      this.saveConfig();
    }
    
    return success;
  }
  
  /**
   * Show extension promotional banner
   * @param {Element} container - DOM element for ad container
   * @returns {boolean} - Success status
   */
  async showExtensionAdsBanner(container) {
    const extensionProducts = [
      {
        name: "Tab Manager Pro",
        description: "Organize and manage hundreds of tabs with ease",
        link: "https://example.com/tabmanager/?ref=autorefresh",
        ctaText: "Try Now"
      },
      {
        name: "Speed Booster",
        description: "Accelerate your browsing experience by up to 30%",
        link: "https://example.com/speedbooster/?ref=autorefresh", 
        ctaText: "Speed Up Browser"
      },
      {
        name: "Grammar Check",
        description: "Automatically fix spelling and grammar as you type",
        link: "https://example.com/grammar/?ref=autorefresh",
        ctaText: "Install Free"
      }
    ];
    
    // Pick a random product
    const product = extensionProducts[Math.floor(Math.random() * extensionProducts.length)];
    
    // Create ad HTML
    container.innerHTML = `
      <div class="ad-banner-container">
        <div class="ad-banner-header">
          <span class="ad-banner-label">Ad</span>
          <button class="ad-close-button" title="Close ad">×</button>
        </div>
        <div class="ad-banner-content">
          <h4>${product.name}</h4>
          <p>${product.description}</p>
          <a href="${product.link}" target="_blank" class="ad-cta-button" data-ad-type="extension" data-product="${product.name.replace(/\s/g, '-').toLowerCase()}">${product.ctaText}</a>
        </div>
      </div>
    `;
    
    // Add event listeners
    const closeButton = container.querySelector('.ad-close-button');
    if (closeButton) {
      closeButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        container.innerHTML = '';
      });
    }
    
    const ctaButton = container.querySelector('.ad-cta-button');
    if (ctaButton) {
      ctaButton.addEventListener('click', (e) => {
        this.trackAdClick('extension', ctaButton.dataset.product, ctaButton.href);
      });
    }
    
    // Track ad impression
    this.trackAdImpression('extension', product.name.replace(/\s/g, '-').toLowerCase());
    
    return true;
  }
  
  /**
   * Show affiliate banner ad
   * @param {Element} container - DOM element for ad container
   * @returns {boolean} - Success status
   */
  async showAffiliateBanner(container) {
    // Select random affiliate product
    const product = this.affiliateProducts[Math.floor(Math.random() * this.affiliateProducts.length)];
    if (!product) return false;
    
    // Create ad HTML
    container.innerHTML = `
      <div class="affiliate-banner-container">
        <div class="affiliate-banner-header">
          <span class="affiliate-banner-label">Sponsored</span>
          <button class="ad-close-button" title="Close ad">×</button>
        </div>
        <div class="affiliate-banner-content">
          <div class="affiliate-info">
            <h4>${product.name}</h4>
            <p>${product.description}</p>
            <a href="${product.link}" target="_blank" class="affiliate-cta-button" data-ad-type="affiliate" data-product="${product.id}">${product.ctaText}</a>
          </div>
        </div>
      </div>
    `;
    
    // Add event listeners
    const closeButton = container.querySelector('.ad-close-button');
    if (closeButton) {
      closeButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        container.innerHTML = '';
      });
    }
    
    const ctaButton = container.querySelector('.affiliate-cta-button');
    if (ctaButton) {
      ctaButton.addEventListener('click', (e) => {
        this.trackAdClick('affiliate', ctaButton.dataset.product, ctaButton.href);
      });
    }
    
    // Track affiliate impression
    this.trackAdImpression('affiliate', product.id);
    
    return true;
  }
  
  /**
   * Get cooldown period between ads
   * @returns {number} - Cooldown in milliseconds
   */
  getAdCooldownPeriod() {
    switch (this.adConfig.adFrequency) {
      case 'low':
        return 5 * 60 * 1000; // 5 minutes
      case 'medium':
        return 2 * 60 * 1000; // 2 minutes
      case 'high':
        return 1 * 60 * 1000; // 1 minute
      default:
        return 3 * 60 * 1000; // 3 minutes default
    }
  }
  
  /**
   * Track ad impression for analytics
   * @param {string} adType - Type of ad (affiliate or extension)
   * @param {string} productId - Product being advertised
   */
  trackAdImpression(adType, productId) {
    // Add to local cache
    this.analyticsCache.adImpressions.push({
      timestamp: Date.now(),
      adType: adType,
      productId: productId,
      sessionId: this.getSessionId()
    });
    
    console.log(`Ad impression tracked: ${adType} - ${productId}`);
    
    // Check if we should upload analytics
    if (this.analyticsCache.adImpressions.length >= 5 || 
        Date.now() - this.adConfig.lastRefresh > 60 * 60 * 1000) { // 1 hour
      this.uploadCachedAnalytics();
    }
  }
  
  /**
   * Track ad click for analytics
   * @param {string} adType - Type of ad (affiliate or extension)
   * @param {string} productId - Product being advertised
   * @param {string} link - Clicked URL
   */
  trackAdClick(adType, productId, link) {
    // Add to local cache
    this.analyticsCache.adClicks.push({
      timestamp: Date.now(),
      adType: adType,
      productId: productId,
      link: link,
      sessionId: this.getSessionId()
    });
    
    console.log(`Ad click tracked: ${adType} - ${productId}`);
    
    // Upload analytics immediately on click
    this.uploadCachedAnalytics();
  }
  
  /**
   * Upload cached analytics to server
   */
  async uploadCachedAnalytics() {
    // In a real implementation, you would send data to your analytics service
    try {
      // Check if we have data to upload
      if (this.analyticsCache.adImpressions.length === 0 && 
          this.analyticsCache.adClicks.length === 0) {
        return;
      }
      
      // Create payload
      const payload = {
        impressions: [...this.analyticsCache.adImpressions],
        clicks: [...this.analyticsCache.adClicks],
        extensionId: chrome.runtime.id,
        version: chrome.runtime.getManifest().version
      };
      
      // Simulate network request
      console.log('Uploading analytics:', payload);
      
      /*
      // This would be the actual implementation
      const response = await fetch('https://your-analytics-service.com/collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        // Clear the cache after successful upload
        this.analyticsCache.adImpressions = [];
        this.analyticsCache.adClicks = [];
        this.adConfig.lastRefresh = Date.now();
        this.saveConfig();
      }
      */
      
      // For testing, simulate successful upload
      setTimeout(() => {
        // Clear the cache
        this.analyticsCache.adImpressions = [];
        this.analyticsCache.adClicks = [];
        this.adConfig.lastRefresh = Date.now();
        this.saveConfig();
      }, 300);
      
    } catch (err) {
      console.error('Failed to upload analytics:', err);
    }
  }
  
  /**
   * Get or create session ID for tracking
   * @returns {string} - Session ID
   */
  getSessionId() {
    if (!this._sessionId) {
      this._sessionId = 'ses_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    return this._sessionId;
  }
  
  /**
   * Check premium status and update accordingly
   */
  async checkPremiumStatus() {
    const data = await chrome.storage.sync.get('premiumStatus');
    const now = Date.now();
    
    if (data.premiumStatus) {
      const status = data.premiumStatus;
      
      // Check if premium subscription is still valid
      if (status.active && status.expirationDate && status.expirationDate < now) {
        // Premium expired
        status.active = false;
        this.adConfig.premiumUser = false;
        await chrome.storage.sync.set({ premiumStatus: status });
        await this.saveConfig();
        
        // Notify user about expiration
        this.showPremiumExpiredNotification();
        
        return { active: false };
      }
      
      return status;
    }
    
    return { active: false };
  }
  
  /**
   * Show notification about premium expiration
   */
  showPremiumExpiredNotification() {
    if (!chrome.notifications) return;
    
    chrome.notifications.create('premium-expired', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Premium Subscription Expired',
      message: 'Your premium subscription has expired. Renew now to continue enjoying ad-free experience and premium features.',
      buttons: [
        { title: 'Renew Now' },
        { title: 'Later' }
      ]
    });
  }
}

// Create a singleton instance
const adsManager = new AdsManager();
export default adsManager;
