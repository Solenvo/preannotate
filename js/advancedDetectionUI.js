/**
 * AdvancedDetectionUI.js - UI components for enhanced object detection and model training
 */

class AdvancedDetectionUI {
    constructor(objectDetector, modelTrainer) {
        // Store references to detector and trainer
        this.objectDetector = objectDetector;
        this.modelTrainer = modelTrainer;
        
        // State variables
        this.modelStatus = 'not-loaded'; // 'not-loaded', 'loading', 'loaded'
        this.detectionInProgress = false;
        this.modelLoadingProgress = 0;
        this.statusMessage = '';
        
        // UI Element IDs
        this.PROGRESS_OVERLAY_ID = 'objectDetectionProgress';
        this.SETTINGS_DIALOG_ID = 'objectDetectionSettings';
        this.TRAINING_DIALOG_ID = 'modelTrainingDialog';
        this.AUTO_ANNOTATE_BTN_ID = 'autoAnnotateBtn';
        this.TRAIN_MODEL_BTN_ID = 'trainModelBtn';
        
        // Training status
        this.trainingStatus = 'idle'; // 'idle', 'preparing', 'training', 'completed', 'failed'
    }

    /**
     * Initialize the UI elements
     */
    initialize() {
        // Add styles first to ensure they are available
        this.addStyles();
        
        // Create UI components
        this.createButtons();
        this.createProgressOverlay();
        this.createSettingsDialog();
        this.createTrainingDialog();
        
        // Bind event listeners
        this.bindEventListeners();
        
        console.log('Advanced detection UI initialized');
    }

    updateButtonStatus() {
        const statusIndicator = document.getElementById('autoAnnotateStatus');
        const statusTooltip = document.getElementById('autoAnnotateTooltip');
        
        if (!statusIndicator || !statusTooltip) return;
        
        if (this.objectDetector.isModelLoaded) {
            // Model is loaded
            statusIndicator.className = 'auto-annotate-status loaded';
            statusTooltip.textContent = `${this.objectDetector.availableModels[this.objectDetector.activeModelType].name} loaded`;
        } else if (this.objectDetector.modelLoadingPromise) {
            // Model is currently loading
            statusIndicator.className = 'auto-annotate-status';
            statusTooltip.textContent = 'Model loading...';
        } else {
            // Model is not loaded
            statusIndicator.className = 'auto-annotate-status';
            statusTooltip.textContent = 'Model not loaded (click to download)';
        }
    }
    
    /**
     * Create the auto-annotate and train model buttons
     */
    createButtons() {
        // Create Auto Annotate button if it doesn't exist
        if (!document.getElementById(this.AUTO_ANNOTATE_BTN_ID)) {
            // Create wrapper for button (needed for status indicator)
            const buttonWrapper = document.createElement('div');
            buttonWrapper.className = 'auto-annotate-wrapper';
            
            // Create the button
            const button = document.createElement('button');
            button.id = this.AUTO_ANNOTATE_BTN_ID;
            button.classList.add('btn', 'btn-secondary', 'btn-with-icon');
            button.title = 'Auto Annotate using AI';
            button.innerHTML = '<i class="fas fa-magic"></i><span class="button-text">Auto Annotate</span>';
            
            // Create status indicator
            const statusIndicator = document.createElement('span');
            statusIndicator.className = 'auto-annotate-status';
            statusIndicator.id = 'autoAnnotateStatus';
            
            // Create tooltip for status
            const statusTooltip = document.createElement('span');
            statusTooltip.className = 'status-tooltip';
            statusTooltip.id = 'autoAnnotateTooltip';
            statusTooltip.textContent = 'Model not loaded';
            
            // Add everything to the wrapper
            buttonWrapper.appendChild(button);
            buttonWrapper.appendChild(statusIndicator);
            buttonWrapper.appendChild(statusTooltip);
            
            // Find the upload area to place the button after it
            const uploadArea = document.getElementById('uploadArea');
            if (uploadArea && uploadArea.parentNode) {
                uploadArea.parentNode.insertBefore(buttonWrapper, uploadArea.nextSibling);
            }
        }
        
        // Create Train Model button if it doesn't exist
        if (!document.getElementById(this.TRAIN_MODEL_BTN_ID)) {
            const button = document.createElement('button');
            button.id = this.TRAIN_MODEL_BTN_ID;
            button.classList.add('btn', 'btn-with-icon', 'train-model-btn', 'coming-soon-btn'); // Added coming-soon-btn class
            button.title = 'Train Custom Model - Coming Soon!'; // Updated tooltip
            button.innerHTML = '<i class="fas fa-brain"></i><span class="button-text">Train Model</span><span class="coming-soon-badge">Coming Soon</span>'; // Added badge
            
            // Place the button after the Auto Annotate button wrapper
            const autoAnnotateWrapper = document.querySelector('.auto-annotate-wrapper');
            if (autoAnnotateWrapper && autoAnnotateWrapper.parentNode) {
                autoAnnotateWrapper.parentNode.insertBefore(button, autoAnnotateWrapper.nextSibling);
            }
        }
        
        // Update the button status based on model loading state
        this.updateButtonStatus();
    }
    
    /**
     * Create the progress overlay
     */
    createProgressOverlay() {
        // Check if overlay already exists
        if (document.getElementById(this.PROGRESS_OVERLAY_ID)) {
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = this.PROGRESS_OVERLAY_ID;
        overlay.className = 'progress-overlay hidden';
        
        overlay.innerHTML = `
            <div class="progress-content">
                <h3 id="progressTitle">Loading Model</h3>
                <div class="progress-bar-container">
                    <progress id="modelProgress" max="100" value="0"></progress>
                    <span id="progressText">0%</span>
                </div>
                <p id="statusMessage" class="status-message"></p>
                <button id="cancelModelOperation" class="btn btn-outline">Cancel</button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Add cancel event listener
        document.getElementById('cancelModelOperation').addEventListener('click', () => {
            if (this.trainingStatus === 'training') {
                this.modelTrainer.cancelTraining();
            } else {
                this.hideProgressOverlay();
            }
        });
    }
    
    /**
     * Create the settings dialog for model configuration and selection
     */
    createSettingsDialog() {
        // Check if dialog already exists
        if (document.getElementById(this.SETTINGS_DIALOG_ID)) {
            return;
        }

        const dialog = document.createElement('div');
        dialog.id = this.SETTINGS_DIALOG_ID;
        dialog.className = 'help-dialog hidden';
        
        // Get available models
        const availableModels = this.objectDetector.getAvailableModels();
        let modelOptions = '';
        Object.keys(availableModels).forEach(modelKey => {
            const model = availableModels[modelKey];
            const isDisabled = model.enabled === false;
            modelOptions += `
                <div class="model-option ${isDisabled ? 'disabled' : ''}">
                    <input type="radio" id="model_${modelKey}" name="modelType" value="${modelKey}" 
                           ${modelKey === this.objectDetector.activeModelType ? 'checked' : ''}
                           ${isDisabled ? 'disabled' : ''}>
                    <label for="model_${modelKey}">
                        <div class="model-name">
                            ${model.name} <span class="model-size">${model.size}</span>
                            ${isDisabled ? '<span class="coming-soon-tag">Coming Soon</span>' : ''}
                        </div>
                        <div class="model-desc">${model.description}</div>
                    </label>
                </div>
            `;
        });
        
        dialog.innerHTML = `
            <div class="help-dialog-content">
                <div class="help-header">
                    <h3>Auto Annotation Settings</h3>
                    <button id="closeSettingsBtn" class="btn btn-icon btn-ghost">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="help-body">
                    <div class="form-group">
                        <label class="form-label">Model Selection</label>
                        <div class="model-options">
                            ${modelOptions}
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="confidenceThreshold" class="form-label">Confidence Threshold</label>
                        <div class="slider-container">
                            <input type="range" id="confidenceThreshold" min="0" max="100" value="50" class="slider">
                            <span id="confidenceValue">50%</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="classMapping" class="form-label">Class Mapping</label>
                        <div id="classMapping" class="class-mapping-container">
                            <p>Class mapping will be generated automatically based on your defined classes.</p>
                        </div>
                    </div>
                    <div class="form-group settings-actions">
                        <button id="startAutoAnnotateBtn" class="btn btn-primary btn-with-icon">
                            <i class="fas fa-magic"></i>
                            <span>Start Auto Annotation</span>
                        </button>
                    </div>
                    <div class="custom-model-section">
                        <div class="section-divider">
                            <span>or use your custom trained model</span>
                        </div>
                        <div id="savedModelsContainer" class="saved-models-container">
                            <p>No custom models available</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Add event listeners
        document.getElementById('closeSettingsBtn').addEventListener('click', () => {
            this.hideSettingsDialog();
        });
        
        const confidenceSlider = document.getElementById('confidenceThreshold');
        const confidenceValue = document.getElementById('confidenceValue');
        
        confidenceSlider.addEventListener('input', () => {
            confidenceValue.textContent = `${confidenceSlider.value}%`;
        });
        
        document.getElementById('startAutoAnnotateBtn').addEventListener('click', () => {
            // Get selected model
            const selectedModelEl = document.querySelector('input[name="modelType"]:checked');
            if (selectedModelEl) {
                this.objectDetector.setModelType(selectedModelEl.value);
            }
            
            const confidenceThreshold = parseInt(confidenceSlider.value) / 100;
            this.hideSettingsDialog();
            this.runAutoAnnotation(confidenceThreshold);
        });
        
        // Add event listeners for model selection radio buttons
        document.querySelectorAll('input[name="modelType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                // Reset model when changing type
                if (this.objectDetector.activeModelType !== e.target.value) {
                    this.objectDetector.setModelType(e.target.value);
                    this.objectDetector.isModelLoaded = false;
                    this.objectDetector.model = null;
                }
            });
        });
    }
    
    /**
     * Create the training dialog for model training options
     */
    createTrainingDialog() {
        // Check if dialog already exists
        if (document.getElementById(this.TRAINING_DIALOG_ID)) {
            return;
        }

        const dialog = document.createElement('div');
        dialog.id = this.TRAINING_DIALOG_ID;
        dialog.className = 'help-dialog hidden';
        
        dialog.innerHTML = `
            <div class="help-dialog-content wide-dialog">
                <div class="help-header">
                    <h3>Train Custom Object Detection Model</h3>
                    <button id="closeTrainingBtn" class="btn btn-icon btn-ghost">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="help-body">
                    <div class="training-tabs">
                        <button class="tab-btn active" data-tab="train">Train Model</button>
                        <button class="tab-btn" data-tab="manage">Manage Models</button>
                    </div>
                    
                    <div class="tab-content" id="trainTab">
                        <div class="form-group">
                            <label for="modelName" class="form-label">Model Name</label>
                            <input type="text" id="modelName" class="form-control" value="my-custom-detector" placeholder="Enter model name">
                        </div>
                        
                        <div class="form-group">
                            <label for="epochs" class="form-label">Training Epochs</label>
                            <div class="slider-container">
                                <input type="range" id="epochs" min="5" max="50" value="10" class="slider">
                                <span id="epochsValue">10</span>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="learningRate" class="form-label">Learning Rate</label>
                            <div class="slider-container">
                                <input type="range" id="learningRate" min="1" max="100" value="10" class="slider">
                                <span id="learningRateValue">0.001</span>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="validationSplit" class="form-label">Validation Split</label>
                            <div class="slider-container">
                                <input type="range" id="validationSplit" min="10" max="40" value="20" class="slider">
                                <span id="validationSplitValue">20%</span>
                            </div>
                        </div>
                        
                        <div class="training-info">
                            <div class="info-card">
                                <i class="fas fa-info-circle"></i>
                                <div>
                                    <h4>Training Information</h4>
                                    <p>Training will use your current annotations and images to create a custom object detection model. This process may take several minutes and will use your device's GPU if available.</p>
                                </div>
                            </div>
                            
                            <div class="warning-card">
                                <i class="fas fa-exclamation-triangle"></i>
                                <div>
                                    <h4>Requirements</h4>
                                    <ul>
                                        <li>At least 5 annotated images</li>
                                        <li>Modern browser with WebGL support</li>
                                        <li>Do not close the browser during training</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        
                        <div class="settings-actions">
                            <button id="startTrainingBtn" class="btn btn-primary btn-with-icon">
                                <i class="fas fa-play"></i>
                                <span>Start Training</span>
                            </button>
                        </div>
                    </div>
                    
                    <div class="tab-content hidden" id="manageTab">
                        <div class="saved-models-list">
                            <div id="savedModelsList" class="models-list">
                                <p>Loading saved models...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Add event listeners
        document.getElementById('closeTrainingBtn').addEventListener('click', () => {
            this.hideTrainingDialog();
        });
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Hide all tabs
                document.querySelectorAll('.tab-content').forEach(tab => {
                    tab.classList.add('hidden');
                });
                
                // Remove active class from all buttons
                document.querySelectorAll('.tab-btn').forEach(b => {
                    b.classList.remove('active');
                });
                
                // Show selected tab
                const tabName = btn.dataset.tab;
                document.getElementById(`${tabName}Tab`).classList.remove('hidden');
                
                // Add active class to clicked button
                btn.classList.add('active');
                
                // If manage tab selected, load saved models
                if (tabName === 'manage') {
                    this.loadSavedModels();
                }
            });
        });
        
        // Slider event listeners
        const epochsSlider = document.getElementById('epochs');
        const epochsValue = document.getElementById('epochsValue');
        
        epochsSlider.addEventListener('input', () => {
            epochsValue.textContent = epochsSlider.value;
        });
        
        const learningRateSlider = document.getElementById('learningRate');
        const learningRateValue = document.getElementById('learningRateValue');
        
        learningRateSlider.addEventListener('input', () => {
            const rate = (learningRateSlider.value / 10000).toFixed(4);
            learningRateValue.textContent = rate;
        });
        
        const validationSplitSlider = document.getElementById('validationSplit');
        const validationSplitValue = document.getElementById('validationSplitValue');
        
        validationSplitSlider.addEventListener('input', () => {
            validationSplitValue.textContent = `${validationSplitSlider.value}%`;
        });
        
        // Start training button
        document.getElementById('startTrainingBtn').addEventListener('click', () => {
            const modelName = document.getElementById('modelName').value;
            const epochs = parseInt(document.getElementById('epochs').value);
            const learningRate = parseFloat(document.getElementById('learningRateValue').textContent);
            const validationSplit = parseInt(document.getElementById('validationSplit').value) / 100;
            
            this.hideTrainingDialog();
            this.startModelTraining({
                modelName,
                epochs,
                learningRate,
                validationSplit
            });
        });
    }
    
    /**
     * Bind event listeners for UI elements
     */
    bindEventListeners() {
        // Auto-annotate button
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.bindButtonListeners());
        } else {
            this.bindButtonListeners();
        }
        
        // Model training progress event
        window.addEventListener('modelTrainingProgress', (e) => {
            this.updateProgress(e.detail.progress, e.detail.message);
        });
    }
    
    /**
     * Bind button click listeners
     */
    bindButtonListeners() {
        const autoAnnotateBtn = document.getElementById(this.AUTO_ANNOTATE_BTN_ID);
        if (autoAnnotateBtn) {
            autoAnnotateBtn.addEventListener('click', () => {
                this.handleAutoAnnotateClick();
            });
        }
        
        const trainModelBtn = document.getElementById(this.TRAIN_MODEL_BTN_ID);
        if (trainModelBtn) {
            trainModelBtn.addEventListener('click', () => {
                this.handleTrainModelClick();
            });
        }
    }
    
    /**
     * Handle Auto Annotate button click
     */
    handleAutoAnnotateClick() {
        try {
            // If no image is loaded, show warning
            if (typeof currentImageIndex === 'undefined' || currentImageIndex === -1 || 
                typeof images === 'undefined' || images.length === 0) {
                if (typeof showWarning === 'function') {
                    showWarning('Please upload an image first');
                } else {
                    alert('Please upload an image first');
                }
                return;
            }
    
            // If no classes are defined, show warning
            if (typeof classes === 'undefined' || classes.length === 0) {
                if (typeof showWarning === 'function') {
                    showWarning('Please create at least one class before using auto-annotation');
                } else {
                    alert('Please create at least one class before using auto-annotation');
                }
                return;
            }
    
            // Check if model is already loaded
            if (this.objectDetector && !this.objectDetector.isModelLoaded) {
                // Get the appropriate message based on the model type
                let modelType = 'default';
                let modelSize = '~6MB';
                
                if (this.objectDetector && this.objectDetector.activeModelType && 
                    this.objectDetector.availableModels && 
                    this.objectDetector.availableModels[this.objectDetector.activeModelType]) {
                    
                    const modelInfo = this.objectDetector.availableModels[this.objectDetector.activeModelType];
                    modelType = modelInfo.name || 'detection';
                    modelSize = modelInfo.size || '~6MB';
                }
                
                // Prompt the user to confirm loading the model
                const confirmMessage = `Auto-annotation requires downloading the ${modelType} model (${modelSize}).\n\nDo you want to download it now?`;
                
                if (!confirm(confirmMessage)) {
                    // User canceled
                    console.log("User canceled model download");
                    return;
                }
                
                // User confirmed - proceed with showing settings dialog
            }
    
            // Show settings dialog
            this.updateSettingsDialog();
            this.showSettingsDialog();
        } catch (error) {
            console.error('Error in handleAutoAnnotateClick:', error);
            if (typeof showWarning === 'function') {
                showWarning(`Error: ${error.message}`);
            } else {
                alert(`Error: ${error.message}`);
            }
        }
    }
    
    /**
     * Handle Train Model button click
     */
    handleTrainModelClick() {
        // Show "coming soon" message instead of opening the dialog
        if (typeof showWarning === 'function') {
            showWarning('Model training feature coming soon!');
        } else {
            alert('Model training feature coming soon!');
        }
    }
    
    /**
     * Update settings dialog with current information
     */
    updateSettingsDialog() {
        this.updateClassMappingUI();
        
        // Update model selection
        const modelRadio = document.querySelector(`input[value="${this.objectDetector.activeModelType}"]`);
        if (modelRadio) {
            modelRadio.checked = true;
        }
        
        // Update saved models section
        this.loadSavedModels();
    }
    
    /**
     * Show the settings dialog
     */
    showSettingsDialog() {
        const dialog = document.getElementById(this.SETTINGS_DIALOG_ID);
        if (dialog) {
            dialog.classList.remove('hidden');
        }
    }
    
    /**
     * Hide the settings dialog
     */
    hideSettingsDialog() {
        const dialog = document.getElementById(this.SETTINGS_DIALOG_ID);
        if (dialog) {
            dialog.classList.add('hidden');
        }
    }
    
    /**
     * Show the training dialog
     */
    showTrainingDialog() {
        const dialog = document.getElementById(this.TRAINING_DIALOG_ID);
        if (dialog) {
            dialog.classList.remove('hidden');
            
            // Reset to first tab
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.add('hidden');
            });
            
            const trainTab = document.querySelector('.tab-btn[data-tab="train"]');
            if (trainTab) {
                trainTab.classList.add('active');
            }
            
            const tabContent = document.getElementById('trainTab');
            if (tabContent) {
                tabContent.classList.remove('hidden');
            }
        }
    }
    
    /**
     * Hide the training dialog
     */
    hideTrainingDialog() {
        const dialog = document.getElementById(this.TRAINING_DIALOG_ID);
        if (dialog) {
            dialog.classList.add('hidden');
        }
    }
    
    /**
     * Show the progress overlay
     */
    showProgressOverlay(title = 'Loading Model') {
        const overlay = document.getElementById(this.PROGRESS_OVERLAY_ID);
        if (overlay) {
            const titleEl = document.getElementById('progressTitle');
            if (titleEl) titleEl.textContent = title;
            
            const progressBar = document.getElementById('modelProgress');
            if (progressBar) progressBar.value = 0;
            
            const progressText = document.getElementById('progressText');
            if (progressText) progressText.textContent = '0%';
            
            const statusMessage = document.getElementById('statusMessage');
            if (statusMessage) statusMessage.textContent = '';
            
            overlay.classList.remove('hidden');
        }
    }
    
    /**
     * Hide the progress overlay
     */
    hideProgressOverlay() {
        const overlay = document.getElementById(this.PROGRESS_OVERLAY_ID);
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }
    
    /**
     * Update the progress overlay with loading progress
     */
    updateProgress(progress, message = '') {
        const progressBar = document.getElementById('modelProgress');
        const progressText = document.getElementById('progressText');
        const statusMessage = document.getElementById('statusMessage');
        
        if (progressBar) {
            progressBar.value = progress;
        }
        
        if (progressText) {
            progressText.textContent = `${Math.round(progress)}%`;
        }
        
        if (message && statusMessage) {
            statusMessage.textContent = message;
        }
    }
    
    /**
     * Update the class mapping UI
     */
    updateClassMappingUI() {
        const mappingContainer = document.getElementById('classMapping');
        if (!mappingContainer) return;
        
        // If classes is undefined, show message
        if (typeof classes === 'undefined') {
            mappingContainer.innerHTML = '<p>Cannot access class information.</p>';
            return;
        }
        
        // If no user classes, show message
        if (classes.length === 0) {
            mappingContainer.innerHTML = '<p>Please create classes first.</p>';
            return;
        }
        
        // Generate class mapping
        const mapping = this.objectDetector.generateClassMapping(classes);
        const modelClasses = this.objectDetector.getAvailableClasses();
        
        // Filter to only show mappings that exist
        const mappedClasses = Object.keys(mapping);
        
        if (mappedClasses.length === 0) {
            mappingContainer.innerHTML = '<p>No matching classes found. Auto-annotation will still work, but you may need to relabel objects.</p>';
            return;
        }
        
        // Create the mapping display
        let html = '<div class="mapping-list">';
        
        mappedClasses.forEach(modelClass => {
            const userClass = mapping[modelClass];
            html += `
                <div class="mapping-item">
                    <span class="model-class">${modelClass}</span>
                    <i class="fas fa-arrow-right"></i>
                    <span class="user-class">${userClass}</span>
                </div>
            `;
        });
        
        html += '</div>';
        
        // Add note about other classes
        const unmappedCount = modelClasses.length - mappedClasses.length;
        if (unmappedCount > 0) {
            html += `<p class="mapping-note">${unmappedCount} other object types can be detected but will need manual class assignment.</p>`;
        }
        
        mappingContainer.innerHTML = html;
    }
    
    /**
     * Load and display saved models
     */
    async loadSavedModels() {
        try {
            const savedModelsContainer = document.getElementById('savedModelsList');
            if (!savedModelsContainer) return;
            
            savedModelsContainer.innerHTML = '<p>Loading saved models...</p>';
            
            // Check if TensorFlow.js is loaded
            if (typeof tf === 'undefined') {
                await this.modelTrainer._loadRequiredScripts();
            }
            
            // Get saved models
            const savedModels = await this.modelTrainer.getSavedModels();
            
            if (savedModels.length === 0) {
                savedModelsContainer.innerHTML = '<p>No custom models available</p>';
                return;
            }
            
            // Create the models list
            let html = '';
            
            savedModels.forEach(model => {
                // Format date
                const date = new Date(model.lastModified);
                const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                
                // Format size
                const sizeMB = (model.sizeBytes / (1024 * 1024)).toFixed(2);
                
                html += `
                    <div class="model-card">
                        <div class="model-card-header">
                            <h4>${model.name}</h4>
                            <div class="model-card-actions">
                                <button class="btn btn-sm btn-with-icon use-model-btn" data-model="${model.name}">
                                    <i class="fas fa-play"></i>
                                    <span>Use</span>
                                </button>
                                <button class="btn btn-sm btn-with-icon delete-model-btn" data-model="${model.name}">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                        <div class="model-card-body">
                            <div class="model-stats">
                                <div class="model-stat">
                                    <i class="fas fa-weight-hanging"></i>
                                    <span>${sizeMB} MB</span>
                                </div>
                                <div class="model-stat">
                                    <i class="fas fa-calendar"></i>
                                    <span>${formattedDate}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            savedModelsContainer.innerHTML = html;
            
            // Add event listeners to buttons
            document.querySelectorAll('.use-model-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const modelName = btn.dataset.model;
                    try {
                        this.hideTrainingDialog();
                        this.showProgressOverlay('Loading Custom Model');
                        this.updateProgress(0, `Loading model ${modelName}...`);
                        
                        await this.modelTrainer.loadSavedModel(modelName);
                        
                        this.updateProgress(100, 'Model loaded successfully');
                        
                        // Wait a moment and then use the model
                        setTimeout(() => {
                            this.hideProgressOverlay();
                            this.runCustomModelAnnotation();
                        }, 1000);
                    } catch (error) {
                        console.error('Error loading model:', error);
                        this.updateProgress(0, `Error: ${error.message}`);
                        setTimeout(() => this.hideProgressOverlay(), 3000);
                    }
                });
            });
            
            document.querySelectorAll('.delete-model-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const modelName = btn.dataset.model;
                    if (confirm(`Are you sure you want to delete model "${modelName}"?`)) {
                        try {
                            await this.modelTrainer.deleteSavedModel(modelName);
                            this.loadSavedModels(); // Refresh the list
                        } catch (error) {
                            console.error('Error deleting model:', error);
                            alert(`Error deleting model: ${error.message}`);
                        }
                    }
                });
            });
            
        } catch (error) {
            console.error('Error loading saved models:', error);
            const savedModelsContainer = document.getElementById('savedModelsList');
            if (savedModelsContainer) {
                savedModelsContainer.innerHTML = `<p class="error-message">Error loading saved models: ${error.message}</p>`;
            }
        }
    }
    
    /**
     * Run auto-annotation with the pre-trained model
     */
    async runAutoAnnotation(confidenceThreshold = 0.5) {
        try {
            if (this.detectionInProgress) return;
            this.detectionInProgress = true;
            
            // Show loading overlay
            this.showProgressOverlay('Processing Image');
            this.updateProgress(0, 'Loading model...');
            
            // Load the model if not already loaded
            if (!this.objectDetector.isModelLoaded) {
                try {
                    await this.objectDetector.loadModel((progress, message) => {
                        this.updateProgress(progress, message);
                    });
                    
                    // Verify model loaded successfully
                    if (!this.objectDetector.model) {
                        throw new Error('Model failed to load properly');
                    }
                } catch (loadError) {
                    console.error('Model loading failed:', loadError);
                    this.updateProgress(0, `Error loading model: ${loadError.message}`);
                    setTimeout(() => {
                        this.hideProgressOverlay();
                        this.detectionInProgress = false;
                    }, 3000);
                    return;
                }
            } else {
                this.updateProgress(30, 'Model ready');
            }
            
            // Get the current image
            if (typeof currentImageIndex === 'undefined' || typeof images === 'undefined') {
                throw new Error('Cannot access image data');
            }
            
            const imageObj = images[currentImageIndex];
            if (!imageObj) {
                throw new Error('No image selected');
            }
            
            this.updateProgress(40, 'Preparing image...');
            
            // Create an image element for the model
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = imageObj.src;
            
            // Wait for the image to load if it hasn't already
            if (!img.complete) {
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = () => reject(new Error('Failed to load image for detection'));
                });
            }
            
            this.updateProgress(50, 'Running object detection...');
            
            // Generate class mapping
            if (typeof classes !== 'undefined') {
                const mapping = this.objectDetector.generateClassMapping(classes);
                this.objectDetector.setClassMapping(mapping);
            }
            
            // Run object detection
            const detections = await this.objectDetector.detectObjects(img, confidenceThreshold);
            
            // Get performance stats
            const stats = this.objectDetector.getPerformanceStats();
            this.updateProgress(80, `Found ${detections.length} objects (${stats.inferenceTime.toFixed(0)}ms)`);
            
            // Verify required global functions and variables exist
            if (typeof annotationIdCounter === 'undefined' || 
                typeof annotations === 'undefined' || 
                typeof addClass === 'undefined' || 
                typeof classColors === 'undefined' || 
                typeof saveAnnotations === 'undefined' || 
                typeof redraw === 'undefined') {
                throw new Error('Required functions or variables are not available');
            }
            
            // Convert detections to annotations
            const newAnnotations = this.objectDetector.detectionsToAnnotations(
                detections,
                imageObj.originalWidth,
                imageObj.originalHeight,
                annotationIdCounter
            );
            
            this.updateProgress(90, `Creating ${detections.length} annotations...`);
            
            // Process each annotation
            if (newAnnotations.length > 0) {
                // Prepare annotations
                newAnnotations.forEach(annotation => {
                    // Check if we need to create this class
                    if (!classes.includes(annotation.class)) {
                        // Add the class
                        addClass(annotation.class);
                    }
                    // Find the class index
                    const classIndex = classes.indexOf(annotation.class);
                    // Assign the color
                    annotation.color = classColors[annotation.class];
                    // Increment the annotation ID counter
                    annotationIdCounter++;
                });
                
                // Add the new annotations to the current image
                annotations = [...annotations, ...newAnnotations];
                
                // Save annotations
                saveAnnotations();
                
                // Redraw the canvas
                redraw();
                
                this.updateProgress(100, `Added ${newAnnotations.length} annotations`);
                
                // Wait a moment before hiding the overlay
                setTimeout(() => {
                    this.hideProgressOverlay();
                    this.detectionInProgress = false;
                }, 1500);
            } else {
                this.updateProgress(100, 'No objects detected above threshold');
                
                // Wait a moment before hiding the overlay
                setTimeout(() => {
                    this.hideProgressOverlay();
                    this.detectionInProgress = false;
                }, 1500);
            }
        } catch (error) {
            console.error('Auto-annotation error:', error);
            this.updateProgress(0, `Error: ${error.message}`);
            
            // Wait a moment before hiding the overlay
            setTimeout(() => {
                this.hideProgressOverlay();
                this.detectionInProgress = false;
            }, 3000);
        }
    }
    
    /**
     * Run auto-annotation with a custom trained model
     */
    async runCustomModelAnnotation(confidenceThreshold = 0.25) {
        try {
            if (this.detectionInProgress) return;
            this.detectionInProgress = true;
            
            // Show loading overlay
            this.showProgressOverlay('Processing with Custom Model');
            this.updateProgress(30, 'Model ready');
            
            // Verify required global functions and variables exist
            if (typeof currentImageIndex === 'undefined' || 
                typeof images === 'undefined' ||
                typeof classes === 'undefined') {
                
                throw new Error('Required variables are not available');
            }
            
            // Get the current image
            const imageObj = images[currentImageIndex];
            if (!imageObj) {
                throw new Error('No image selected');
            }
            
            this.updateProgress(40, 'Preparing image...');
            
            // Create an image element for the model
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = imageObj.src;
            
            // Wait for the image to load if it hasn't already
            if (!img.complete) {
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = () => reject(new Error('Failed to load image for detection'));
                });
            }
            
            this.updateProgress(50, 'Running custom model detection...');
            
            // Run detection with the custom model
            const startTime = performance.now();
            const detections = await this.modelTrainer.detectWithTrainedModel(img, classes, confidenceThreshold);
            const inferenceTime = performance.now() - startTime;
            
            this.updateProgress(80, `Found ${detections.length} objects (${inferenceTime.toFixed(0)}ms)`);
            
            // Verify more required variables
            if (typeof annotationIdCounter === 'undefined' || 
                typeof annotations === 'undefined' || 
                typeof classColors === 'undefined' || 
                typeof saveAnnotations === 'undefined' || 
                typeof redraw === 'undefined') {
                
                throw new Error('Required functions or variables are not available');
            }
            
            // Convert detections to annotations
            const newAnnotations = this.objectDetector.detectionsToAnnotations(
                detections,
                imageObj.originalWidth,
                imageObj.originalHeight,
                annotationIdCounter
            );
            
            this.updateProgress(90, `Creating ${detections.length} annotations...`);
            
            // Process each annotation
            if (newAnnotations.length > 0) {
                // Prepare annotations
                newAnnotations.forEach(annotation => {
                    // Check if the class exists
                    if (!classes.includes(annotation.class)) {
                        console.warn(`Class "${annotation.class}" not found. Using default class.`);
                        annotation.class = classes[0]; // Use first class as default
                    }
                    
                    // Assign the color
                    annotation.color = classColors[annotation.class];
                    
                    // Increment the annotation ID counter
                    annotationIdCounter++;
                });
                
                // Add the new annotations to the current image
                annotations = [...annotations, ...newAnnotations];
                
                // Save annotations
                saveAnnotations();
                
                // Redraw the canvas
                redraw();
                
                this.updateProgress(100, `Added ${newAnnotations.length} annotations`);
                
                // Wait a moment before hiding the overlay
                setTimeout(() => {
                    this.hideProgressOverlay();
                    this.detectionInProgress = false;
                }, 1500);
            } else {
                this.updateProgress(100, 'No objects detected above threshold');
                
                // Wait a moment before hiding the overlay
                setTimeout(() => {
                    this.hideProgressOverlay();
                    this.detectionInProgress = false;
                }, 1500);
            }
            
        } catch (error) {
            console.error('Custom model annotation error:', error);
            this.updateProgress(0, `Error: ${error.message}`);
            
            // Wait a moment before hiding the overlay
            setTimeout(() => {
                this.hideProgressOverlay();
                this.detectionInProgress = false;
            }, 2000);
        }
    }
    
    /**
     * Start the model training process
     */
    async startModelTraining(options) {
        try {
            // Show loading overlay
            this.showProgressOverlay('Training Custom Model');
            this.trainingStatus = 'preparing';
            
            this.updateProgress(0, 'Preparing training data...');
            
            // Verify required global variables exist
            if (typeof images === 'undefined' || 
                typeof annotationsData === 'undefined' || 
                typeof classes === 'undefined') {
                
                throw new Error('Required variables are not available');
            }
            
            try {
                // Ensure TensorFlow.js is loaded first
                await this.modelTrainer._loadRequiredScripts();
                this.updateProgress(10, 'TensorFlow.js loaded successfully');
                
                // Check for required browser capabilities
                if (typeof tf !== 'undefined') {
                    const webglEnabled = tf.backend() === 'webgl';
                    if (!webglEnabled) {
                        this.updateProgress(15, 'WebGL not available. Training may be slow.');
                    } else {
                        this.updateProgress(15, 'WebGL detected. GPU acceleration available.');
                    }
                }
                
                // Prepare training data
                await this.modelTrainer.prepareTrainingData(
                    images,
                    annotationsData,
                    classes,
                    options.validationSplit
                );
                
                this.trainingStatus = 'training';
                
                // Start training with extended error handling
                try {
                    await this.modelTrainer.trainModel({
                        ...options,
                        numClasses: classes.length
                    });
                } catch (trainingError) {
                    console.error('Error during model training phase:', trainingError);
                    throw new Error(`Training phase error: ${trainingError.message}`);
                }
                
                if (this.modelTrainer.trainingCancelled) {
                    this.trainingStatus = 'cancelled';
                    this.updateProgress(0, 'Training cancelled');
                    
                    setTimeout(() => {
                        this.hideProgressOverlay();
                    }, 2000);
                    
                    return;
                }
                
                this.trainingStatus = 'saving';
                this.updateProgress(95, 'Saving model...');
                
                // Save the model
                await this.modelTrainer.saveModel('indexeddb');
                
                this.trainingStatus = 'completed';
                this.updateProgress(100, 'Training completed and model saved');
                
                // Wait a moment before hiding the overlay
                setTimeout(() => {
                    this.hideProgressOverlay();
                    
                    // Show alert to let user know training is complete
                    alert('Training completed! Your custom model has been saved and is ready to use.');
                }, 2000);
                
            } catch (processingError) {
                throw processingError; // Re-throw to be caught by the outer try/catch
            }
        } catch (error) {
            console.error('Model training error:', error);
            this.trainingStatus = 'failed';
            this.updateProgress(0, `Training failed: ${error.message}`);
            
            // Log additional diagnostic information
            console.log('Model training error details:', {
                trainingStatus: this.trainingStatus,
                browserInfo: navigator.userAgent,
                availableClasses: classes ? classes.length : 'undefined',
                datasetSize: images ? images.length : 'undefined'
            });
            
            // Wait a moment before hiding the overlay
            setTimeout(() => {
                this.hideProgressOverlay();
            }, 3000);
        }
    }
    
    /**
     * Add CSS styles for UI elements
     */
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Auto Annotate Button Styles */
            #autoAnnotateBtn {
                background-color: var(--color-secondary);
                color: white;
                transition: background-color 0.2s ease;
            }
            
            #autoAnnotateBtn:hover {
                background-color: var(--color-secondary-dark);
            }
            
            /* Train Model Button Styles */
            .train-model-btn {
                background-color: #5c6ac4;
                color: white;
                transition: background-color 0.2s ease;
            }
            
            .train-model-btn:hover {
                background-color: #4a54a4;
            }
            
            /* Class Mapping Styles */
            .class-mapping-container {
                max-height: 200px;
                overflow-y: auto;
                border: 1px solid var(--color-border, #e2e8f0);
                border-radius: var(--radius-md, 0.375rem);
                padding: var(--space-3, 0.75rem);
                background-color: var(--color-surface, #f8fafc);
            }
            
            .mapping-list {
                display: flex;
                flex-direction: column;
                gap: var(--space-2, 0.5rem);
            }
            
            .mapping-item {
                display: flex;
                align-items: center;
                gap: var(--space-2, 0.5rem);
                padding: var(--space-1, 0.25rem) 0;
            }
            
            .model-class {
                color: var(--color-text-secondary, #64748b);
            }
            
            .user-class {
                font-weight: 500;
                color: var(--color-primary, #3563e9);
            }
            
            .mapping-note {
                margin-top: var(--space-2, 0.5rem);
                font-size: var(--text-sm, 0.875rem);
                color: var(--color-text-secondary, #64748b);
            }
            
            /* Model Options */
            .model-options {
                display: flex;
                flex-direction: column;
                gap: var(--space-2, 0.5rem);
                margin-bottom: var(--space-4, 1rem);
                max-height: 200px;
                overflow-y: auto;
            }
            
            .model-option {
                display: flex;
                gap: var(--space-2, 0.5rem);
                padding: var(--space-2, 0.5rem);
                border: 1px solid var(--color-border, #e2e8f0);
                border-radius: var(--radius-md, 0.375rem);
                cursor: pointer;
            }
            
            .model-option:hover {
                background-color: var(--color-surface, #f8fafc);
            }
            
            .model-option input {
                margin-top: 2px;
            }

            .model-option.disabled {
                opacity: 0.7;
                cursor: not-allowed;
                background-color: #f8f9fa;
            }

            .model-option.disabled label {
                cursor: not-allowed;
            }

            .coming-soon-tag {
                display: inline-block;
                background-color: #ffd43b;
                color: #000;
                font-size: 10px;
                padding: 2px 6px;
                border-radius: 10px;
                margin-left: 8px;
                text-transform: uppercase;
                font-weight: bold;
                letter-spacing: 0.5px;
            }
            
            .model-name {
                font-weight: 500;
                margin-bottom: var(--space-1, 0.25rem);
                display: flex;
                align-items: center;
                gap: var(--space-2, 0.5rem);
            }
            
            .model-size {
                font-size: var(--text-xs, 0.75rem);
                color: var(--color-text-secondary, #64748b);
                font-weight: normal;
            }
            
            .model-desc {
                font-size: var(--text-sm, 0.875rem);
                color: var(--color-text-secondary, #64748b);
            }
            
            /* Slider Styles */
            .slider-container {
                display: flex;
                align-items: center;
                gap: var(--space-3, 0.75rem);
            }
            
            .slider {
                flex-grow: 1;
                height: 6px;
                border-radius: var(--radius-full, 9999px);
                background: var(--color-border, #e2e8f0);
                outline: none;
                -webkit-appearance: none;
            }
            
            .slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: var(--color-primary, #3563e9);
                cursor: pointer;
            }
            
            .slider::-moz-range-thumb {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: var(--color-primary, #3563e9);
                cursor: pointer;
                border: none;
            }
            
            #confidenceValue, #epochsValue, #learningRateValue, #validationSplitValue {
                min-width: 50px;
                text-align: right;
                font-weight: 500;
            }
            
            /* Status Message */
            .status-message {
                margin-top: var(--space-3, 0.75rem);
                font-size: var(--text-sm, 0.875rem);
                color: var(--color-text-secondary, #64748b);
            }
            
            /* Settings Actions */
            .settings-actions {
                display: flex;
                justify-content: center;
                margin-top: var(--space-4, 1rem);
            }
            
            /* Dialog Styles */
            .wide-dialog {
                max-width: 700px !important;
            }
            
            /* Training Tabs */
            .training-tabs {
                display: flex;
                border-bottom: 1px solid var(--color-border, #e2e8f0);
                margin-bottom: var(--space-4, 1rem);
            }
            
            .tab-btn {
                padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
                border: none;
                background: none;
                cursor: pointer;
                font-weight: 500;
                color: var(--color-text-secondary, #64748b);
                position: relative;
            }
            
            .tab-btn.active {
                color: var(--color-primary, #3563e9);
            }
            
            .tab-btn.active:after {
                content: '';
                position: absolute;
                bottom: -1px;
                left: 0;
                right: 0;
                height: 2px;
                background-color: var(--color-primary, #3563e9);
            }
            
            /* Training Info */
            .training-info {
                margin: var(--space-4, 1rem) 0;
                display: flex;
                flex-direction: column;
                gap: var(--space-3, 0.75rem);
            }
            
            .info-card, .warning-card {
                display: flex;
                align-items: flex-start;
                gap: var(--space-3, 0.75rem);
                padding: var(--space-3, 0.75rem);
                border-radius: var(--radius-md, 0.375rem);
            }
            
            .info-card {
                background-color: var(--color-primary-light, #eef2ff);
                border-left: 3px solid var(--color-primary, #3563e9);
            }
            
            .warning-card {
                background-color: #fff3e0;
                border-left: 3px solid #f57c00;
            }
            
            .info-card i, .warning-card i {
                font-size: var(--text-xl, 1.25rem);
                margin-top: var(--space-1, 0.25rem);
            }
            
            .info-card i {
                color: var(--color-primary, #3563e9);
            }
            
            .warning-card i {
                color: #f57c00;
            }
            
            .info-card h4, .warning-card h4 {
                margin-bottom: var(--space-2, 0.5rem);
                margin-top: 0;
            }
            
            .info-card p, .warning-card p {
                margin: 0;
                font-size: var(--text-sm, 0.875rem);
            }
            
            .warning-card ul {
                margin: var(--space-2, 0.5rem) 0 0;
                padding-left: var(--space-4, 1rem);
                font-size: var(--text-sm, 0.875rem);
            }

            .coming-soon-btn {
                position: relative;
                opacity: 0.8;
                cursor: not-allowed;
            }

            .coming-soon-badge {
                position: absolute;
                top: -8px;
                right: -10px;
                background-color: #ff9800;
                color: white;
                font-size: 10px;
                padding: 2px 6px;
                border-radius: 10px;
                font-weight: bold;
                text-transform: uppercase;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                pointer-events: none;
            }
            
            /* Section Divider */
            .section-divider {
                display: flex;
                align-items: center;
                margin: var(--space-6, 1.5rem) 0 var(--space-4, 1rem);
                color: var(--color-text-secondary, #64748b);
                font-size: var(--text-sm, 0.875rem);
            }
            
            .section-divider:before, .section-divider:after {
                content: '';
                flex: 1;
                border-top: 1px solid var(--color-border, #e2e8f0);
            }
            
            .section-divider span {
                padding: 0 var(--space-3, 0.75rem);
            }
            
            /* Saved Models List */
            .models-list {
                display: flex;
                flex-direction: column;
                gap: var(--space-3, 0.75rem);
                max-height: 400px;
                overflow-y: auto;
            }
            
            .model-card {
                border: 1px solid var(--color-border, #e2e8f0);
                border-radius: var(--radius-md, 0.375rem);
                overflow: hidden;
            }
            
            .model-card-header {
                padding: var(--space-3, 0.75rem);
                background-color: var(--color-surface, #f8fafc);
                border-bottom: 1px solid var(--color-border, #e2e8f0);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .model-card-header h4 {
                margin: 0;
                font-size: var(--text-base, 1rem);
            }
            
            .model-card-body {
                padding: var(--space-3, 0.75rem);
            }
            
            .model-card-actions {
                display: flex;
                gap: var(--space-2, 0.5rem);
            }
            
            .btn-sm {
                padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
                font-size: var(--text-sm, 0.875rem);
            }
            
            .use-model-btn {
                background-color: var(--color-primary, #3563e9);
                color: white;
            }
            
            .delete-model-btn {
                background-color: var(--color-error, #ef4444);
                color: white;
            }
            
            .model-stats {
                display: flex;
                gap: var(--space-4, 1rem);
                font-size: var(--text-sm, 0.875rem);
                color: var(--color-text-secondary, #64748b);
            }
            
            .model-stat {
                display: flex;
                align-items: center;
                gap: var(--space-2, 0.5rem);
            }
            
            .error-message {
                color: var(--color-error, #ef4444);
            }
            
            /* Progress Overlay */
            .progress-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(255, 255, 255, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            }
            
            .progress-content {
                background-color: white;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
                padding: 24px;
                width: 90%;
                max-width: 400px;
            }
            
            .progress-content h3 {
                margin-top: 0;
                margin-bottom: 16px;
                text-align: center;
            }
            
            .progress-bar-container {
                margin-bottom: 16px;
            }
            
            .progress-bar-container progress {
                width: 100%;
                height: 10px;
                border-radius: 5px;
                margin-bottom: 8px;
            }
            
            .progress-bar-container span {
                display: block;
                text-align: center;
                font-weight: bold;
            }
            
            /* Dialog */
            .help-dialog {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 9999;
                background-color: white;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                max-width: 90%;
                width: 500px;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
            }
            
            .help-dialog-content {
                display: flex;
                flex-direction: column;
                height: 100%;
            }
            
            .help-header {
                padding: 16px 20px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .help-header h3 {
                margin: 0;
                font-size: 18px;
            }
            
            .help-body {
                padding: 20px;
                overflow-y: auto;
                flex: 1;
            }
            
            .form-label {
                display: block;
                margin-bottom: 8px;
                font-weight: 500;
            }
            
            .form-control {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #e2e8f0;
                border-radius: 4px;
                font-size: 14px;
            }
            
            .hidden {
                display: none !important;
            }
        `;
        
        document.head.appendChild(style);
    }
}