// JavaScript for the feedback and bug reporting page

document.addEventListener('DOMContentLoaded', () => {
  // Tab switching functionality
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTabId = tab.getAttribute('data-tab');
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show appropriate content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === targetTabId) {
          content.classList.add('active');
        }
      });
    });
  });
  
  // Category tag selection for both forms
  setupCategoryTags();
  
  // File upload handling
  setupFileUploads();
  
  // Bug Report form submission
  const bugForm = document.getElementById('bug-form');
  const bugStatus = document.getElementById('bug-status');
  
  bugForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form data
    const email = document.getElementById('bug-email').value;
    const title = document.getElementById('bug-title').value;
    const steps = document.getElementById('bug-steps').value;
    const expected = document.getElementById('bug-expected').value;
    const actual = document.getElementById('bug-actual').value;
    const browser = document.getElementById('bug-browser').value;
    const categories = document.getElementById('bug-categories').value;
    const severity = document.querySelector('input[name="bug-severity"]:checked').value;
    const reproducible = document.getElementById('bug-reproducible').checked;
    
    // Get uploaded files (in a real implementation)
    const filesData = getFilesInfo('bug-file-preview');
    
    // Extension version and other system information
    const version = chrome.runtime?.getManifest()?.version || '1.0';
    const ua = navigator.userAgent;
    
    try {
      // Show loading state
      bugStatus.textContent = 'Submitting your report...';
      bugStatus.className = 'status';
      bugStatus.style.display = 'block';
      
      // In a real implementation, you would send this data to your server
      // For now we'll just simulate a successful submission after a delay
      await simulateSubmission({
        type: 'bug',
        email,
        title,
        steps,
        expected,
        actual,
        browser,
        categories,
        severity,
        reproducible,
        files: filesData,
        version,
        userAgent: ua
      });
      
      // Show success message
      bugStatus.textContent = 'Bug report submitted successfully! Thank you for helping improve Auto Refresh.';
      bugStatus.className = 'status success';
      
      // Reset form
      bugForm.reset();
      resetCategoryTags('bug');
      clearFilePreview('bug-file-preview');
    } catch (error) {
      // Show error message
      bugStatus.textContent = `Error submitting report: ${error.message}`;
      bugStatus.className = 'status error';
    }
  });
  
  // Feature Request form submission
  const featureForm = document.getElementById('feature-form');
  const featureStatus = document.getElementById('feature-status');
  
  featureForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form data
    const email = document.getElementById('feature-email').value;
    const title = document.getElementById('feature-title').value;
    const description = document.getElementById('feature-description').value;
    const useCase = document.getElementById('feature-use-case').value;
    const categories = document.getElementById('feature-categories').value;
    const priority = document.querySelector('input[name="feature-priority"]:checked').value;
    
    // Get uploaded files (in a real implementation)
    const filesData = getFilesInfo('feature-file-preview');
    
    // Extension version
    const version = chrome.runtime?.getManifest()?.version || '1.0';
    
    try {
      // Show loading state
      featureStatus.textContent = 'Submitting your feature request...';
      featureStatus.className = 'status';
      featureStatus.style.display = 'block';
      
      // In a real implementation, you would send this data to your server
      // For now we'll just simulate a successful submission after a delay
      await simulateSubmission({
        type: 'feature',
        email,
        title,
        description,
        useCase,
        categories,
        priority,
        files: filesData,
        version
      });
      
      // Show success message
      featureStatus.textContent = 'Feature request submitted successfully! Thank you for your suggestion.';
      featureStatus.className = 'status success';
      
      // Reset form
      featureForm.reset();
      resetCategoryTags('feature');
      clearFilePreview('feature-file-preview');
    } catch (error) {
      // Show error message
      featureStatus.textContent = `Error submitting request: ${error.message}`;
      featureStatus.className = 'status error';
    }
  });
  
  // Function to setup category tags
  function setupCategoryTags() {
    // Setup bug report category tags
    const bugCategories = document.querySelectorAll('#bug-report .category-tag');
    const bugCategoriesInput = document.getElementById('bug-categories');
    
    bugCategories.forEach(tag => {
      tag.addEventListener('click', () => {
        tag.classList.toggle('selected');
        updateCategoriesInput(bugCategories, bugCategoriesInput);
      });
    });
    
    // Setup feature request category tags
    const featureCategories = document.querySelectorAll('#feature-request .category-tag');
    const featureCategoriesInput = document.getElementById('feature-categories');
    
    featureCategories.forEach(tag => {
      tag.addEventListener('click', () => {
        tag.classList.toggle('selected');
        updateCategoriesInput(featureCategories, featureCategoriesInput);
      });
    });
  }
  
  // Update hidden input with selected categories
  function updateCategoriesInput(categoryElements, inputElement) {
    const selectedCategories = Array.from(categoryElements)
      .filter(tag => tag.classList.contains('selected'))
      .map(tag => tag.dataset.category);
    
    inputElement.value = selectedCategories.join(',');
  }
  
  // Reset category tags
  function resetCategoryTags(formType) {
    const categoryTags = document.querySelectorAll(`#${formType}-report .category-tag`);
    categoryTags.forEach(tag => tag.classList.remove('selected'));
    
    const categoriesInput = document.getElementById(`${formType}-categories`);
    if (categoriesInput) {
      categoriesInput.value = '';
    }
  }
  
  // Function to handle file uploads
  function setupFileUploads() {
    // Bug report file upload handling
    const bugAttachments = document.getElementById('bug-attachments');
    const bugFilePreview = document.getElementById('bug-file-preview');
    
    if (bugAttachments) {
      bugAttachments.addEventListener('change', (e) => {
        handleFileUpload(e, bugFilePreview);
      });
    }
    
    // Feature request file upload handling
    const featureAttachments = document.getElementById('feature-attachments');
    const featureFilePreview = document.getElementById('feature-file-preview');
    
    if (featureAttachments) {
      featureAttachments.addEventListener('change', (e) => {
        handleFileUpload(e, featureFilePreview);
      });
    }
  }
  
  // Handle file upload preview
  function handleFileUpload(event, previewElement) {
    const files = event.target.files;
    
    if (files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          alert(`File "${file.name}" exceeds the 5MB size limit.`);
          continue;
        }
        
        // Create preview item
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.dataset.filename = file.name;
        
        // Add file info
        let fileIcon = '📄';
        if (file.type.startsWith('image/')) {
          fileIcon = '🖼️';
        } else if (file.name.endsWith('.pdf')) {
          fileIcon = '📑';
        } else if (file.name.endsWith('.txt') || file.name.endsWith('.log')) {
          fileIcon = '📝';
        }
        
        fileItem.innerHTML = `
          ${fileIcon} ${file.name} (${formatFileSize(file.size)})
          <span class="remove-file">✕</span>
        `;
        
        // Add remove button functionality
        const removeButton = fileItem.querySelector('.remove-file');
        removeButton.addEventListener('click', () => {
          fileItem.remove();
        });
        
        previewElement.appendChild(fileItem);
      }
    }
  }
  
  // Clear file preview
  function clearFilePreview(previewId) {
    const previewElement = document.getElementById(previewId);
    if (previewElement) {
      previewElement.innerHTML = '';
    }
  }
  
  // Get files information from preview (in a real implementation, you'd use FormData)
  function getFilesInfo(previewId) {
    const previewElement = document.getElementById(previewId);
    const fileItems = previewElement.querySelectorAll('.file-item');
    
    return Array.from(fileItems).map(item => ({
      filename: item.dataset.filename
    }));
  }
  
  // Format file size in KB or MB
  function formatFileSize(bytes) {
    if (bytes < 1024) {
      return bytes + ' B';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    } else {
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
  }
  
  // Function to simulate a submission with a delay
  function simulateSubmission(data) {
    return new Promise((resolve, reject) => {
      console.log('Submission data:', data);
      
      // Simulate network delay
      setTimeout(() => {
        // 90% chance of success
        if (Math.random() < 0.9) {
          resolve();
        } else {
          reject(new Error('Network error. Please try again.'));
        }
      }, 1000);
    });
  }
  
  // Update user count
  function updateUserCount() {
    // In a real extension, you might fetch this from a server
    // or use chrome.storage to store a locally incrementing count
    const userCount = document.getElementById('user-count');
    if (userCount) {
      userCount.textContent = '10,000+ users';
    }
  }
  
  // Auto-detect browser info
  function detectBrowserInfo() {
    const browserField = document.getElementById('bug-browser');
    if (!browserField) return;
    
    const ua = navigator.userAgent;
    let browserInfo = ua;
    
    // Extract more user-friendly browser info
    if (ua.includes('Chrome') && !ua.includes('Edg/') && !ua.includes('OPR')) {
      const chromeMatch = ua.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
      if (chromeMatch) {
        browserInfo = `Chrome ${chromeMatch[1]}`;
      }
    } else if (ua.includes('Firefox')) {
      const firefoxMatch = ua.match(/Firefox\/(\d+\.\d+)/);
      if (firefoxMatch) {
        browserInfo = `Firefox ${firefoxMatch[1]}`;
      }
    } else if (ua.includes('Edg/')) {
      const edgeMatch = ua.match(/Edg\/(\d+\.\d+\.\d+\.\d+)/);
      if (edgeMatch) {
        browserInfo = `Edge ${edgeMatch[1]}`;
      }
    } else if (ua.includes('OPR')) {
      const operaMatch = ua.match(/OPR\/(\d+\.\d+\.\d+)/);
      if (operaMatch) {
        browserInfo = `Opera ${operaMatch[1]}`;
      }
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
      const safariMatch = ua.match(/Version\/(\d+\.\d+)/);
      if (safariMatch) {
        browserInfo = `Safari ${safariMatch[1]}`;
      }
    }
    
    browserField.value = browserInfo;
    
    // Add hint about auto-detection
    const browserHint = document.getElementById('browser-info-hint');
    if (browserHint) {
      browserHint.textContent = 'Auto-detected: click to update if incorrect';
    }
  }
  
  // Initialize
  updateUserCount();
  detectBrowserInfo();
});
