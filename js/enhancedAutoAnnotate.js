/**
 * EnhancedAutoAnnotate.js - Main integration file for the advanced object detection
 * and model training features, connecting all components with the main application
 */

// Initialize global UI reference
window.advancedDetectionUI = null;

// Wait for the document to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the enhanced object detection and model training system
    initializeEnhancedAutoAnnotation();
});

/**
 * Initialize the enhanced auto-annotation system
 */
function initializeEnhancedAutoAnnotation() {
    console.log('Initializing enhanced auto-annotation system...');
    
    // Check for required global objects
    if (!window.enhancedObjectDetector) {
        console.error('Enhanced object detector not found! Make sure enhancedObjectDetection.js is loaded first.');
        return;
    }
    
    if (!window.modelTrainer) {
        console.error('Model trainer not found! Make sure modelTrainer.js is loaded first.');
        return;
    }
    
    try {
        // Create UI instance with enhanced object detector and model trainer
        window.advancedDetectionUI = new AdvancedDetectionUI(
            window.enhancedObjectDetector, 
            window.modelTrainer
        );
        
        // Initialize UI components
        window.advancedDetectionUI.initialize();
        
        // Add the Help shortcut key
        addHelpShortcut();
        
        // Add WebGL support check with delay
        setTimeout(checkWebGLSupport, 2000);
        
        console.log('Enhanced auto-annotation system initialized');
    } catch (err) {
        console.error('Error initializing enhanced auto-annotation:', err);
    }
}

/**
 * Add keyboard shortcut for model training and auto annotation help
 */
function addHelpShortcut() {
    document.addEventListener('keydown', function(e) {
        // Ctrl+H to open help
        if (e.ctrlKey && e.key.toLowerCase() === 'h') {
            e.preventDefault();
            const helpBtn = document.getElementById('helpBtn');
            if (helpBtn) {
                helpBtn.click();
            }
        }
        
        // Alt+A for auto annotation
        if (e.altKey && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            const autoAnnotateBtn = document.getElementById('autoAnnotateBtn');
            if (autoAnnotateBtn) {
                autoAnnotateBtn.click();
            }
        }
    });
}

/**
 * Pre-loads the model in the background after a delay
 * to avoid interfering with the app startup
 */
// function preloadModelInBackground() {
//     // Wait for the app to be stable (5 seconds after loading)
//     setTimeout(() => {
//         // Check if global objects exist
//         if (!window.enhancedObjectDetector) {
//             console.warn('Cannot preload model: enhancedObjectDetector not found');
//             return;
//         }
        
//         // Only preload if no detection has been triggered manually
//         if (!window.enhancedObjectDetector.isModelLoaded && 
//             !window.enhancedObjectDetector.modelLoadingPromise) {
//             console.log('Preloading object detection model in background...');
            
//             // Start loading without showing the UI
//             window.enhancedObjectDetector.loadModel()
//                 .then(() => {
//                     console.log('Model preloaded successfully');
//                 })
//                 .catch(error => {
//                     console.warn('Model preloading failed, will retry when needed', error);
//                 });
//         }
//     }, 5000);
// }

function preloadModelInBackground() {
    // Disable automatic preloading
    console.log('Auto model preloading disabled - will load on demand only');
}

// Start preloading the model after initialization, comment this line to disable preloading of model
window.addEventListener('load', preloadModelInBackground);

/**
 * Check for WebGL support
 */
function checkWebGLSupport() {
    const canvas = document.createElement('canvas');
    let gl = null;
    
    try {
        gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    } catch (e) {
        console.warn('Error creating WebGL context:', e);
    }
    
    if (!gl) {
        console.warn('WebGL not supported! Some features may not work properly.');
        
        // Show warning notification
        const container = document.createElement('div');
        container.classList.add('webgl-warning');
        container.innerHTML = `
            <div class="warning-content">
                <i class="fas fa-exclamation-triangle"></i>
                <div>
                    <h4>WebGL Support Issue</h4>
                    <p>Your browser doesn't fully support WebGL, which is needed for AI-powered features. Some features may run slower or not work properly.</p>
                </div>
                <button class="close-warning"><i class="fas fa-times"></i></button>
            </div>
        `;
        
        document.body.appendChild(container);
        
        // Add style for warning
        const style = document.createElement('style');
        style.textContent = `
            .webgl-warning {
                position: fixed;
                bottom: 20px;
                right: 20px;
                max-width: 350px;
                background-color: #fff3e0;
                border-left: 4px solid #f57c00;
                border-radius: 4px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 9999;
                animation: slide-in 0.3s ease-out;
            }
            
            .warning-content {
                display: flex;
                padding: 15px;
                align-items: flex-start;
                gap: 12px;
            }
            
            .warning-content i.fa-exclamation-triangle {
                color: #f57c00;
                font-size: 20px;
                margin-top: 2px;
            }
            
            .warning-content h4 {
                margin: 0 0 5px 0;
                font-size: 16px;
            }
            
            .warning-content p {
                margin: 0;
                font-size: 13px;
                color: #555;
            }
            
            .close-warning {
                background: none;
                border: none;
                color: #999;
                cursor: pointer;
                margin-left: auto;
                padding: 0;
                font-size: 14px;
            }
            
            @keyframes slide-in {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        
        document.head.appendChild(style);
        
        // Add close button functionality
        const closeBtn = container.querySelector('.close-warning');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                container.remove();
            });
        }
        
        // Auto-close after 10 seconds
        setTimeout(() => {
            if (document.body.contains(container)) {
                container.remove();
            }
        }, 10000);
    } else {
        // Check for compute capabilities
        try {
            const supported = gl.getExtension('WEBGL_debug_renderer_info');
            if (supported) {
                const renderer = gl.getParameter(supported.UNMASKED_RENDERER_WEBGL);
                console.log('WebGL renderer:', renderer);
                
                // Check if this is likely running on a mobile device or low-end GPU
                const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
                const isLowEnd = renderer.includes('Intel') && !renderer.includes('Iris');
                
                if (isMobile || isLowEnd) {
                    console.warn('Mobile or low-end GPU detected. Some features may run slower.');
                }
            }
        } catch (e) {
            console.warn('Could not check WebGL capabilities:', e);
        }
    }
}

// Update the help section with enhanced content
function updateHelpSection() {
    const helpPopup = document.getElementById('helpPopup');
    if (!helpPopup) return;
    
    // Create the new content
    const newContent = `
    <div class="help-dialog-content">
        <div class="help-header">
            <h3>Help & Features</h3>
            <button id="closeHelpBtn" class="btn btn-icon btn-ghost">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="help-body">
            <div class="help-section">
                <h4>Keyboard Shortcuts</h4>
                <div class="shortcut-item">
                    <kbd>Ctrl + A</kbd>
                    <span>Draw Mode</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Ctrl + M</kbd>
                    <span>Move Mode</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Alt + A</kbd>
                    <span>Auto Annotate</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Del</kbd>
                    <span>Delete Selected Annotation</span>
                </div>
                <div class="shortcut-item">
                    <kbd>←</kbd>
                    <span>Previous Image</span>
                </div>
                <div class="shortcut-item">
                    <kbd>→</kbd>
                    <span>Next Image</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Tab</kbd>
                    <span>Cycle Between Annotations</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Ctrl + H</kbd>
                    <span>Open Help</span>
                </div>
            </div>
            
            <div class="help-section">
                <h4>Auto-Annotation Feature</h4>
                <p>The Auto-Annotate button uses AI to automatically detect objects in your images:</p>
                
                <div class="feature-steps">
                    <div class="feature-step">
                        <span class="step-number">1</span>
                        <span>Upload your images and create at least one class</span>
                    </div>
                    <div class="feature-step">
                        <span class="step-number">2</span>
                        <span>Click the "Auto Annotate" button</span>
                    </div>
                    <div class="feature-step">
                        <span class="step-number">3</span>
                        <span>Choose a model and adjust the confidence threshold</span>
                    </div>
                    <div class="feature-step">
                        <span class="step-number">4</span>
                        <span>Review and refine the auto-generated annotations</span>
                    </div>
                </div>
                
                <p class="help-note">
                    <i class="fas fa-info-circle"></i>
                    Choose from multiple models: YOLOv8-Nano (balanced) offers good performance, while YOLOv8-Small provides higher accuracy but is slower. COCO-SSD is the fastest but less accurate option.
                </p>
            </div>
            
            <div class="help-section">
                <h4>Custom Model Training</h4>
                <p>Train your own object detection model using your annotations:</p>
                
                <div class="feature-steps">
                    <div class="feature-step">
                        <span class="step-number">1</span>
                        <span>Create annotations on at least 5 images</span>
                    </div>
                    <div class="feature-step">
                        <span class="step-number">2</span>
                        <span>Click the "Train Model" button</span>
                    </div>
                    <div class="feature-step">
                        <span class="step-number">3</span>
                        <span>Configure training parameters and start training</span>
                    </div>
                    <div class="feature-step">
                        <span class="step-number">4</span>
                        <span>Use your trained model for faster and more accurate annotations</span>
                    </div>
                </div>
                
                <p class="help-note warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    Training uses your device's GPU and may take several minutes. Keep the browser tab open during training. More annotations will result in a better model.
                </p>
                
                <p class="help-note">
                    <i class="fas fa-lightbulb"></i>
                    All processing happens locally in your browser - your data never leaves your device.
                </p>
            </div>
        </div>
    </div>
    `;
    
    // Add help section styles
    const style = document.createElement('style');
    style.textContent = `
        .help-section {
            margin-bottom: 1.5rem;
        }
        
        .help-section h4 {
            margin-bottom: 0.75rem;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .feature-steps {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            margin: 1rem 0;
        }
        
        .feature-step {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
        
        .step-number {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            background-color: #3563E9;
            color: white;
            border-radius: 50%;
            font-weight: 600;
            font-size: 0.875rem;
        }
        
        .help-note {
            background-color: #EEF2FF;
            border-left: 3px solid #3563E9;
            padding: 0.75rem;
            border-radius: 0.25rem;
            margin-top: 0.75rem;
            font-size: 0.875rem;
            display: flex;
            align-items: flex-start;
            gap: 0.5rem;
        }
        
        .help-note i {
            color: #3563E9;
            margin-top: 3px;
        }
        
        .help-note.warning {
            background-color: #fff3e0;
            border-left: 3px solid #f57c00;
        }
        
        .help-note.warning i {
            color: #f57c00;
        }
        
        .shortcut-item {
            display: flex;
            align-items: center;
            margin-bottom: 0.75rem;
            justify-content: space-between;
        }
        
        kbd {
            background-color: #f1f5f9;
            border: 1px solid #e2e8f0;
            border-radius: 0.25rem;
            box-shadow: 0 2px 0 rgba(0, 0, 0, 0.1);
            color: #1e293b;
            display: inline-block;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: 0.875rem;
            line-height: 1;
            padding: 0.25rem 0.5rem;
            white-space: nowrap;
        }
    `;
    document.head.appendChild(style);
    
    // Update the content
    helpPopup.innerHTML = newContent;
    
    // Re-bind the close button
    const closeBtn = document.getElementById('closeHelpBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            helpPopup.classList.add('hidden');
        });
    }
}

// Update the help section after a delay to ensure the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(updateHelpSection, 500);
});