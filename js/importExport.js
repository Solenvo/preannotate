// Simple Import/Export Functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing simple Import/Export functionality');
    
    // Get elements
    const importExportBtn = document.getElementById('importExportBtn');
    const importExportOptions = document.getElementById('importExportOptions');
    
    // Make sure dropdown starts hidden
    if (importExportOptions) {
        importExportOptions.style.display = 'none';
    }
    
    // Toggle dropdown when button is clicked
    if (importExportBtn) {
        importExportBtn.onclick = function(e) {
            e.stopPropagation();
            if (importExportOptions) {
                if (importExportOptions.style.display === 'none') {
                    importExportOptions.style.display = 'block';
                } else {
                    importExportOptions.style.display = 'none';
                }
            }
        };
    }
    
    // Close dropdown when clicking elsewhere
    document.addEventListener('click', function(e) {
        if (importExportOptions && importExportOptions.style.display !== 'none') {
            if (!importExportOptions.contains(e.target) && e.target !== importExportBtn) {
                importExportOptions.style.display = 'none';
            }
        }
    });
    
    // Stop propagation on dropdown clicks
    if (importExportOptions) {
        importExportOptions.onclick = function(e) {
            e.stopPropagation();
        };
    }
    
    // Set up export buttons
    const exportAnnotationsBtn = document.getElementById('exportAnnotationsBtn');
    if (exportAnnotationsBtn) {
        exportAnnotationsBtn.onclick = function() {
            importExportOptions.style.display = 'none';
            if (typeof exportAnnotationsOnly === 'function') {
                exportAnnotationsOnly();
            }
        };
    }
    
    const exportAllBtn = document.getElementById('exportAllBtn');
    if (exportAllBtn) {
        exportAllBtn.onclick = function() {
            importExportOptions.style.display = 'none';
            if (typeof exportAnnotationsAndImages === 'function') {
                exportAnnotationsAndImages();
            }
        };
    }
    
    // Set up import buttons
    const importAnnotationsBtn = document.getElementById('importAnnotationsBtn');
    const importAnnotationsInput = document.getElementById('importAnnotationsInput');
    if (importAnnotationsBtn && importAnnotationsInput) {
        importAnnotationsBtn.onclick = function() {
            importExportOptions.style.display = 'none';
            importAnnotationsInput.value = ''; // Clear it first
            importAnnotationsInput.click();
        };
    }
    
    const importAllBtn = document.getElementById('importAllBtn');
    const importAllInput = document.getElementById('importAllInput');
    if (importAllBtn && importAllInput) {
        importAllBtn.onclick = function() {
            importExportOptions.style.display = 'none';
            importAllInput.value = ''; // Clear it first
            importAllInput.click();
        };
    }
    
    // Set up file input handlers
    if (importAnnotationsInput) {
        importAnnotationsInput.onchange = function(event) {
            if (event.target.files && event.target.files.length > 0) {
                if (typeof handleImportAnnotationsOnly === 'function') {
                    handleImportAnnotationsOnly(event);
                }
            }
        };
    }
    
    if (importAllInput) {
        importAllInput.onchange = function(event) {
            if (event.target.files && event.target.files.length > 0) {
                if (typeof handleImportAll === 'function') {
                    handleImportAll(event);
                }
            }
        };
    }
    
    console.log('Simple Import/Export functionality initialized');
});