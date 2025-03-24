/**
 * ModelTrainer.js - Provides functionality to train custom object detection
 * models using the user's annotations and images
 */

// Create the global variable first
window.modelTrainer = null;

class ModelTrainer {
    constructor() {
        this.model = null;
        this.isTraining = false;
        this.isSaving = false;
        this.trainingProgress = 0;
        this.trainingLogs = [];
        this.trainingCancelled = false;
        this.learningRate = 0.001;
        this.batchSize = 4;
        this.epochs = 10;
        this.baseModelURL = 'https://tfhub.dev/tensorflow/tfjs-model/ssd_mobilenet_v2/1/default/1';
        this.customModelName = 'my-custom-detector';
        
        // Training data storage
        this.trainingDatasets = {
            train: null,
            validation: null
        };
    }
    
    /**
     * Prepare training dataset from annotations
     * @param {Array} imageObjects - Array of image objects
     * @param {Object} annotations - Annotations data object
     * @param {Array} classes - Array of class names
     * @param {number} validationSplit - Percentage of data to use for validation (0-1)
     * @returns {Promise<boolean>} - Success status
     */
    async prepareTrainingData(imageObjects, annotationsData, classes, validationSplit = 0.2) {
        try {
            if (!imageObjects || !annotationsData || !classes || classes.length === 0) {
                throw new Error('Invalid training data');
            }
            
            // Create class index mapping
            const classIndices = {};
            classes.forEach((cls, index) => {
                classIndices[cls] = index;
            });
            
            // Prepare training examples
            const examples = [];
            
            // Create progress tracking
            const totalImages = imageObjects.length;
            let processedImages = 0;
            
            // Process each image
            for (const imageObj of imageObjects) {
                try {
                    // Get annotations for this image
                    const imageAnnotations = annotationsData[imageObj.id] || [];
                    
                    // Skip images without annotations
                    if (imageAnnotations.length === 0) {
                        processedImages++;
                        this.updateProgress((processedImages / totalImages) * 50, 'Skipping image without annotations');
                        continue;
                    }
                    
                    // Create image element
                    const img = new Image();
                    img.crossOrigin = 'Anonymous';
                    img.src = imageObj.src;
                    
                    // Wait for image to load
                    await new Promise((resolve, reject) => {
                        if (img.complete) {
                            resolve();
                        } else {
                            img.onload = resolve;
                            img.onerror = () => reject(new Error(`Failed to load image: ${imageObj.name}`));
                        }
                    });
                    
                    // Process annotations (convert normalized coordinates to absolute)
                    const boxes = [];
                    const classes = [];
                    
                    for (const ann of imageAnnotations) {
                        const classIndex = classIndices[ann.class];
                        if (classIndex === undefined) {
                            console.warn(`Class "${ann.class}" not found in class list. Skipping this annotation.`);
                            continue;
                        }
                        
                        // YOLO format (normalized) to absolute pixel values
                        const x = ann.xNorm * img.width;
                        const y = ann.yNorm * img.height;
                        const width = ann.widthNorm * img.width;
                        const height = ann.heightNorm * img.height;
                        
                        // Convert to [ymin, xmin, ymax, xmax] format for TensorFlow.js
                        boxes.push([
                            y / img.height,           // ymin (normalized)
                            x / img.width,            // xmin (normalized)
                            (y + height) / img.height, // ymax (normalized)
                            (x + width) / img.width    // xmax (normalized)
                        ]);
                        
                        classes.push(classIndex);
                    }
                    
                    // Skip if no valid annotations
                    if (boxes.length === 0) {
                        processedImages++;
                        this.updateProgress((processedImages / totalImages) * 50, 'Skipping image with invalid annotations');
                        continue;
                    }
                    
                    // Create example object
                    examples.push({
                        image: img,
                        boxes: boxes,
                        classes: classes
                    });
                    
                    processedImages++;
                    this.updateProgress((processedImages / totalImages) * 50, `Processed ${processedImages}/${totalImages} images`);
                } catch (error) {
                    console.error(`Error processing image ${imageObj.name}:`, error);
                    processedImages++;
                    this.updateProgress((processedImages / totalImages) * 50, `Error processing image: ${error.message}`);
                }
            }
            
            // Check if we have enough examples
            if (examples.length < 5) {
                throw new Error('Not enough valid examples for training (minimum 5 required)');
            }
            
            this.updateProgress(60, 'Converting images to tensors...');
            
            // Shuffle examples
            this._shuffleArray(examples);
            
            // Split into training and validation sets
            const splitIndex = Math.floor(examples.length * (1 - validationSplit));
            const trainExamples = examples.slice(0, splitIndex);
            const validationExamples = examples.slice(splitIndex);
            
            this.updateProgress(70, `Training set: ${trainExamples.length}, Validation set: ${validationExamples.length}`);
            
            // Convert to TF.js datasets - we need TensorFlow.js to be loaded
            await this._loadRequiredScripts();
            
            const trainDataset = this._createDataset(trainExamples, classes.length);
            const validationDataset = this._createDataset(validationExamples, classes.length);
            
            this.trainingDatasets.train = trainDataset;
            this.trainingDatasets.validation = validationDataset;
            
            this.updateProgress(80, 'Training data prepared successfully');
            return true;
        } catch (error) {
            console.error('Error preparing training data:', error);
            this.trainingLogs.push(`Error: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Create a TensorFlow.js dataset from examples
     * @param {Array} examples - Array of example objects
     * @param {number} numClasses - Number of classes
     * @returns {tf.data.Dataset} - TensorFlow.js dataset
     */
    _createDataset(examples, numClasses) {
        // Check if TensorFlow.js is loaded
        if (typeof tf === 'undefined') {
            throw new Error('TensorFlow.js not loaded. Cannot create dataset.');
        }
        
        return tf.data.generator(function* () {
            for (const example of examples) {
                // Convert image to tensor
                const imgTensor = tf.browser.fromPixels(example.image).expandDims(0);
                
                // Create tensors for boxes and classes
                const boxesTensor = tf.tensor2d(example.boxes);
                const classesTensor = tf.oneHot(tf.tensor1d(example.classes, 'int32'), numClasses);
                
                yield {
                    xs: imgTensor,
                    ys: {
                        boxes: boxesTensor,
                        classes: classesTensor
                    }
                };
            }
        }).prefetch(this.batchSize);
    }
    
    /**
     * Train a custom object detection model
     * @param {Object} options - Training options
     * @returns {Promise<tf.LayersModel>} - Trained model
     */
    async trainModel(options = {}) {
        try {
            if (this.isTraining) {
                throw new Error('Training already in progress');
            }
            
            this.isTraining = true;
            this.trainingCancelled = false;
            this.trainingProgress = 0;
            this.trainingLogs = [];
            
            // Set training parameters from options
            this.learningRate = options.learningRate || this.learningRate;
            this.batchSize = options.batchSize || this.batchSize;
            this.epochs = options.epochs || this.epochs;
            this.customModelName = options.modelName || this.customModelName;
            
            // Check if we have training data
            if (!this.trainingDatasets.train || !this.trainingDatasets.validation) {
                throw new Error('Training data not prepared');
            }
            
            this.updateProgress(10, 'Loading base model...');
            
            // Load base model
            await this._loadRequiredScripts();
            
            // Create or load the model
            let model;
            if (options.continueTraining && this.model) {
                model = this.model;
                this.updateProgress(20, 'Continuing training with existing model');
            } else {
                // Either create a very simple model for fine-tuning
                // In a real-world scenario, we'd use transfer learning from a pre-trained model
                // For demonstration, we'll create a simplified model architecture
                model = await this._createSimpleDetectionModel(options.numClasses);
                this.updateProgress(20, 'Created new model for training');
            }
            
            this.model = model;
            
            // Compile the model
            model.compile({
                optimizer: tf.train.adam(this.learningRate),
                loss: {
                    boxes: 'meanSquaredError',
                    classes: 'categoricalCrossentropy'
                },
                metrics: ['accuracy']
            });
            
            this.updateProgress(30, 'Model compiled, starting training...');
            
            // Train the model
            await model.fitDataset(this.trainingDatasets.train.batch(this.batchSize), {
                epochs: this.epochs,
                validationData: this.trainingDatasets.validation.batch(this.batchSize),
                callbacks: {
                    onEpochBegin: async (epoch) => {
                        this.trainingLogs.push(`Epoch ${epoch + 1}/${this.epochs} started`);
                        console.log(`Epoch ${epoch + 1}/${this.epochs} started`);
                    },
                    onEpochEnd: async (epoch, logs) => {
                        // Calculate progress percentage
                        const progress = Math.floor(30 + ((epoch + 1) / this.epochs) * 60);
                        this.trainingProgress = progress;
                        
                        // Format logs for display
                        const logText = `Epoch ${epoch + 1}/${this.epochs} - ` +
                            `loss: ${logs.loss.toFixed(4)}, ` +
                            `val_loss: ${logs.val_loss.toFixed(4)}`;
                        
                        this.trainingLogs.push(logText);
                        console.log(logText);
                        
                        this.updateProgress(progress, logText);
                        
                        // Check if training was cancelled
                        if (this.trainingCancelled) {
                            model.stopTraining = true;
                            this.trainingLogs.push('Training cancelled by user');
                        }
                    }
                }
            });
            
            if (!this.trainingCancelled) {
                this.updateProgress(95, 'Training completed');
                this.trainingLogs.push('Training completed successfully');
            }
            
            this.isTraining = false;
            return model;
        } catch (error) {
            this.isTraining = false;
            console.error('Error during model training:', error);
            this.trainingLogs.push(`Error: ${error.message}`);
            this.updateProgress(0, `Training failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Create a super simple object detection model - heavily simplified to avoid library issues
     * @param {number} numClasses - Number of classes
     * @returns {tf.LayersModel} - TensorFlow.js model
     */
    async _createSimpleDetectionModel(numClasses) {
        // Check if TensorFlow.js is loaded
        if (typeof tf === 'undefined') {
            throw new Error('TensorFlow.js not loaded. Cannot create model.');
        }
        
        try {
            console.log('Creating a simplified detection model...');
            
            // Create an extremely basic model with fewer components to avoid TF.js bugs
            const model = tf.sequential();
            
            // Define image input shape
            const inputShape = [224, 224, 3];
            
            // Add layers one by one (without functional API to avoid bugs)
            model.add(tf.layers.conv2d({
                inputShape: inputShape,
                filters: 16,
                kernelSize: 3,
                strides: 2,
                activation: 'relu',
                padding: 'same'
            }));
            
            model.add(tf.layers.maxPooling2d({
                poolSize: 2,
                strides: 2
            }));
            
            model.add(tf.layers.conv2d({
                filters: 32,
                kernelSize: 3,
                activation: 'relu',
                padding: 'same'
            }));
            
            model.add(tf.layers.maxPooling2d({
                poolSize: 2,
                strides: 2
            }));
            
            model.add(tf.layers.flatten());
            
            model.add(tf.layers.dense({
                units: 128,
                activation: 'relu'
            }));
            
            // Output layer - combine boxes and classes into one output
            // We'll split them during inference
            const outputUnits = 4 + numClasses; // 4 for box coords + class probabilities
            model.add(tf.layers.dense({
                units: outputUnits,
                activation: 'linear'
            }));
            
            // Log model summary
            console.log('Model created successfully');
            
            return model;
        } catch (error) {
            console.error('Error creating simple detection model:', error);
            
            // Try creating an even simpler model as a fallback
            try {
                console.log('Attempting to create a minimalist fallback model...');
                
                // Create an extremely basic model with minimal components
                const fallbackModel = tf.sequential();
                
                // Input layer with flattening
                fallbackModel.add(tf.layers.flatten({
                    inputShape: [224, 224, 3]
                }));
                
                // One hidden layer
                fallbackModel.add(tf.layers.dense({
                    units: 64, 
                    activation: 'relu'
                }));
                
                // Output layer
                fallbackModel.add(tf.layers.dense({
                    units: 4 + numClasses, 
                    activation: 'linear'
                }));
                
                console.log('Fallback model created successfully');
                return fallbackModel;
                
            } catch (fallbackError) {
                console.error('Fallback model creation also failed:', fallbackError);
                throw error; // Throw the original error
            }
        }
    }
    
    /**
     * Cancel ongoing training
     */
    cancelTraining() {
        if (this.isTraining) {
            this.trainingCancelled = true;
            this.trainingLogs.push('Cancelling training...');
            this.updateProgress(this.trainingProgress, 'Cancelling training...');
        }
    }
    
    /**
     * Save the trained model
     * @param {string} format - 'indexeddb' or 'download'
     * @returns {Promise<boolean>} - Success status
     */
    async saveModel(format = 'indexeddb') {
        try {
            if (!this.model) {
                throw new Error('No trained model available');
            }
            
            if (this.isSaving) {
                throw new Error('Model saving already in progress');
            }
            
            this.isSaving = true;
            
            if (format === 'indexeddb') {
                // Save to IndexedDB
                this.updateProgress(0, 'Saving model to browser storage...');
                await this.model.save(`indexeddb://${this.customModelName}`);
                this.updateProgress(100, 'Model saved to browser storage');
            } else if (format === 'download') {
                // Download as file
                this.updateProgress(0, 'Preparing model for download...');
                await this.model.save(`downloads://${this.customModelName}`);
                this.updateProgress(100, 'Model download started');
            } else {
                throw new Error('Unsupported save format');
            }
            
            this.isSaving = false;
            return true;
        } catch (error) {
            this.isSaving = false;
            console.error('Error saving model:', error);
            this.updateProgress(0, `Error saving model: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Load a previously saved model
     * @param {string} modelName - Name of the model to load
     * @returns {Promise<tf.LayersModel>} - Loaded model
     */
    async loadSavedModel(modelName = null) {
        try {
            const name = modelName || this.customModelName;
            this.updateProgress(0, 'Loading saved model...');
            
            // Ensure TensorFlow.js is loaded
            await this._loadRequiredScripts();
            
            // Check if model exists
            const models = await tf.io.listModels();
            const modelPath = `indexeddb://${name}`;
            
            if (!models[modelPath]) {
                throw new Error(`Model "${name}" not found`);
            }
            
            // Load the model
            const model = await tf.loadLayersModel(modelPath);
            this.model = model;
            
            this.updateProgress(100, 'Model loaded successfully');
            return model;
        } catch (error) {
            console.error('Error loading model:', error);
            this.updateProgress(0, `Error loading model: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Get a list of saved models
     * @returns {Promise<Array>} - Array of model info objects
     */
    async getSavedModels() {
        try {
            // Ensure TensorFlow.js is loaded
            await this._loadRequiredScripts();
            
            // Get all models
            const models = await tf.io.listModels();
            
            // Filter for custom models in IndexedDB
            const customModels = Object.keys(models)
                .filter(key => key.startsWith('indexeddb://'))
                .map(key => ({
                    name: key.replace('indexeddb://', ''),
                    path: key,
                    sizeBytes: models[key].sizeBytes,
                    modelType: 'custom',
                    lastModified: models[key].dateSaved
                }));
            
            return customModels;
        } catch (error) {
            console.error('Error listing models:', error);
            return [];
        }
    }
    
    /**
     * Delete a saved model
     * @param {string} modelName - Name of the model to delete
     * @returns {Promise<boolean>} - Success status
     */
    async deleteSavedModel(modelName) {
        try {
            // Ensure TensorFlow.js is loaded
            await this._loadRequiredScripts();
            
            const modelPath = `indexeddb://${modelName}`;
            await tf.io.removeModel(modelPath);
            return true;
        } catch (error) {
            console.error('Error deleting model:', error);
            throw error;
        }
    }
    
    /**
     * Run inference with the trained model
     * @param {HTMLImageElement} image - Image element
     * @param {Array} classes - Array of class names
     * @param {number} confidenceThreshold - Confidence threshold (0-1)
     * @returns {Promise<Array>} - Array of detection results
     */
    async detectWithTrainedModel(image, classes, confidenceThreshold = 0.5) {
        try {
            if (!this.model) {
                throw new Error('No trained model available');
            }
            
            // Ensure TensorFlow.js is loaded
            await this._loadRequiredScripts();
            
            // Process image
            const imgTensor = tf.browser.fromPixels(image).expandDims(0);
            
            // Run inference
            const predictions = await this.model.predict(imgTensor);
            
            // Process predictions (this will depend on your model architecture)
            // This is a simplified example
            const [boxesTensor, classesTensor] = predictions;
            
            // Get data from tensors
            const boxes = await boxesTensor.array();
            const scores = await classesTensor.max(2).array();
            const classIndices = await classesTensor.argMax(2).array();
            
            // Convert to detections format
            const detections = [];
            
            for (let i = 0; i < boxes[0].length; i++) {
                const score = scores[0][i];
                
                if (score >= confidenceThreshold) {
                    const classIndex = classIndices[0][i];
                    const className = classes[classIndex];
                    const [y1, x1, y2, x2] = boxes[0][i];
                    
                    // Convert to [x, y, width, height] format
                    const x = x1 * image.width;
                    const y = y1 * image.height;
                    const width = (x2 - x1) * image.width;
                    const height = (y2 - y1) * image.height;
                    
                    detections.push({
                        bbox: [x, y, width, height],
                        class: className,
                        score: score
                    });
                }
            }
            
            // Clean up
            imgTensor.dispose();
            if (Array.isArray(predictions)) {
                predictions.forEach(t => t.dispose());
            } else {
                predictions.dispose();
            }
            
            return detections;
        } catch (error) {
            console.error('Error during custom model inference:', error);
            throw error;
        }
    }
    
        /**
         * Load required scripts based on model type
         */
        async _loadRequiredScripts(progressCallback) {
            return new Promise((resolve, reject) => {
                // Function to load COCO-SSD after TF.js is loaded
                const loadCocoSsd = () => {
                    if (this.activeModelType === 'coco-ssd') {
                        if (typeof cocoSsd !== 'undefined') {
                            if (progressCallback) progressCallback(20, 'COCO-SSD already loaded');
                            resolve();
                            return;
                        }
                        const cocoSsdScript = document.createElement('script');
                        cocoSsdScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js';
                        cocoSsdScript.async = true;
                        cocoSsdScript.onload = () => {
                            if (progressCallback) progressCallback(20, 'COCO-SSD loaded');
                            resolve();
                        };
                        cocoSsdScript.onerror = (error) => {
                            reject(new Error('Failed to load COCO-SSD script'));
                        };
                        document.body.appendChild(cocoSsdScript);
                    } else {
                        // For YOLOv8 and other direct TF.js models, we don't need additional scripts
                        setTimeout(() => {
                            resolve();
                        }, 100);
                    }
                };

        // First check if TensorFlow.js is already loaded
        if (typeof tf !== 'undefined') {
            if (progressCallback) progressCallback(10, 'TensorFlow.js already loaded');
            loadCocoSsd(); // Load COCO-SSD now that TF.js is loaded
        } else {
            // Load TensorFlow.js
            const tfScript = document.createElement('script');
            tfScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.13.0/dist/tf.min.js';
            tfScript.async = true;
            tfScript.onload = () => {
                if (progressCallback) progressCallback(15, 'TensorFlow.js loaded');
                loadCocoSsd(); // Load COCO-SSD only after TF.js is loaded
            };
            tfScript.onerror = (error) => {
                reject(new Error('Failed to load TensorFlow.js script'));
            };
            document.body.appendChild(tfScript);
        }
    });
}
    
    /**
     * Update training progress
     * @param {number} progress - Progress percentage (0-100)
     * @param {string} message - Status message
     */
    updateProgress(progress, message) {
        this.trainingProgress = progress;
        this.trainingLogs.push(message);
        
        // Dispatch custom event for UI updates
        const event = new CustomEvent('modelTrainingProgress', {
            detail: {
                progress: progress,
                message: message,
                logs: this.trainingLogs
            }
        });
        window.dispatchEvent(event);
    }
    
    /**
     * Shuffle array in place
     * @param {Array} array - Array to shuffle
     */
    _shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}

// Initialize the global object
window.modelTrainer = new ModelTrainer();