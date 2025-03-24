/**
 * EnhancedObjectDetection.js - Provides advanced model loading and inference capabilities
 * with support for YOLOv8 and other high-performance models
 */

// Create global variable
window.enhancedObjectDetector = null;

class EnhancedObjectDetector {
    constructor() {
        this.model = null;
        this.isModelLoaded = false;
        this.modelLoadingPromise = null;
        this.activeModelType = 'coco-ssd'; // default to coco-ssd for reliability
        this.onnxSession = null;
        this.onnxInference = null;
        this.inferenceTime = 0;
        // Available models configuration
        this.availableModels = {
            'coco-ssd': {
                name: 'COCO-SSD (Faster)',
                description: 'Lightweight model for basic object detection (80 classes)',
                url: 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js',
                type: 'tfjs',
                size: '~6MB',
                accuracy: 'Basic',
                enabled: true
            },
            'yolov8n': {
                name: 'YOLOv8-Nano (Balanced)',
                description: 'Good balance between speed and accuracy (80 classes)',
                url: '/models/yolov8n/model.json', // Local path - must be set up correctly
                type: 'tfjs',
                size: '~13MB',
                accuracy: 'Good',
                enabled: false
            },
            'yolov8s': {
                name: 'YOLOv8-Small (Accurate)',
                description: 'Higher accuracy model in development',
                url: '',
                type: 'tfjs',
                size: '~44MB',
                accuracy: 'Excellent',
                enabled: false
            }
        };
        // COCO classes for YOLOv8
        this.cocoClasses = [
            'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
            'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse',
            'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie',
            'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
            'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon',
            'bowl', 'banana', 'apple', 'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut',
            'cake', 'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
            'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book',
            'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
        ];
        // Default class mapping from model to user classes
        this.classMapping = null;
        
        // Do NOT initialize model loading here
        console.log('EnhancedObjectDetector initialized (model will load on demand)');
    }

    /**
     * Gets the list of available models
     */
    getAvailableModels() {
        return this.availableModels;
    }

    /**
     * Set the active model type
     * @param {string} modelType - The model type to use (e.g., 'yolov8n')
     */
    setModelType(modelType) {
        if (this.availableModels[modelType]) {
            // Check if model is enabled
            if (this.availableModels[modelType].enabled === false) {
                console.warn(`Model ${modelType} is not yet available`);
                return false;
            }

            // Reset model if changing type
            if (this.activeModelType !== modelType) {
                this.isModelLoaded = false;
                this.model = null;
                this.modelLoadingPromise = null;
            }
            this.activeModelType = modelType;
            return true;
        }
        return false;
    }

    /**
     * Check if a model file exists at the given URL
     * @param {string} url - URL to check
     * @returns {Promise<boolean>} - Whether the file exists
     */
    async _checkModelExists(url) {
        if (!url || url === '') return false;

        try {
            // For COCO-SSD, don't do a check since it's loaded differently
            if (this.activeModelType === 'coco-ssd') return true;

            // For other models, try to fetch the model.json file
            const response = await fetch(url, {
                method: 'HEAD',
                cache: 'no-cache'
            });
            return response.ok;
        } catch (error) {
            console.warn(`Error checking model at ${url}:`, error);
            return false;
        }
    }

    showModelLoadingIndicator(modelName, modelSize) {
        // Remove any existing indicators
        this.removeModelLoadingIndicator();
        
        // Create new indicator
        const indicator = document.createElement('div');
        indicator.id = 'modelLoadingIndicator';
        indicator.className = 'model-loading-indicator';
        indicator.innerHTML = `
            <i class="fas fa-spinner"></i>
            <span>Loading ${modelName} <span class="model-size">(${modelSize})</span></span>
        `;
        
        // Add to body
        document.body.appendChild(indicator);
        
        // Auto-remove after 10 seconds (failsafe)
        setTimeout(() => {
            this.removeModelLoadingIndicator();
        }, 10000);
    }
    
    /**
     * Remove the model loading indicator
     */
    removeModelLoadingIndicator() {
        const indicator = document.getElementById('modelLoadingIndicator');
        if (indicator) {
            // Add fade out class
            indicator.style.opacity = '0';
            indicator.style.transition = 'opacity 0.3s ease-out';
            
            // Remove after animation
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.parentNode.removeChild(indicator);
                }
            }, 300);
        }
    }

    /**
     * Load the selected model
     */
    async loadModel(progressCallback = null) {
        try {
            // If model is already loaded, return it
            if (this.isModelLoaded && this.model) {
                return this.model;
            }
            
            // If model is currently loading, return the promise
            if (this.modelLoadingPromise) {
                return this.modelLoadingPromise;
            }
            
            const modelConfig = this.availableModels[this.activeModelType];
            if (!modelConfig) {
                throw new Error(`Unknown model type: ${this.activeModelType}`);
            }
            
            // Check if model is enabled
            if (modelConfig.enabled === false) {
                throw new Error(`Model ${modelConfig.name} is not yet available`);
            }
            
            // For custom URLs, check if the model file exists
            if (modelConfig.type === 'tfjs' && this.activeModelType !== 'coco-ssd') {
                const modelExists = await this._checkModelExists(modelConfig.url);
                if (!modelExists) {
                    throw new Error(`Model file not found at ${modelConfig.url}`);
                }
            }
            
            // Load required libraries based on model type
            this.modelLoadingPromise = this._loadRequiredScripts(progressCallback)
                .then(async () => {
                    if (progressCallback) progressCallback(30, `Loading ${modelConfig.name}...`);
                    let loadedModel;
                    
                    // Load model based on its type
                    if (modelConfig.type === 'tfjs') {
                        if (this.activeModelType === 'coco-ssd') {
                            // Check if cocoSsd is defined
                            if (typeof cocoSsd === 'undefined') {
                                throw new Error('COCO-SSD library not loaded properly');
                            }
                            
                            // Load COCO-SSD model
                            try {
                                loadedModel = await cocoSsd.load();
                                
                                // Verify model loaded correctly
                                if (!loadedModel || typeof loadedModel.detect !== 'function') {
                                    throw new Error('COCO-SSD model loaded but detect method is missing');
                                }
                            } catch (e) {
                                console.error('Error loading COCO-SSD model:', e);
                                throw new Error(`Failed to load COCO-SSD: ${e.message}`);
                            }
                        } else if (this.activeModelType.startsWith('yolov8')) {
                            try {
                                // Load YOLOv8 model
                                loadedModel = await tf.loadGraphModel(modelConfig.url);
                            } catch (e) {
                                console.error('Error loading YOLOv8 model:', e);
                                throw new Error(`Failed to load YOLOv8 model: ${e.message}`);
                            }
                        }
                    } else if (modelConfig.type === 'onnx') {
                        // ONNX model loading would go here
                        throw new Error('ONNX models not yet implemented');
                    }
                    
                    if (progressCallback) progressCallback(90, 'Preparing model...');
                    
                    if (!loadedModel) {
                        throw new Error('Failed to load model');
                    }
                    
                    // For YOLOv8, preload by running inference on an empty tensor
                    if (this.activeModelType.startsWith('yolov8')) {
                        try {
                            const warmupTensor = tf.zeros([1, 640, 640, 3]);
                            await loadedModel.executeAsync(warmupTensor);
                            warmupTensor.dispose();
                        } catch (e) {
                            console.warn('Model warm-up failed, but continuing:', e);
                        }
                    }
                    
                    if (progressCallback) progressCallback(100, 'Model loaded successfully!');
                    this.model = loadedModel;
                    this.isModelLoaded = true;
                    
                    console.log(`Model ${this.activeModelType} loaded successfully:`, loadedModel);
                    return loadedModel;
                })
                .catch(error => {
                    console.error('Error in loadModel:', error);
                    // Reset loading promise on failure
                    this.modelLoadingPromise = null;
                    throw error;
                });
            
            return this.modelLoadingPromise;
        } catch (error) {
            console.error('Error loading model:', error);
            this.modelLoadingPromise = null;
            throw error;
        }
    }

    /**
     * Load required scripts based on model type
     */
    async _loadRequiredScripts(progressCallback = null) {
        return new Promise((resolve, reject) => {
            // First make sure TensorFlow.js is fully loaded
            const loadTensorflow = () => {
                return new Promise((resolveTf, rejectTf) => {
                    if (typeof tf !== 'undefined') {
                        if (progressCallback) progressCallback(10, 'TensorFlow.js already loaded');
                        resolveTf();
                    } else {
                        // Load TensorFlow.js first
                        console.log('Loading TensorFlow.js...');
                        const tfScript = document.createElement('script');
                        tfScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.13.0/dist/tf.min.js';
                        tfScript.async = true;
                        
                        tfScript.onload = () => {
                            console.log('TensorFlow.js loaded successfully');
                            if (progressCallback) progressCallback(15, 'TensorFlow.js loaded');
                            resolveTf();
                        };
                        
                        tfScript.onerror = (error) => {
                            console.error('Failed to load TensorFlow.js:', error);
                            rejectTf(new Error('Failed to load TensorFlow.js script'));
                        };
                        
                        document.body.appendChild(tfScript);
                    }
                });
            };
            
            // Function to load COCO-SSD after TensorFlow.js
            const loadCocoSsd = async () => {
                if (this.activeModelType === 'coco-ssd') {
                    return new Promise((resolveCocoSsd, rejectCocoSsd) => {
                        if (typeof cocoSsd !== 'undefined') {
                            if (progressCallback) progressCallback(20, 'COCO-SSD already loaded');
                            resolveCocoSsd();
                            return;
                        }
                        
                        console.log('Loading COCO-SSD...');
                        const cocoSsdScript = document.createElement('script');
                        
                        // Use the corrected URL
                        cocoSsdScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js';
                        cocoSsdScript.async = true;
                        
                        cocoSsdScript.onload = () => {
                            console.log('COCO-SSD loaded successfully');
                            // Verify cocoSsd is available
                            if (typeof cocoSsd === 'undefined') {
                                console.error('COCO-SSD script loaded but cocoSsd object is not defined');
                                rejectCocoSsd(new Error('COCO-SSD failed to initialize properly'));
                                return;
                            }
                            
                            if (progressCallback) progressCallback(20, 'COCO-SSD loaded');
                            resolveCocoSsd();
                        };
                        
                        cocoSsdScript.onerror = (error) => {
                            console.error('Failed to load COCO-SSD:', error);
                            rejectCocoSsd(new Error('Failed to load COCO-SSD script'));
                        };
                        
                        document.body.appendChild(cocoSsdScript);
                    });
                } else {
                    // No additional scripts needed for other models
                    return Promise.resolve();
                }
            };
            
            // Load TensorFlow.js first, then COCO-SSD if needed
            loadTensorflow()
                .then(() => loadCocoSsd())
                .then(() => {
                    resolve();
                })
                .catch(error => {
                    console.error('Error loading required scripts:', error);
                    reject(error);
                });
        });
    }

    /**
     * Preprocess image for YOLOv8 inference
     */
    async _preprocessImageForYolo(img, targetSize = 640) {
        return tf.tidy(() => {
            // Convert image to tensor
            let imageTensor = tf.browser.fromPixels(img);

            // Get original dimensions for later scaling
            const originalHeight = imageTensor.shape[0];
            const originalWidth = imageTensor.shape[1];

            // Resize while maintaining aspect ratio and pad
            const [paddedTensor, padding] = this._resizeAndPad(imageTensor, targetSize);

            // Normalize to 0-1
            const normalized = paddedTensor.div(255.0);

            // Add batch dimension
            const batched = normalized.expandDims(0);

            return {
                tensor: batched,
                originalSize: [originalWidth, originalHeight],
                padding: padding
            };
        });
    }

    /**
     * Resize and pad an image tensor to make it square with letterboxing
     */
    _resizeAndPad(imageTensor, targetSize) {
        return tf.tidy(() => {
            const [height, width] = imageTensor.shape.slice(0, 2);

            // Determine scale to preserve aspect ratio
            const scale = Math.min(targetSize / width, targetSize / height);

            // New dimensions after scaling
            const newHeight = Math.round(height * scale);
            const newWidth = Math.round(width * scale);

            // Resize the image
            const resized = tf.image.resizeBilinear(imageTensor, [newHeight, newWidth]);

            // Calculate padding
            const padHeight = targetSize - newHeight;
            const padWidth = targetSize - newWidth;
            const paddingTop = Math.floor(padHeight / 2);
            const paddingBottom = padHeight - paddingTop;
            const paddingLeft = Math.floor(padWidth / 2);
            const paddingRight = padWidth - paddingLeft;

            // Pad the image to make it square
            const padded = tf.pad(
                resized,
                [
                    [paddingTop, paddingBottom],
                    [paddingLeft, paddingRight],
                    [0, 0]
                ],
                0 // Pad with black
            );

            return [
                padded,
                {
                    top: paddingTop,
                    bottom: paddingBottom,
                    left: paddingLeft,
                    right: paddingRight,
                    scale: scale
                }
            ];
        });
    }

    /**
     * Process YOLOv8 outputs to detection format
     * Rewritten to avoid using Promise inside tidy
     */
    _processYoloOutput(prediction, imageData, confidenceThreshold = 0.25, iouThreshold = 0.45) {
        // First part: Extract data and process within tidy
        const processedData = tf.tidy(() => {
            const [batchSize, boxes, numClasses] = prediction.shape;

            // Slice confidence scores (first column)
            const scores = prediction.slice([0, 0, 4], [1, -1, 1]).reshape([-1]);

            // Get classes with highest scores
            const nms_scores = prediction.slice([0, 0, 4], [1, -1, numClasses - 4]).reshape([-1, numClasses - 4]);
            const classes = tf.argMax(nms_scores, 1);

            // Get bounding boxes
            const bboxes = prediction.slice([0, 0, 0], [1, -1, 4]).reshape([-1, 4]);

            // Convert to JavaScript arrays
            return {
                confidences: Array.from(scores.dataSync()),
                classes: Array.from(classes.dataSync()),
                bboxes: bboxes.arraySync(),
                scores: scores,
                scoreShape: scores.shape
            };
        });

        const { confidences, classes, bboxes, scoreShape } = processedData;

        // Second part: Process the data outside of tidy
        const detections = [];

        for (let i = 0; i < scoreShape[0]; i++) {
            if (confidences[i] >= confidenceThreshold) {
                // YOLOv8 outputs xywh format centered
                const bbox = bboxes[i];
                const [x, y, w, h] = bbox;

                // Convert to xyxy format
                const x1 = x - w / 2;
                const y1 = y - h / 2;
                const x2 = x + w / 2;
                const y2 = y + h / 2;

                // Scale coordinates to original image
                const { scale, top, left } = imageData.padding;
                const [originalWidth, originalHeight] = imageData.originalSize;

                // Adjust for padding and scaling
                const scaledX1 = (x1 - left) / scale;
                const scaledY1 = (y1 - top) / scale;
                const scaledX2 = (x2 - left) / scale;
                const scaledY2 = (y2 - top) / scale;

                // Ensure coordinates are within image bounds
                const boundedX1 = Math.max(0, Math.min(originalWidth, scaledX1));
                const boundedY1 = Math.max(0, Math.min(originalHeight, scaledY1));
                const boundedX2 = Math.max(0, Math.min(originalWidth, scaledX2));
                const boundedY2 = Math.max(0, Math.min(originalHeight, scaledY2));

                // Convert to width/height format
                const finalWidth = boundedX2 - boundedX1;
                const finalHeight = boundedY2 - boundedY1;

                // Skip tiny boxes
                if (finalWidth < 1 || finalHeight < 1) {
                    continue;
                }

                // Add to detections if class is valid
                const classIndex = classes[i];
                if (classIndex >= 0 && classIndex < this.cocoClasses.length) {
                    detections.push({
                        bbox: [boundedX1, boundedY1, finalWidth, finalHeight],
                        class: this.cocoClasses[classIndex],
                        score: confidences[i]
                    });
                }
            }
        }

        // Third part: Do NMS if we have multiple detections
        if (detections.length > 1) {
            // Sort by confidence (higher first)
            detections.sort((a, b) => b.score - a.score);

            // Simple NMS implementation directly in JavaScript
            const indexesToKeep = [];
            const areas = detections.map(d => d.bbox[2] * d.bbox[3]);

            for (let i = 0; i < detections.length; i++) {
                let keep = true;

                for (const idx of indexesToKeep) {
                    const boxI = detections[i].bbox;
                    const boxJ = detections[idx].bbox;

                    // Calculate coordinates of intersection
                    const xi1 = Math.max(boxI[0], boxJ[0]);
                    const yi1 = Math.max(boxI[1], boxJ[1]);
                    const xi2 = Math.min(boxI[0] + boxI[2], boxJ[0] + boxJ[2]);
                    const yi2 = Math.min(boxI[1] + boxI[3], boxJ[1] + boxJ[3]);

                    // Calculate intersection area
                    const intersection = Math.max(0, xi2 - xi1) * Math.max(0, yi2 - yi1);

                    // Calculate union area
                    const union = areas[i] + areas[idx] - intersection;

                    // Calculate IoU
                    const iou = union > 0 ? intersection / union : 0;

                    if (iou > iouThreshold) {
                        keep = false;
                        break;
                    }
                }

                if (keep) {
                    indexesToKeep.push(i);
                }
            }

            // Filter detections based on NMS results
            const nmsResults = indexesToKeep.map(index => detections[index]);
            return nmsResults;
        }

        return detections;
    }

    /**
     * Detect objects in an image
     * @param {HTMLImageElement|ImageData} imageElement - The image to process
     * @param {number} confidenceThreshold - Confidence threshold (0-1)
     * @returns {Promise<Array>} - Array of detection results
     */
    async detectObjects(imageElement, confidenceThreshold = 0.25) {
        try {
            // Make sure the model is loaded
            if (!this.isModelLoaded || !this.model) {
                await this.loadModel();
                
                // Double-check that model loaded successfully
                if (!this.model) {
                    throw new Error('Model failed to load properly');
                }
            }
            
            const startTime = performance.now();
            let predictions = [];
            
            // Run inference based on model type
            if (this.activeModelType === 'coco-ssd') {
                // COCO-SSD inference
                if (typeof this.model.detect !== 'function') {
                    console.error('COCO-SSD model loaded incorrectly:', this.model);
                    throw new Error('COCO-SSD model does not have detect method. Model may have loaded incorrectly.');
                }
                
                // Run detection
                predictions = await this.model.detect(imageElement);
            } else if (this.activeModelType.startsWith('yolov8')) {
                // YOLOv8 inference - code remains the same
                try {
                    const preprocessedImage = await this._preprocessImageForYolo(imageElement);
                    // Run model
                    const output = await this.model.executeAsync(preprocessedImage.tensor);
                    // Process output
                    predictions = this._processYoloOutput(
                        output,
                        preprocessedImage,
                        confidenceThreshold
                    );
                    // Clean up tensors
                    preprocessedImage.tensor.dispose();
                    if (Array.isArray(output)) {
                        output.forEach(t => t.dispose());
                    } else {
                        output.dispose();
                    }
                } catch (e) {
                    console.error('Error during YOLOv8 inference:', e);
                    throw new Error(`YOLOv8 inference failed: ${e.message}`);
                }
            }
            
            this.inferenceTime = performance.now() - startTime;
            return predictions;
        } catch (error) {
            console.error('Error during object detection:', error);
            throw error;
        }
    }

    /**
     * Set class mapping from model labels to user-defined classes
     * @param {Object} mapping - Mapping from model labels to user classes
     */
    setClassMapping(mapping) {
        this.classMapping = mapping;
    }

    /**
     * Map model classes to user-defined classes
     * @param {string} modelClass - The class name from model
     * @returns {string} - The mapped class name
     */
    mapClass(modelClass) {
        if (!this.classMapping) return modelClass;
        return this.classMapping[modelClass] || modelClass;
    }

    /**
     * Convert detection results to application's annotation format
     * @param {Array} detections - Detection results from the model
     * @param {number} imageWidth - Original width of the image
     * @param {number} imageHeight - Original height of the image
     * @param {number} nextAnnotationId - Next available annotation ID
     * @returns {Array} - Annotations in the application's format
     */
    detectionsToAnnotations(detections, imageWidth, imageHeight, nextAnnotationId) {
        return detections.map((detection, index) => {
            // Convert bounding box to normalized coordinates
            const xNorm = detection.bbox[0] / imageWidth;
            const yNorm = detection.bbox[1] / imageHeight;
            const widthNorm = detection.bbox[2] / imageWidth;
            const heightNorm = detection.bbox[3] / imageHeight;
            
            // Use the mapped class if available
            const className = this.mapClass(detection.class);
            
            return {
                id: nextAnnotationId + index,
                class: className,
                xNorm: xNorm,
                yNorm: yNorm,
                widthNorm: widthNorm,
                heightNorm: heightNorm,
                color: null, // Will be set by the application
                confidence: detection.score
            };
        });
    }

    /**
     * Get available classes from the model
     * @returns {Array<string>} - Array of class names the model can detect
     */
    getAvailableClasses() {
        return this.cocoClasses;
    }

    /**
     * Check for class name match or similarity
     * @param {string} userClass - User defined class
     * @param {string} modelClass - Model class
     * @returns {boolean} - True if classes match or are similar
     */
    isClassSimilar(userClass, modelClass) {
        userClass = userClass.toLowerCase().trim();
        modelClass = modelClass.toLowerCase().trim();
        
        // Direct match
        if (userClass === modelClass) return true;
        
        // Check if user class contains model class or vice versa
        if (userClass.includes(modelClass) || modelClass.includes(userClass)) return true;
        
        // Check for common plurals
        if (userClass + 's' === modelClass || modelClass + 's' === userClass) return true;
        
        return false;
    }

    /**
     * Generate class mapping based on user classes
     * @param {Array<string>} userClasses - User defined classes
     * @returns {Object} - Mapping from model classes to user classes
     */
    generateClassMapping(userClasses) {
        const modelClasses = this.getAvailableClasses();
        const mapping = {};
        
        modelClasses.forEach(modelClass => {
            // Find a matching user class
            const matchingUserClass = userClasses.find(userClass => 
                this.isClassSimilar(userClass, modelClass)
            );
            
            if (matchingUserClass) {
                mapping[modelClass] = matchingUserClass;
            }
        });
        
        return mapping;
    }
    
    /**
     * Get inference performance statistics
     * @returns {Object} - Inference statistics
     */
    getPerformanceStats() {
        return {
            inferenceTime: this.inferenceTime,
            modelType: this.activeModelType,
            modelName: this.availableModels[this.activeModelType]?.name || 'Unknown'
        };
    }
}

// Initialize the global object
window.enhancedObjectDetector = new EnhancedObjectDetector();