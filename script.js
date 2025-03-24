const canvas = document.getElementById('imageCanvas');
const ctx = canvas.getContext('2d');

// Data Structures
let annotationsData = {}; // Key: image ID, Value: annotations array
let images = []; // Array of image objects {id, src, name, file, originalWidth, originalHeight}
let currentImageIndex = -1;
let imageIdCounter = 1; // Unique ID for each image

let annotations = []; // Current image's annotations
let classes = [];
let classColors = {};
let selectedClassIndex = null;
let drawing = false;
let moving = false;
let currentAnnotation = null;
let selectedAnnotation = null;

// Zoom and Pan Variables
let scale = 1.0;
const minScale = 0.1;
const maxScale = 10.0;
let translation = { x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };

// Resize Variables
let isResizing = false;
let resizeHandleSize = 16; // Increased size for easier clicking
let handleClickRadius = resizeHandleSize / 2 + 4; // Radius around handle centers for detection
let selectedHandle = null;

// To store label areas for click detection
let labelAreas = [];
let annotationIdCounter = 1;

const MIN_BOX_SIZE = 2; // Minimum box size in pixels

// Image Display Information
let imageDisplayInfo = null; // { img, x, y, width, height, scaleFactor }

let offsetX = 0;
let offsetY = 0;

let currentHue = 0;

// UI Elements
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const uploadArea = document.getElementById('uploadArea');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const imageCounter = document.getElementById('imageCounter');

const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const resetZoomBtn = document.getElementById('resetZoomBtn');
const zoomLevelDisplay = document.getElementById('zoomLevel');

const exportProgressContainer = document.getElementById('exportProgressContainer');
const exportProgress = document.getElementById('exportProgress');
const exportProgressText = document.getElementById('exportProgressText');

const modeToggle = document.getElementById('modeToggle');
const toggleIcon = document.getElementById('toggleIcon');

// Define thumbnails lazy loading observer globally for accessibility
const observerOptions = {
    root: document.getElementById('thumbnailsContainer'),
    rootMargin: '0px',
    threshold: 0.1
};
const observer = new IntersectionObserver(onIntersection, observerOptions);

let mode = localStorage.getItem('currentMode') || 'move';

function showDropZone() {
    dropZone.classList.remove('hidden');
}

// Hide the drop zone once an image is uploaded
function hideDropZone() {
    dropZone.classList.add('hidden');
}

dropZone.addEventListener('click', () => {
    fileInput.click();
});

// Handle file upload via input
fileInput.addEventListener('change', (event) => {
    handleFiles(event); // Assuming handleFiles is your existing file handler
    hideDropZone(); // Hide drop zone after image upload
});

// Handle drag-and-drop over the canvas
container.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.classList.remove('hidden');
    dropZone.classList.add('dragover');
});

container.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

container.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragover');
    dropZone.classList.add('hidden');

    const dt = event.dataTransfer;
    const files = dt.files;
    handleFiles({ target: { files } }); // Handle the dropped files
});

// Show drop zone initially if no images are uploaded
if (images.length === 0) {
    showDropZone();
}

// Ensure the upload button is still visible even after image upload
uploadArea.classList.remove('hidden');

// Handle navigation
prevBtn.addEventListener('click', () => {
  if (currentImageIndex > 0) {
    saveAnnotations();
    currentImageIndex--;
    loadImage(currentImageIndex);
  }
});

// Toggle Mode Function
function toggleMode() {
    if (mode === 'move') {
        activateDrawMode();
    } else {
        activateMoveMode();
    }
}

// Function to activate Draw Mode
function activateDrawMode() {
    mode = 'draw';
    localStorage.setItem('currentMode', mode);
    updateStatus();
    updateModeVisuals();
    updateToggleButton();
    redraw();
}

// Function to activate Move Mode
function activateMoveMode() {
    mode = 'move';
    localStorage.setItem('currentMode', mode);
    updateStatus();
    updateModeVisuals();
    updateToggleButton();
    redraw();
}

// Function to update the toggle button's active icon
function updateToggleButton() {
    const toggleLabel = document.querySelector('.toggle-label'); // Select the label
    if (mode === 'draw') {
        modeToggle.classList.add('draw-mode');
        modeToggle.classList.remove('move-mode');
        modeToggle.setAttribute('aria-pressed', 'true');
        toggleIcon.classList.remove('fa-arrows-alt');
        toggleIcon.classList.add('fa-pencil-alt');
        toggleLabel.textContent = 'Draw'; // Update label to 'Draw'
    } else if (mode === 'move') {
        modeToggle.classList.add('move-mode');
        modeToggle.classList.remove('draw-mode');
        modeToggle.setAttribute('aria-pressed', 'false');
        toggleIcon.classList.remove('fa-pencil-alt');
        toggleIcon.classList.add('fa-arrows-alt');
        toggleLabel.textContent = 'Move'; // Update label to 'Move'
    }
}

function updateModeVisuals() {
    const imageSection = document.querySelector('.image-section');
    if (mode === 'draw') {
        imageSection.classList.add('draw-mode');
        imageSection.classList.remove('move-mode');
    } else if (mode === 'move') {
        imageSection.classList.add('move-mode');
        imageSection.classList.remove('draw-mode');
    } else {
        imageSection.classList.remove('draw-mode', 'move-mode');
    }
}

modeToggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleMode();
    }
});

window.addEventListener('DOMContentLoaded', () => {
    const hasVisited = localStorage.getItem('hasVisitedPreAnnotate');
    const savedMode = localStorage.getItem('currentMode');

    if (!hasVisited) {
        activateMoveMode(); // Default to Move Mode
        localStorage.setItem('hasVisitedPreAnnotate', 'true');
    } else if (savedMode === 'draw') {
        activateDrawMode();
    } else if (savedMode === 'move') {
        activateMoveMode();
    }

    // Load image if available
    if (currentImageIndex !== -1) {
        loadImage(currentImageIndex);
    }

    // Initialize toggle button state
    updateToggleButton();
    showWelcomeBubble();
});

// Attach Click Event Listener to Mode Toggle Button
modeToggle.addEventListener('click', toggleMode);

imageCounter.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault(); // Prevent adding a newline
        handleImageCounterEdit();
        imageCounter.blur(); // Remove focus after handling
    }
});

// Optionally, handle when the editable counter loses focus
imageCounter.addEventListener('blur', function() {
    // Reset to current image index if no valid input was provided
    imageCounter.textContent = `${images.length > 0 ? currentImageIndex + 1 : 0} / ${images.length}`;
});

function showWelcomeBubble() {
    const bubble = document.getElementById('welcomeBubble');
    const closeBtn = document.getElementById('closeBubbleBtn');

    if (bubble) {
        // Show the bubble by adding the 'visible' class
        bubble.classList.remove('hidden');
        bubble.classList.add('visible');

        // Automatically hide the bubble after 5 seconds (5000 milliseconds)
        const hideTimeout = setTimeout(() => {
            bubble.classList.remove('visible');
            bubble.classList.add('hidden');
        }, 5000);

        // Event listener for the close button
        closeBtn.addEventListener('click', () => {
            bubble.classList.remove('visible');
            bubble.classList.add('hidden');
            clearTimeout(hideTimeout); // Prevent auto-hide if manually closed
        });
    }
}

function handleImageCounterEdit() {
    const text = imageCounter.textContent.trim();
    const parts = text.split('/');
    if (parts.length !== 2) {
        alert('Invalid format. Please enter in "current / total" format.');
        imageCounter.textContent = `${images.length > 0 ? currentImageIndex + 1 : 0} / ${images.length}`;
        return;
    }

    const targetIndex = parseInt(parts[0].trim(), 10);
    const totalImages = parseInt(parts[1].trim(), 10);

    if (isNaN(targetIndex) || targetIndex < 1 || targetIndex > totalImages) {
        alert(`Please enter a valid image number between 1 and ${totalImages}.`);
        imageCounter.textContent = `${images.length > 0 ? currentImageIndex + 1 : 0} / ${images.length}`;
        return;
    }

    // Adjust to zero-based index
    const newIndex = targetIndex - 1;

    if (newIndex === currentImageIndex) {
        // No action needed
        return;
    }

    // Save current annotations before jumping
    saveAnnotations();

    // Update the current image index and load the new image
    currentImageIndex = newIndex;
    loadImage(currentImageIndex);
}

function addThumbnail(imageObj, index) {
    const thumbnailsContainer = document.getElementById('thumbnailsContainer');

    // Create thumbnail wrapper
    const thumbWrapper = document.createElement('div');
    thumbWrapper.classList.add('thumbnail-wrapper');
    thumbWrapper.style.position = 'relative'; // To position the delete button

    // Set a data attribute with the image ID
    thumbWrapper.dataset.imageId = imageObj.id;

    // Create the image element
    const img = document.createElement('img');
    img.classList.add('thumbnail');
    img.dataset.src = imageObj.src; // Use data-src for lazy loading
    img.alt = '';
    img.title = `${index + 1}: ${imageObj.name}`;

    // Click event to jump to the selected image using image ID
    img.addEventListener('click', () => {
        saveAnnotations();
        const imageId = parseInt(thumbWrapper.dataset.imageId, 10);
        const imageIndex = images.findIndex(img => img.id === imageId);
        if (imageIndex !== -1) {
            currentImageIndex = imageIndex;
            loadImage(currentImageIndex);
        } else {
            console.warn(`Image with ID ${imageId} not found.`);
        }
    });

    // Create the delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '&times;'; // Unicode multiplication sign
    deleteBtn.classList.add('delete-btn');
    deleteBtn.title = 'Delete Image';
    deleteBtn.dataset.imageId = imageObj.id; // Assign unique image ID

    // Delete button event listener
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering the thumbnail click
        const imageId = parseInt(deleteBtn.dataset.imageId, 10);
        const imageIndex = images.findIndex(img => img.id === imageId);
        if (imageIndex !== -1) {
            deleteImage(imageIndex);
        } else {
            console.warn(`Image with ID ${imageId} not found for deletion.`);
        }
    });

    // Append image and delete button to the wrapper
    thumbWrapper.appendChild(img);
    thumbWrapper.appendChild(deleteBtn);

    // Append the wrapper to the thumbnails container
    thumbnailsContainer.appendChild(thumbWrapper);
    observer.observe(img); // Observe the newly added thumbnail
}

function onIntersection(entries, observer) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
                img.src = img.dataset.src; // Directly set the src to load the image
                img.onload = function() {
                    img.dataset.src = ''; // Remove data-src to prevent re-processing
                };
            }
            observer.unobserve(img); // Stop observing once loaded
        }
    });
}

function showClassWarning() {
    if (classes.length === 0) {
        showWarning('Please create a class before drawing annotations');
        
        // Also show the welcome bubble as a secondary reminder
        const bubble = document.getElementById('welcomeBubble');
        if (bubble) {
            bubble.classList.remove('hidden');
            bubble.classList.add('visible');
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                bubble.classList.remove('visible');
                bubble.classList.add('hidden');
            }, 5000);
        }
        
        return true; // Warning was shown
    }
    return false; // No warning needed
}


nextBtn.addEventListener('click', () => {
  if (currentImageIndex < images.length - 1) {
    saveAnnotations();
    currentImageIndex++;
    loadImage(currentImageIndex);
  }
});

// Handle Zoom Controls
zoomInBtn.addEventListener('click', () => {
  zoom(1.1);
});

zoomOutBtn.addEventListener('click', () => {
  zoom(0.9);
});

resetZoomBtn.addEventListener('click', () => {
  resetZoom();
});

// Handle class input
const classInput = document.getElementById('classInput');
classInput.addEventListener('keyup', function (e) {
  if (e.key === 'Enter' && classInput.value.trim() !== '') {
    addClass(classInput.value.trim());
    activateDrawMode();
    classInput.value = '';
  } else {
    filterClasses(classInput.value.trim());
  }
});

// Hotkeys
document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        activateDrawMode();
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        activateMoveMode();
    }
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (prevBtn && !prevBtn.disabled) {
            prevBtn.click();
        }
    }
    if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (nextBtn && !nextBtn.disabled) {
            nextBtn.click();
        }
    }

    // **New Code for Tab Navigation**
    if (e.key === 'Tab') {
        // Check if any annotation is currently selected and there are multiple annotations
        if (selectedAnnotation && annotations.length > 1) {
            e.preventDefault(); // Prevent default Tab behavior (e.g., focus change)

            // Find the index of the currently selected annotation
            const currentIndex = annotations.indexOf(selectedAnnotation);

            // Calculate the index of the next annotation (with wrapping)
            const nextIndex = (currentIndex + 1) % annotations.length;

            // Update the selected annotation
            selectedAnnotation = annotations[nextIndex];

            // Update the UI and redraw the canvas
            updateStatus();
            redraw();
        }
    }
});


// Get the class list element
const classList = document.getElementById('classList');

// Event delegation: Handle clicks on class list items
classList.addEventListener('click', function(event) {
    const clickedElement = event.target;

    // Ensure that a list item was clicked
    if (clickedElement.tagName.toLowerCase() === 'li') {
        const newClass = clickedElement.textContent.trim();

        // Check if an annotation is selected
        if (selectedAnnotation) {
            // Update the annotation's class and color
            selectedAnnotation.class = newClass;
            selectedAnnotation.color = classColors[newClass];

            // Save the updated annotations
            saveAnnotations();

            // Redraw the canvas to reflect changes
            redraw();
        }
    }
});

// Canvas mouse events
canvas.addEventListener('mousedown', function (e) {
    const mousePos = getMousePos(canvas, e);

    const labelAnnotation = getLabelAtPosition(mousePos);
    if (labelAnnotation) {
        selectedAnnotation = labelAnnotation;
        mode = 'move'; // Optionally switch to move mode
        updateStatus();
        redraw();
        return; // Exit early since a label was clicked
    }

    if (mode === 'draw') {
        if (showClassWarning()) {
            return; // Prevent drawing if no classes exist
        }

        if (selectedClassIndex !== null && isInsideImage(mousePos)) {
            startX = mousePos.x;
            startY = mousePos.y;

            const normalizedStart = toNormalized(startX, startY);
            const annotation = {
                id: annotationIdCounter++, // Assign unique ID
                class: classes[selectedClassIndex],
                xNorm: normalizedStart.x,
                yNorm: normalizedStart.y,
                widthNorm: 0,
                heightNorm: 0,
                color: classColors[classes[selectedClassIndex]],
            };
            currentAnnotation = annotation;
            annotations.push(annotation);
            drawing = true;
        }
    } else if (mode === 'move') {
        const clickedAnnotation = getAnnotationAtPosition(mousePos);

        if (clickedAnnotation && clickedAnnotation !== selectedAnnotation) {
            // Select the new annotation
            selectedAnnotation = clickedAnnotation;
            updateStatus();
            redraw();
        } else if (!clickedAnnotation) {
            // Deselect if clicking outside any annotation
            if (selectedAnnotation !== null) {
                selectedAnnotation = null;
                updateStatus();
                redraw();
            }
        }

        if (selectedAnnotation) {
            // Start moving or resizing the selected annotation
            const handle = getResizeHandle(mousePos, selectedAnnotation);
            if (handle) {
                isResizing = true;
                selectedHandle = handle;
            } else {
                moving = true;

                // Calculate the annotation's current position on the canvas
                const annPos = fromNormalized(selectedAnnotation.xNorm, selectedAnnotation.yNorm);

                // Calculate the offset between the mouse position and the annotation's position
                offsetX = mousePos.x - annPos.x;
                offsetY = mousePos.y - annPos.y;
            }
        } else if (isInsideImage(mousePos)) {
            // If no annotation is selected and click is inside image, start panning
            isPanning = true;
            panStart.x = e.clientX - translation.x;
            panStart.y = e.clientY - translation.y;
            canvas.style.cursor = 'grabbing';
        }
        redraw();
    }
});

canvas.addEventListener('mousemove', function (e) {
  const mousePos = getMousePos(canvas, e);

  if (drawing && currentAnnotation) {
    let currentX = mousePos.x;
    let currentY = mousePos.y;

    // Prevent drawing outside image boundaries
    if (currentX < imageDisplayInfo.x) currentX = imageDisplayInfo.x;
    if (currentY < imageDisplayInfo.y) currentY = imageDisplayInfo.y;
    if (currentX > imageDisplayInfo.x + imageDisplayInfo.width)
        currentX = imageDisplayInfo.x + imageDisplayInfo.width;
    if (currentY > imageDisplayInfo.y + imageDisplayInfo.height)
        currentY = imageDisplayInfo.y + imageDisplayInfo.height;

    const normStart = toNormalized(startX, startY);
    const normCurrent = toNormalized(currentX, currentY);

    currentAnnotation.xNorm = Math.min(normStart.x, normCurrent.x);
    currentAnnotation.yNorm = Math.min(normStart.y, normCurrent.y);
    currentAnnotation.widthNorm = Math.abs(normCurrent.x - normStart.x);
    currentAnnotation.heightNorm = Math.abs(normCurrent.y - normStart.y);

    // Clamp annotation within [0,1]
    const imageObj = images[currentImageIndex];
    clampAnnotation(currentAnnotation, imageObj);


    redraw();
} else if (moving && selectedAnnotation) {
        if (!imageDisplayInfo) {
            console.warn('Moving Annotation: imageDisplayInfo is undefined.');
            return;
        }

        // Calculate new canvas positions
        let newX = mousePos.x - offsetX;
        let newY = mousePos.y - offsetY;

        // Clamp new positions within image boundaries
        const sizeCanvas = fromNormalizedSize(selectedAnnotation.widthNorm, selectedAnnotation.heightNorm);
        newX = Math.max(imageDisplayInfo.x, Math.min(newX, imageDisplayInfo.x + imageDisplayInfo.width - sizeCanvas.width));
        newY = Math.max(imageDisplayInfo.y, Math.min(newY, imageDisplayInfo.y + imageDisplayInfo.height - sizeCanvas.height));

        // Update normalized coordinates
        selectedAnnotation.xNorm = (newX - imageDisplayInfo.x) / imageDisplayInfo.width;
        selectedAnnotation.yNorm = (newY - imageDisplayInfo.y) / imageDisplayInfo.height;

        // Clamp normalized coordinates to [0, 1 - widthNorm] and [0, 1 - heightNorm]
        selectedAnnotation.xNorm = Math.min(Math.max(selectedAnnotation.xNorm, 0), 1 - selectedAnnotation.widthNorm);
        selectedAnnotation.yNorm = Math.min(Math.max(selectedAnnotation.yNorm, 0), 1 - selectedAnnotation.heightNorm);

        // Prevent NaN by ensuring imageDisplayInfo.width and height are not zero
        if (
            isNaN(selectedAnnotation.xNorm) ||
            isNaN(selectedAnnotation.yNorm) ||
            !isFinite(selectedAnnotation.xNorm) ||
            !isFinite(selectedAnnotation.yNorm)
        ) {
            console.warn('Moving Annotation: xNorm or yNorm is NaN or Infinite.');
            return;
        }

        redraw();
    }
 else if (isResizing && selectedAnnotation) {
    resizeAnnotation(selectedAnnotation, selectedHandle, mousePos);
    redraw();
  } else if (isPanning) {
    // Handle panning
    translation.x = e.clientX - panStart.x;
    translation.y = e.clientY - panStart.y;
    redraw();
  } else {
    // Change cursor style appropriately
    if (mode === 'move') {
      const annotation = getAnnotationAtPosition(mousePos);
      if (annotation) {
        const handle = getResizeHandle(mousePos, annotation);
        if (handle) {
          canvas.style.cursor = getCursorForHandle(handle);
        } else {
          canvas.style.cursor = 'move';
        }
      } else if (isInsideImage(mousePos)) {
        canvas.style.cursor = 'grab';
      } else {
        canvas.style.cursor = 'default';
      }
    } else if (mode === 'draw') {
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.style.cursor = 'default';
    }
  }
});

canvas.addEventListener('mouseup', function (e) {
  if (drawing) {
    drawing = false;
    currentAnnotation = null;

    // Remove annotations that are too small
    annotations = annotations.filter((ann) => {
      if (Math.abs(ann.width) < MIN_BOX_SIZE || Math.abs(ann.height) < MIN_BOX_SIZE) {
        return false;
      }
      return true;
    });

    saveAnnotations();
    redraw();
  }
  if (moving) {
    moving = false;
    saveAnnotations();
    redraw();
  }
  if (isResizing) {
    isResizing = false;
    selectedHandle = null;
    saveAnnotations();
    redraw();
  }
  if (isPanning) {
    isPanning = false;
    canvas.style.cursor = 'grab'; // Change cursor to default grab state after panning ends
    redraw();
  }
});

// Handle mouse leaving the canvas
canvas.addEventListener('mouseleave', function (e) {
  if (drawing) {
    drawing = false;
    currentAnnotation = null;
  }
  if (moving) {
    moving = false;
  }
  if (isResizing) {
    isResizing = false;
    selectedHandle = null;
  }
  if (isPanning) {
    isPanning = false;
    canvas.style.cursor = 'default';
  }
});

// Update Zoom Level Display
function updateZoomLevel() {
    const zoomPercentage = Math.round(scale * 100);
    zoomLevelDisplay.textContent = `${zoomPercentage}%`;
}

// Handle Zoom with Mouse Wheel
canvas.addEventListener('wheel', function (e) {
    e.preventDefault();

    // Adjust zoom sensitivity based on current scale
    const zoomIntensity = 0.02;
    const delta = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;

    const mousePos = getMousePos(canvas, e);

    // Calculate the new scale
    const newScale = scale * (1 + delta);
    if (newScale < minScale || newScale > maxScale) return;

    // Adjust the translation to keep the mouse position consistent
    translation.x -= (mousePos.x + translation.x) * (newScale / scale - 1);
    translation.y -= (mousePos.y + translation.y) * (newScale / scale - 1);

    // Update the scale
    scale = newScale;
    updateZoomLevel();
    redraw();
});

// Zoom Functions
function zoom(factor) {
    // Calculate the center of the canvas
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Convert the center point to canvas coordinates
    const x = centerX * (canvas.width / rect.width);
    const y = centerY * (canvas.height / rect.height);

    // Adjust for scaling and translation to get canvas coordinates
    const mousePos = {
        x: (x / scale) - translation.x,
        y: (y / scale) - translation.y,
    };

    // Calculate the new scale
    const newScale = scale * factor;
    if (newScale < minScale || newScale > maxScale) return;

    // Adjust the translation to keep the zoom centered
    translation.x -= mousePos.x * (newScale / scale - 1);
    translation.y -= mousePos.y * (newScale / scale - 1);

    // Update the scale
    scale = newScale;
    updateZoomLevel();
    redraw();
}

function resetZoom() {
    scale = 1.0;
    translation = { x: 0, y: 0 };
    updateZoomLevel();
    redraw();
}

function getBaseName(path) {
    return path.split('/').pop();
}

// Image upload and management functions
function handleFiles(event) {
  const files = event.target.files;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.type.startsWith('image/')) {
      const objectURL = URL.createObjectURL(file);
      addImage(objectURL, file.name, file);
    }
  }
  // Update image count and navigation buttons immediately after upload
  updateImageCounter();
  updateNavigationButtons();
}

function addImage(src, name, file) {
    const baseName = getBaseName(name); // Extract base name

    // Check if an image with the same name already exists
    const existingImageIndex = images.findIndex(img => img.name === baseName);
    if (existingImageIndex !== -1) {
        const existingImage = images[existingImageIndex];

        // Remove existing image from the images array
        images.splice(existingImageIndex, 1);

        // Remove annotations related to the existing image
        delete annotationsData[existingImage.id];

        // Remove the thumbnail from the DOM
        const thumbnailsContainer = document.getElementById('thumbnailsContainer');
        const thumbWrappers = thumbnailsContainer.getElementsByClassName('thumbnail-wrapper');
        for (let thumb of thumbWrappers) {
            if (parseInt(thumb.dataset.imageId, 10) === existingImage.id) {
                thumbnailsContainer.removeChild(thumb);
                break;
            }
        }

        console.log(`Image "${baseName}" has been overwritten.`);
    }

    const imageObj = {
        id: imageIdCounter++,
        src: src,
        name: baseName, // Use base name without any path
        file: file, // Store the File object
        originalWidth: 0, // To be set when image is loaded
        originalHeight: 0, // To be set when image is loaded
    };
    images.push(imageObj);
    annotationsData[imageObj.id] = []; // Initialize annotations array

    // If it's the first user-added image, load it and add its thumbnail
    if (currentImageIndex === -1) {
        currentImageIndex = 0;
        loadImage(currentImageIndex);
    }

    // Add thumbnail for the newly uploaded image
    addThumbnail(imageObj, images.length - 1);
}


function loadImage(index) {
    if (index < 0 || index >= images.length) return;
    const imageObj = images[index];
    const img = new Image();
    img.src = imageObj.src;
    img.crossOrigin = 'Anonymous'; // Allow cross-origin image loading if needed

    img.onload = function () {
        imageObj.originalWidth = img.width; // Store original width
        imageObj.originalHeight = img.height; // Store original height

        // Get the container dimensions
        const container = document.getElementById('container');
        const containerRect = container.getBoundingClientRect();

        // Set canvas size to container size
        canvas.width = containerRect.width;
        canvas.height = containerRect.height;

        // Calculate scale factors to fit the image within the canvas
        const scaleX = canvas.width / img.width;
        const scaleY = canvas.height / img.height;
        const scaleFactor = Math.min(scaleX, scaleY);

        // Calculate the new image dimensions
        const imgWidth = img.width * scaleFactor;
        const imgHeight = img.height * scaleFactor;

        // Center the image
        const imgX = (canvas.width - imgWidth) / 2;
        const imgY = (canvas.height - imgHeight) / 2;

        // Store these values for use in other functions
        imageDisplayInfo = {
            img: img,
            x: imgX,
            y: imgY,
            width: imgWidth,
            height: imgHeight,
            scaleFactor: scaleFactor,
        };

        // Save displayInfo in imageObj for export
        imageObj.displayInfo = { ...imageDisplayInfo };

        annotations = annotationsData[imageObj.id] || [];

        // Reset zoom and pan
        scale = 1.0;
        translation = { x: 0, y: 0 };
        updateZoomLevel();

        redraw();
        updateImageCounter();
        updateNavigationButtons();
    };

    // If image is cached
    if (img.complete) {
        img.onload();
    }
}

updateZoomLevel();

function updateImageCounter() {
  imageCounter.textContent = `${images.length > 0 ? currentImageIndex + 1 : 0} / ${images.length}`;
}

function updateNavigationButtons() {
  prevBtn.disabled = currentImageIndex <= 0;
  nextBtn.disabled = currentImageIndex >= images.length - 1;
}

// Annotation management functions
function saveAnnotations() {
    if (currentImageIndex === -1 || currentImageIndex >= images.length) return;
    const imageObj = images[currentImageIndex];
    if (imageObj) {
        annotationsData[imageObj.id] = annotations;
    } else {
        console.warn(`saveAnnotations: No image found at index ${currentImageIndex}.`);
    }
}

function redraw() {
    if (currentImageIndex === -1) return;
    const imageObj = images[currentImageIndex];
    if (!imageObj.displayInfo) return;

    const { img, x, y, width, height } = imageObj.displayInfo;

    // Clear and apply transformations
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // Apply scaling and translation
    ctx.scale(scale, scale);
    ctx.translate(translation.x, translation.y);

    // Draw the image
    ctx.drawImage(img, x, y, width, height);

    labelAreas = []; // Reset label areas

    // Draw annotations
    annotations = annotationsData[imageObj.id] || [];
    annotations.forEach((ann) => {
        // Convert normalized coordinates to canvas coordinates
        const pos = fromNormalized(ann.xNorm, ann.yNorm);
        const size = fromNormalizedSize(ann.widthNorm, ann.heightNorm);

        ctx.strokeStyle = ann.color;
        ctx.lineWidth = 2 / scale; // Adjust line width based on scale
        ctx.strokeRect(pos.x, pos.y, size.width, size.height);

        // Fill the rectangle with low opacity color
        ctx.globalAlpha = 0.2; // Low opacity
        ctx.fillStyle = ann.color;
        ctx.fillRect(pos.x, pos.y, size.width, size.height);
        ctx.globalAlpha = 1.0; // Reset opacity

        // Draw label
        drawLabel({
            ...ann,
            x: pos.x,
            y: pos.y,
            width: size.width,
            height: size.height
        });

        // Draw resize handles if in moving mode and this annotation is selected
        if (mode === 'move' && selectedAnnotation === ann) {
            drawResizeHandles({
                ...ann,
                x: pos.x,
                y: pos.y,
                width: size.width,
                height: size.height
            });
        }
    });
    ctx.restore();
}

function drawLabel(ann) {
    // Determine background color based on box color luminance
    const colorRgb = hexToRgb(ann.color);
    const luminance = getLuminance(colorRgb.r, colorRgb.g, colorRgb.b);
    const backgroundColor = luminance > 128 ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)';

    // Label text color matches box color
    const textColor = luminance > 128 ? '#fff' : '#000';

    // Prepare label text with limited max font size
    const baseFontSize = 14;
    const maxFontSize = 20;
    const fontSize = Math.min(baseFontSize / scale, maxFontSize);
    ctx.font = `${fontSize}px Arial`; // Adjust font size based on scale
    const label = `${ann.class} (${ann.id})`;
    const textMetrics = ctx.measureText(label);
    const textWidth = textMetrics.width;
    const textHeight = fontSize; // Use actual font size

    // Determine label position with scaled padding and limit padding
    const basePadding = 5;
    const scaledPadding = Math.min(basePadding / scale, 10); // Max padding 10px
    const padding = scaledPadding;

    let labelX = ann.x + padding;
    let labelY = ann.y - padding - textHeight; // Above the box

    let labelArea = null;

    // Check if label would be outside the top boundary
    if (labelY - textHeight < imageDisplayInfo.y) {
        // If so, draw the label inside the box
        labelY = ann.y + padding + textHeight;
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(labelX, ann.y + padding, textWidth + 2 * padding, textHeight + 2 * padding);
        // Record label area in image coordinates
        labelArea = {
            x: (labelX / scale) - translation.x,
            y: ((ann.y + padding) / scale) - translation.y,
            width: (textWidth + 2 * padding) / scale,
            height: (textHeight + 2 * padding) / scale,
            annotation: ann,
        };
    } else {
        // Draw label above the box
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(labelX, labelY - textHeight - padding, textWidth + 2 * padding, textHeight + 2 * padding);
        // Record label area in image coordinates
        labelArea = {
            x: (labelX / scale) - translation.x,
            y: ((labelY - textHeight - padding) / scale) - translation.y,
            width: (textWidth + 2 * padding) / scale,
            height: (textHeight + 2 * padding) / scale,
            annotation: ann,
        };
    }

    if (labelArea) {
        labelAreas.push(labelArea);
    }

    // Draw label text
    ctx.fillStyle = textColor;
    ctx.fillText(label, labelX + padding, labelY);
}


function getLabelAtPosition(pos) {
  for (let i = 0; i < labelAreas.length; i++) {
    const label = labelAreas[i];
    if (
      pos.x >= label.x &&
      pos.x <= label.x + label.width &&
      pos.y >= label.y &&
      pos.y <= label.y + label.height
    ) {
      return label.annotation;
    }
  }
  return null;
}

function hslToHex(h, s, l) {
    // Convert HSL to RGB first
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(-1, Math.min(Math.min(k - 3, 9 - k), 1));
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function generateDistinctColor() {
    // Golden Angle in degrees
    const goldenAngle = 137.5;

    // Increment the hue
    currentHue = (currentHue + goldenAngle) % 360;

    // Fixed saturation and lightness for high contrast
    const saturation = 65; // Adjust as needed (0-100)
    const lightness = 50;  // Adjust as needed (0-100)

    return hslToHex(currentHue, saturation, lightness);
}

function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r, g, b };
}

function getLuminance(r, g, b) {
  // Calculate luminance
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (evt.clientX - rect.left) * scaleX;
    const y = (evt.clientY - rect.top) * scaleY;

    // Adjust for scaling and translation
    const adjustedX = (x / scale) - translation.x;
    const adjustedY = (y / scale) - translation.y;

    return { x: adjustedX, y: adjustedY };
}

function isInsideImage(pos) {
    if (!imageDisplayInfo) return false;
    const { x, y, width, height } = imageDisplayInfo;
    return pos.x >= x && pos.x <= x + width && pos.y >= y && pos.y <= y + height;
  }

function normalizeCoordinates(x1, y1, x2, y2) {
  const normalized = {};
  normalized.x = Math.min(x1, x2);
  normalized.y = Math.min(y1, y2);
  normalized.width = Math.abs(x2 - x1);
  normalized.height = Math.abs(y2 - y1);
  return normalized;
}

function getAnnotationAtPosition(pos) {
    // First, check if the click is inside the currently selected annotation
    if (selectedAnnotation) {
        const posCanvas = fromNormalized(selectedAnnotation.xNorm, selectedAnnotation.yNorm);
        const sizeCanvas = fromNormalizedSize(selectedAnnotation.widthNorm, selectedAnnotation.heightNorm);
        if (
            pos.x >= posCanvas.x &&
            pos.x <= posCanvas.x + sizeCanvas.width &&
            pos.y >= posCanvas.y &&
            pos.y <= posCanvas.y + sizeCanvas.height
        ) {
            return selectedAnnotation;
        }
    }

    // If not inside the selected annotation, return the topmost annotation at the position
    for (let i = annotations.length - 1; i >= 0; i--) {
        const ann = annotations[i];
        // Skip the selected annotation since it's already checked
        if (ann === selectedAnnotation) continue;

        const posCanvas = fromNormalized(ann.xNorm, ann.yNorm);
        const sizeCanvas = fromNormalizedSize(ann.widthNorm, ann.heightNorm);
        if (
            pos.x >= posCanvas.x &&
            pos.x <= posCanvas.x + sizeCanvas.width &&
            pos.y >= posCanvas.y &&
            pos.y <= posCanvas.y + sizeCanvas.height
        ) {
            return ann;
        }
    }

    return null;
}


function clampAnnotation(annotation, imageObj) {
    // Clamp normalized x and width
    if (annotation.xNorm < 0) {
        annotation.widthNorm += annotation.xNorm;
        annotation.xNorm = 0;
    }
    if (annotation.xNorm + annotation.widthNorm > 1) {
        annotation.widthNorm = 1 - annotation.xNorm;
    }

    // Clamp normalized y and height
    if (annotation.yNorm < 0) {
        annotation.heightNorm += annotation.yNorm;
        annotation.yNorm = 0;
    }
    if (annotation.yNorm + annotation.heightNorm > 1) {
        annotation.heightNorm = 1 - annotation.yNorm;
    }

    // Ensure minimum size
    const minWidthNorm = MIN_BOX_SIZE / imageObj.originalWidth; // Define MIN_BOX_SIZE appropriately
    const minHeightNorm = MIN_BOX_SIZE / imageObj.originalHeight; // Define MIN_BOX_SIZE appropriately

    if (annotation.widthNorm < minWidthNorm) annotation.widthNorm = minWidthNorm;
    if (annotation.heightNorm < minHeightNorm) annotation.heightNorm = minHeightNorm;
}

function drawResizeHandles(ann) {
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1 / scale; // Adjust line width based on scale

    // Draw handles at corners and edges using canvas coordinates
    const handles = getHandlesCoordinates({
        x: fromNormalized(ann.xNorm, ann.yNorm).x,
        y: fromNormalized(ann.xNorm, ann.yNorm).y,
        width: fromNormalizedSize(ann.widthNorm, ann.heightNorm).width,
        height: fromNormalizedSize(ann.widthNorm, ann.heightNorm).height
    });
    handles.forEach((handle) => {
        ctx.beginPath();
        ctx.arc(
            handle.x,
            handle.y,
            resizeHandleSize / scale / 2,
            0,
            2 * Math.PI
        );
        ctx.fill();
        ctx.stroke();
    });
}

function getHandlesCoordinates(ann) {
  const x = ann.x;
  const y = ann.y;
  const w = ann.width;
  const h = ann.height;
  return [
    { x: x, y: y, position: 'nw' },
    { x: x + w / 2, y: y, position: 'n' },
    { x: x + w, y: y, position: 'ne' },
    { x: x, y: y + h / 2, position: 'w' },
    { x: x + w, y: y + h / 2, position: 'e' },
    { x: x, y: y + h, position: 'sw' },
    { x: x + w / 2, y: y + h, position: 's' },
    { x: x + w, y: y + h, position: 'se' },
  ];
}

function getResizeHandle(pos, ann) {
    const imageObj = images[currentImageIndex];
    const posCanvas = fromNormalized(ann.xNorm, ann.yNorm);
    const sizeCanvas = fromNormalizedSize(ann.widthNorm, ann.heightNorm);
    const handles = getHandlesCoordinates({
        x: posCanvas.x,
        y: posCanvas.y,
        width: sizeCanvas.width,
        height: sizeCanvas.height
    });
    for (let i = 0; i < handles.length; i++) {
        const handle = handles[i];
        const dx = pos.x - handle.x;
        const dy = pos.y - handle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= handleClickRadius / scale) {
            return handle.position;
        }
    }
    return null;
}


function resizeAnnotation(ann, handle, pos) {
    const imageObj = images[currentImageIndex];
    if (!imageObj || !imageObj.displayInfo) {
        console.warn('resizeAnnotation: imageObj or displayInfo is undefined.');
        return;
    }

    // Convert normalized coordinates to canvas coordinates
    const posCanvas = fromNormalized(ann.xNorm, ann.yNorm);
    const sizeCanvas = fromNormalizedSize(ann.widthNorm, ann.heightNorm);

    let x = posCanvas.x;
    let y = posCanvas.y;
    let width = sizeCanvas.width;
    let height = sizeCanvas.height;

    switch (handle) {
        case 'nw':
            width += x - pos.x;
            height += y - pos.y;
            x = pos.x;
            y = pos.y;
            break;
        case 'n':
            height += y - pos.y;
            y = pos.y;
            break;
        case 'ne':
            width = pos.x - x;
            height += y - pos.y;
            y = pos.y;
            break;
        case 'e':
            width = pos.x - x;
            break;
        case 'se':
            width = pos.x - x;
            height = pos.y - y;
            break;
        case 's':
            height = pos.y - y;
            break;
        case 'sw':
            width += x - pos.x;
            height = pos.y - y;
            x = pos.x;
            break;
        case 'w':
            width += x - pos.x;
            x = pos.x;
            break;
    }

    // Convert back to normalized coordinates
    const normStart = toNormalized(x, y);
    const normEnd = toNormalized(x + width, y + height);

    // Prevent division by zero or invalid values
    if (
        isNaN(normStart.x) || isNaN(normStart.y) ||
        isNaN(normEnd.x) || isNaN(normEnd.y)
    ) {
        console.warn('resizeAnnotation: normStart or normEnd contains NaN.');
        return;
    }

    ann.xNorm = Math.min(normStart.x, normEnd.x);
    ann.yNorm = Math.min(normStart.y, normEnd.y);
    ann.widthNorm = Math.abs(normEnd.x - normStart.x);
    ann.heightNorm = Math.abs(normEnd.y - normStart.y);

    // Clamp the annotation within [0,1]
    clampAnnotation(ann, imageObj);
}

function getCursorForHandle(handle) {
  switch (handle) {
    case 'nw':
    case 'se':
      return 'nwse-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
  }
  return 'default';
}

// Class management functions
function addClass(className) {
  if (!classes.includes(className)) {
    classes.push(className);
    classColors[className] = generateDistinctColor();
    updateClassList();
  }
  selectedClassIndex = classes.indexOf(className);
  updateClassList();
}


function updateClassList() {
  const classList = document.getElementById('classList');
  classList.innerHTML = '';
  classes.forEach((cls, index) => {
    const li = document.createElement('li');
    li.classList.add('class-item');
    if (index === selectedClassIndex) {
      li.classList.add('selected');
    }
    li.addEventListener('click', () => selectClass(index));

    // Create a small swatch that shows the class color.
    const swatch = document.createElement('span');
    swatch.classList.add('color-swatch');
    swatch.style.backgroundColor = classColors[cls];

    // Create a span to hold the class name.
    const nameSpan = document.createElement('span');
    nameSpan.classList.add('class-name');
    nameSpan.textContent = cls;

    li.appendChild(swatch);
    li.appendChild(nameSpan);

    classList.appendChild(li);
  });
}




function selectClass(index) {
  selectedClassIndex = index;
  updateClassList();
}

function filterClasses(query) {
  const classList = document.getElementById('classList');
  const items = classList.getElementsByTagName('li');
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (
      item.textContent.toLowerCase().includes(query.toLowerCase()) ||
      item.textContent === '...'
    ) {
      item.classList.remove('hidden');
    } else {
      item.classList.add('hidden');
    }
  }
}

function enableDrawingMode() {
  mode = 'draw';
  updateStatus();
  canvas.style.cursor = 'crosshair';
  selectedAnnotation = null;
  redraw();
}

function enableMovingMode() {
  mode = 'move';
  updateStatus();
  canvas.style.cursor = 'default';
  selectedAnnotation = null;
  redraw();
}

function updateStatus() {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent =
    'Mode: ' +
    (mode === 'draw' ? 'Drawing' : mode === 'move' ? 'Moving' : 'None');
}

// Export Functions
async function exportAnnotationsOnly() {
    if (images.length === 0) {
        alert('No images to export annotations.');
        return;
    }

    const zip = new JSZip();
    const annotationsFolder = zip.folder("labels");

    const totalImages = images.length;
    let processedImages = 0;

    // Show progress bar
    exportProgressContainer.style.display = 'block';
    exportProgress.value = 0;
    exportProgressText.textContent = '0%';

    // Assign class indices based on their order in the classes array
    const classIndices = {};
    classes.forEach((cls, index) => {
        classIndices[cls] = index;
    });

    for (const imageObj of images) {
        const anns = annotationsData[imageObj.id];
        if (!anns || anns.length === 0) {
            processedImages++;
            updateProgress(processedImages, totalImages, 70); // 70% allocated to image processing
            continue; // No annotations to export
        }

        // Ensure displayInfo is available
        if (!imageObj.displayInfo) {
            console.warn(`Display info not found for image: ${imageObj.name}. Skipping annotations export for this image.`);
            processedImages++;
            updateProgress(processedImages, totalImages, 70);
            continue;
        }

        const displayInfo = imageObj.displayInfo;
        const originalWidth = imageObj.originalWidth;
        const originalHeight = imageObj.originalHeight;

        // Prepare YOLOv5 annotation lines
        const txtLines = anns.map(ann => {
            const clsIndex = classIndices[ann.class];
            if (clsIndex === undefined) {
                console.warn(`Class "${ann.class}" not found in class list. Skipping this annotation.`);
                return null;
            }

            // Calculate normalized coordinates based on original image dimensions
            const x_center = ann.xNorm + ann.widthNorm / 2;
            const y_center = ann.yNorm + ann.heightNorm / 2;
            const width_norm = ann.widthNorm;
            const height_norm = ann.heightNorm;

            // Clamp values to [0,1] to avoid invalid annotations
            const clamp = (num) => Math.min(Math.max(num, 0), 1);
            const x_c = clamp(x_center);
            const y_c = clamp(y_center);
            const w = clamp(width_norm);
            const h = clamp(height_norm);

            return `${clsIndex} ${x_c.toFixed(6)} ${y_c.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}`;
        }).filter(line => line !== null);

        if (txtLines.length > 0) {
            const txtContent = txtLines.join('\n');
            const txtFileName = imageObj.name.replace(/\.[^/.]+$/, "") + ".txt"; // Replace image extension with .txt
            annotationsFolder.file(txtFileName, txtContent);
        }

        processedImages++;
        updateProgress(processedImages, totalImages, 70);
    }

    // Create data.yaml
    const dataYamlContent = {
        nc: classes.length,
        names: classes
    };
    // Optionally, define train and val paths. For simplicity, we'll set them to 'images/train' and 'images/val'
    dataYamlContent.train = "images/train";
    dataYamlContent.val = "images/val";
    const dataYamlString = jsyaml.dump(dataYamlContent); // Ensure js-yaml is loaded
    zip.file("data.yaml", dataYamlString); // Add data.yaml to the root of the ZIP

    // Phase 2: ZIP Generation (30% of total progress)
    zip.generateAsync({ type: 'blob' }, (metadata) => {
        // metadata.percent ranges from 0 to 100 for the ZIP generation phase
        const zipProgress = metadata.percent;
        const totalProgress = 70 + (zipProgress * 0.3); // 70% already completed
        exportProgress.value = totalProgress;
        exportProgressText.textContent = `${Math.round(totalProgress)}%`;
    })
    .then(function (content) {
        saveAs(content, 'annotations_only.zip');
        // Hide progress bar after completion
        exportProgressContainer.style.display = 'none';
    })
    .catch(function (err) {
        console.error('Error generating ZIP:', err);
        alert('An error occurred while exporting annotations.');
        // Hide progress bar in case of error
        exportProgressContainer.style.display = 'none';
    });
}

async function exportAnnotationsAndImages() {

    console.log("Classes:", classes);
    if (images.length === 0) {
        alert('No images to export.');
        return;
    }

    const zip = new JSZip();
    const annotationsFolder = zip.folder("labels");
    const imagesFolder = zip.folder("images");

    const totalImages = images.length;
    let processedImages = 0;

    // Show progress bar
    exportProgressContainer.style.display = 'block';
    exportProgress.value = 0;
    exportProgressText.textContent = '0%';

    // Assign class indices based on their order in the classes array
    const classIndices = {};
    classes.forEach((cls, index) => {
        classIndices[cls] = index;
    });

    for (const imageObj of images) {
        // Phase 1: Add image to ZIP
        try {
            const response = await fetch(imageObj.src);
            const imgBlob = await response.blob();
            imagesFolder.file(imageObj.name, imgBlob);
        } catch (error) {
            console.error(`Failed to fetch image: ${imageObj.name}`, error);
            // Continue with annotations even if image fetch fails
        }

        // Phase 2: Add annotations
        const anns = annotationsData[imageObj.id];
        if (!anns || anns.length === 0) {
            processedImages++;
            updateProgress(processedImages, totalImages, 70);
            continue; // No annotations to export
        }

        // Ensure displayInfo is available
        if (!imageObj.displayInfo) {
            console.warn(`Display info not found for image: ${imageObj.name}. Skipping annotations export for this image.`);
            processedImages++;
            updateProgress(processedImages, totalImages, 70);
            continue;
        }

        const displayInfo = imageObj.displayInfo;
        const originalWidth = imageObj.originalWidth;
        const originalHeight = imageObj.originalHeight;

        // Prepare YOLOv5 annotation lines
        const txtLines = anns.map(ann => {
            const clsIndex = classIndices[ann.class];
            if (clsIndex === undefined) {
                console.warn(`Class "${ann.class}" not found in class list. Skipping this annotation.`);
                return null;
            }

            // Calculate normalized coordinates based on original image dimensions
            const x_center = ann.xNorm + ann.widthNorm / 2;
            const y_center = ann.yNorm + ann.heightNorm / 2;
            const width_norm = ann.widthNorm;
            const height_norm = ann.heightNorm;

            // Clamp values to [0,1] to avoid invalid annotations
            const clamp = (num) => Math.min(Math.max(num, 0), 1);
            const x_c = clamp(x_center);
            const y_c = clamp(y_center);
            const w = clamp(width_norm);
            const h = clamp(height_norm);

            return `${clsIndex} ${x_c.toFixed(6)} ${y_c.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}`;
        }).filter(line => line !== null);

        if (txtLines.length > 0) {
            const txtContent = txtLines.join('\n');
            const txtFileName = imageObj.name.replace(/\.[^/.]+$/, "") + ".txt"; // Replace image extension with .txt
            annotationsFolder.file(txtFileName, txtContent);
        }

        processedImages++;
        updateProgress(processedImages, totalImages, 70);
    }


    // Create data.yaml
    const dataYamlContent = {
        nc: classes.length,
        names: classes,
        train: "images/train",
        val: "images/val"
    };
    const dataYamlString = jsyaml.dump(dataYamlContent);
    console.log("Generated data.yaml content:", dataYamlString);
    zip.file("data.yaml", dataYamlString); // Add data.yaml to the root of the ZIP

    // Phase 2: ZIP Generation (30% of total progress)
    zip.generateAsync({ type: 'blob' }, (metadata) => {
        // metadata.percent ranges from 0 to 100 for the ZIP generation phase
        const zipProgress = metadata.percent;
        const totalProgress = 70 + (zipProgress * 0.3); // 70% already completed
        exportProgress.value = totalProgress;
        exportProgressText.textContent = `${Math.round(totalProgress)}%`;
    })
    .then(function (content) {
        saveAs(content, 'annotations_and_images.zip');
        // Hide progress bar after completion
        exportProgressContainer.style.display = 'none';
    })
    .catch(function (err) {
        console.error('Error generating ZIP:', err);
        alert('An error occurred while exporting annotations and images.');
        // Hide progress bar in case of error
        exportProgressContainer.style.display = 'none';
    });
}

async function handleImportAnnotationsOnly(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Prompt user for confirmation
    const confirmImport = confirm("Importing annotations will replace the current annotations. Do you want to proceed?");
    if (!confirmImport) {
        console.log("Import Annotations Only: User canceled the import.");
        return;
    }

    try {
        const zip = await JSZip.loadAsync(file);
        console.log("ZIP file loaded successfully for Annotations Only.");

        // Extract data.yaml
        const dataYamlFile = zip.file("data.yaml");
        if (!dataYamlFile) {
            alert("data.yaml not found in the ZIP file.");
            console.error("data.yaml not found in the ZIP file.");
            return;
        }

        const dataYamlContent = await dataYamlFile.async("string");
        const dataYaml = jsyaml.load(dataYamlContent);
        console.log("data.yaml content:", dataYaml);

        // Update classes
        if (dataYaml.names && Array.isArray(dataYaml.names)) {
            // Merge imported classes with existing classes without duplicates
            dataYaml.names.forEach(cls => {
                if (!classes.includes(cls)) {
                    classes.push(cls);
                    classColors[cls] = generateDistinctColor();
                }
            });

            updateClassList();
            console.log("Classes updated after import.");
        } else {
            alert("Invalid data.yaml format: 'names' key missing or not an array.");
            console.error("Invalid data.yaml format.");
            return;
        }

        // Clear existing annotations
        annotationsData = {}; // Reset annotations data
        annotations = []; // Reset current annotations
        saveAnnotations(); // Save the cleared annotations
        redraw(); // Redraw the canvas
        console.log("Existing annotations cleared.");

        // Extract and process .txt annotation files
        let annotationFiles = [];
        if (zip.folder("labels")) {
            zip.folder("labels").forEach(function(relativePath, file) {
                if (relativePath.endsWith(".txt")) {
                    annotationFiles.push(file);
                }
            });
        } else {
            zip.forEach(function(relativePath, file) {
                if (relativePath.endsWith(".txt")) {
                    annotationFiles.push(file);
                }
            });
        }

        if (annotationFiles.length === 0) {
            alert("No annotation .txt files found in the ZIP.");
            console.warn("No annotation .txt files found in the ZIP.");
            return;
        }

        for (const annotationFile of annotationFiles) {
            const txtContent = await annotationFile.async("string");
            // Extract the base image name without the folder path
            const imageName = annotationFile.name.split('/').pop().replace(".txt", "");
            console.log(`Processing annotation for image: ${imageName}`);

            // Find the corresponding image
            let imageObj = images.find(img => img.name.replace(/\.[^/.]+$/, "") === imageName);
            if (!imageObj) {
                console.warn(`Image corresponding to ${annotationFile.name} not found. Skipping this annotation.`);
                continue;
            }

            // Parse annotation lines
            const lines = txtContent.split('\n').filter(line => line.trim() !== '');
            const annsForImage = lines.map(line => {
                const parts = line.trim().split(' ');
                if (parts.length !== 5) {
                    console.warn(`Invalid annotation format in file ${annotationFile.name}: ${line}`);
                    return null;
                }
                const clsIndex = parseInt(parts[0], 10);
                const x_center = parseFloat(parts[1]);
                const y_center = parseFloat(parts[2]);
                const width_norm = parseFloat(parts[3]);
                const height_norm = parseFloat(parts[4]);

                const className = dataYaml.names[clsIndex];
                if (!className) {
                    console.warn(`Class index ${clsIndex} not found in data.yaml. Skipping this annotation.`);
                    return null;
                }

                // Calculate xNorm and yNorm from x_center_norm and y_center_norm
                const xNorm = x_center - width_norm / 2;
                const yNorm = y_center - height_norm / 2;

                // Clamp normalized values to [0,1]
                const clamp = (num) => Math.min(Math.max(num, 0), 1);
                const clampedXNorm = clamp(xNorm);
                const clampedYNorm = clamp(yNorm);
                const clampedWidthNorm = clamp(width_norm);
                const clampedHeightNorm = clamp(height_norm);

                return {
                    id: annotationIdCounter++, // Assign unique global ID
                    class: className,
                    xNorm: clampedXNorm,
                    yNorm: clampedYNorm,
                    widthNorm: clampedWidthNorm,
                    heightNorm: clampedHeightNorm,
                    color: classColors[className],
                };
            }).filter(ann => ann !== null); // Remove any null entries

            // Assign annotations to the image
            annotationsData[imageObj.id] = annsForImage;
        }

        // Redraw all images with new annotations
        if (images.length > 0) {
            currentImageIndex = 0; // Reset to first image
            loadImage(currentImageIndex);
            console.log("Import Annotations Only: Annotations imported and session updated.");
        }

        alert("Annotations imported successfully.");
    }
    catch (error) {
        alert("An error occurred while importing annotations.");
        console.error("Error importing annotations:", error);
    }
}

async function handleImportAll(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Prompt user for confirmation
    const confirmImport = confirm("Importing annotations and images will replace the current annotations and add new images. Do you want to proceed?");
    if (!confirmImport) {
        console.log("Import Annotations & Images: User canceled the import.");
        return;
    }

    try {
        const zip = await JSZip.loadAsync(file);
        console.log("ZIP file loaded successfully for Annotations & Images.");

        // Extract data.yaml
        const dataYamlFile = zip.file("data.yaml");
        if (!dataYamlFile) {
            alert("data.yaml not found in the ZIP file.");
            console.error("data.yaml not found in the ZIP file.");
            return;
        }

        const dataYamlContent = await dataYamlFile.async("string");
        const dataYaml = jsyaml.load(dataYamlContent);
        console.log("data.yaml content:", dataYaml);

        // Update classes
        if (dataYaml.names && Array.isArray(dataYaml.names)) {
            // Merge imported classes with existing classes without duplicates
            dataYaml.names.forEach(cls => {
                if (!classes.includes(cls)) {
                    classes.push(cls);
                    classColors[cls] = generateDistinctColor();
                }
            });

            updateClassList();
            console.log("Classes updated after import.");
        } else {
            alert("Invalid data.yaml format: 'names' key missing or not an array.");
            console.error("Invalid data.yaml format.");
            return;
        }

        // Optionally, clear existing annotations
        const clearExisting = confirm("Do you want to clear existing annotations before importing?");
        if (clearExisting) {
            annotationsData = {}; // Reset annotations data
            annotations = []; // Reset current annotations
            saveAnnotations(); // Save the cleared annotations
            redraw(); // Redraw the canvas
            console.log("Existing annotations cleared.");
        }

        // Extract and process images
        let imageFiles = [];
        if (zip.folder("images")) {
            zip.folder("images").forEach(function(relativePath, file) {
                if (relativePath.match(/\.(jpg|jpeg|png|gif)$/i)) {
                    imageFiles.push(file);
                }
            });
        } else {
            // If 'images' folder doesn't exist, attempt to find images in root
            zip.forEach(function(relativePath, file) {
                if (relativePath.match(/\.(jpg|jpeg|png|gif)$/i)) {
                    imageFiles.push(file);
                }
            });
        }

        // Array to hold promises for image loading
        const imageLoadPromises = imageFiles.map(async (imageFile) => {
            const imgBlob = await imageFile.async("blob");
            const imgURL = URL.createObjectURL(imgBlob);
            const imageName = getBaseName(imageFile.name); // Extract base name
            console.log(`Importing image: ${imageName}`);

            // Check if image already exists
            let existingImage = images.find(img => img.name === imageName);
            if (existingImage) {
                // Remove existing image from the images array
                const index = images.indexOf(existingImage);
                if (index > -1) {
                    images.splice(index, 1);
                }

                // Remove annotations related to the existing image
                delete annotationsData[existingImage.id];

                // Remove the thumbnail from the DOM
                const thumbnailsContainer = document.getElementById('thumbnailsContainer');
                const thumbWrappers = thumbnailsContainer.getElementsByClassName('thumbnail-wrapper');
                for (let thumb of thumbWrappers) {
                    if (parseInt(thumb.dataset.imageId, 10) === existingImage.id) {
                        thumbnailsContainer.removeChild(thumb);
                        break;
                    }
                }

                console.log(`Image "${imageName}" has been overwritten.`);
            }

            // Add the new image
            const newImageObj = {
                id: imageIdCounter++,
                src: imgURL,
                name: imageName, // Use base name
                file: imageFile, // Optional: Store the File object if needed
                originalWidth: 0, // To be set when image is loaded
                originalHeight: 0, // To be set when image is loaded
            };
            images.push(newImageObj);
            annotationsData[newImageObj.id] = []; // Initialize annotations array

            // Load the image to get its dimensions and set displayInfo
            const img = new Image();
            img.src = imgURL;
            img.crossOrigin = 'Anonymous'; // Allow cross-origin image loading if needed

            await new Promise((resolve, reject) => {
                img.onload = function () {
                    newImageObj.originalWidth = img.width;
                    newImageObj.originalHeight = img.height;

                    // Get the container dimensions
                    const container = document.getElementById('container');
                    const containerRect = container.getBoundingClientRect();

                    // Set canvas size to container size
                    canvas.width = containerRect.width;
                    canvas.height = containerRect.height;

                    // Calculate scale factors to fit the image within the canvas
                    const scaleX = containerRect.width / img.width;
                    const scaleY = containerRect.height / img.height;
                    const scaleFactor = Math.min(scaleX, scaleY);

                    // Calculate the new image dimensions
                    const imgWidth = img.width * scaleFactor;
                    const imgHeight = img.height * scaleFactor;

                    // Center the image
                    const imgX = (containerRect.width - imgWidth) / 2;
                    const imgY = (containerRect.height - imgHeight) / 2;

                    // Store these values for use in other functions
                    const currentDisplayInfo = {
                        img: img,
                        x: imgX,
                        y: imgY,
                        width: imgWidth,
                        height: imgHeight,
                        scaleFactor: scaleFactor,
                    };

                    // Save displayInfo in imageObj
                    newImageObj.displayInfo = { ...currentDisplayInfo };

                    console.log(`DisplayInfo set for image: ${newImageObj.name}`, newImageObj.displayInfo);

                    // Add thumbnail
                    addThumbnail(newImageObj, images.length - 1);

                    resolve();
                };
                img.onerror = function (err) {
                    console.error(`Failed to load imported image: ${imageName}`, err);
                    reject(err);
                };
            });
        });

        // Wait for all images to be loaded
        await Promise.all(imageLoadPromises);
        console.log("All images loaded and displayInfo set.");

        // Now process annotations
        // Extract and process .txt annotation files
        let annotationFiles = [];
        if (zip.folder("labels")) {
            zip.folder("labels").forEach(function(relativePath, file) {
                if (relativePath.endsWith(".txt")) {
                    annotationFiles.push(file);
                }
            });
        } else {
            zip.forEach(function(relativePath, file) {
                if (relativePath.endsWith(".txt")) {
                    annotationFiles.push(file);
                }
            });
        }

        if (annotationFiles.length === 0) {
            alert("No annotation .txt files found in the ZIP.");
            console.warn("No annotation .txt files found in the ZIP.");
            return;
        }

        // Assign class indices based on their order in the classes array
        const classIndices = {};
        classes.forEach((cls, index) => {
            classIndices[cls] = index;
        });

        for (const annotationFile of annotationFiles) {
            const txtContent = await annotationFile.async("string");
            // Extract the base image name without the folder path
            const imageName = annotationFile.name.split('/').pop().replace(".txt", "");
            console.log(`Processing annotation for image: ${imageName}`);

            // Find the corresponding image
            let imageObj = images.find(img => img.name.replace(/\.[^/.]+$/, "") === imageName);
            if (!imageObj) {
                console.warn(`Image corresponding to ${annotationFile.name} not found. Skipping this annotation.`);
                continue;
            }

            // Ensure displayInfo is available
            if (!imageObj.displayInfo) {
                console.warn(`Display info not found for image: ${imageObj.name}. Skipping annotation.`);
                continue;
            }

            // Parse annotation lines
            const lines = txtContent.split('\n').filter(line => line.trim() !== '');
            const annsForImage = lines.map(line => {
                const parts = line.trim().split(' ');
                if (parts.length !== 5) {
                    console.warn(`Invalid annotation format in file ${annotationFile.name}: ${line}`);
                    return null;
                }
                const clsIndex = parseInt(parts[0], 10);
                const x_center = parseFloat(parts[1]);
                const y_center = parseFloat(parts[2]);
                const width_norm = parseFloat(parts[3]);
                const height_norm = parseFloat(parts[4]);

                const className = dataYaml.names[clsIndex];
                if (!className) {
                    console.warn(`Class index ${clsIndex} not found in data.yaml. Skipping this annotation.`);
                    return null;
                }

                // Calculate xNorm and yNorm from x_center_norm and y_center_norm
                const xNorm = x_center - width_norm / 2;
                const yNorm = y_center - height_norm / 2;

                // Clamp normalized values to [0,1]
                const clamp = (num) => Math.min(Math.max(num, 0), 1);
                const clampedXNorm = clamp(xNorm);
                const clampedYNorm = clamp(yNorm);
                const clampedWidthNorm = clamp(width_norm);
                const clampedHeightNorm = clamp(height_norm);

                return {
                    id: annotationIdCounter++, // Assign unique global ID
                    class: className,
                    xNorm: clampedXNorm,
                    yNorm: clampedYNorm,
                    widthNorm: clampedWidthNorm,
                    heightNorm: clampedHeightNorm,
                    color: classColors[className],
                };
            }).filter(ann => ann !== null); // Remove any null entries

            // Assign annotations to the image
            annotationsData[imageObj.id] = annsForImage;
            console.log(`Imported ${annsForImage.length} annotations for image: ${imageObj.name}`);
        }

        // After importing, set the current image to the first one
        if (images.length > 0) {
            currentImageIndex = 0;
            loadImage(currentImageIndex);
            console.log("Import Annotations & Images: Annotations and images imported and session updated.");
        }

        alert("Annotations and images imported successfully.");
        hideDropZone();
    }
    catch (error) {
        alert("An error occurred while importing annotations and images.");
        console.error("Error importing annotations and images:", error);
    }
}

function updateProgress(processed, total, phasePercentage) {
    const imageProgress = (processed / total) * phasePercentage;
    exportProgress.value = imageProgress;
    exportProgressText.textContent = `${Math.round(imageProgress)}%`;
}

function setCanvasSize() {
    const container = document.getElementById('container');
    const containerRect = container.getBoundingClientRect();
    canvas.width = containerRect.width;
    canvas.height = containerRect.height;
}

function deleteImage(index) {
    const imageObj = images[index];
    if (!imageObj) {
        console.warn(`Image at index ${index} does not exist.`);
        return;
    }

    // Confirm deletion
    const confirmDelete = confirm(`Are you sure you want to delete the image "${imageObj.name}"?`);
    if (!confirmDelete) {
        return;
    }

    // Remove from images array
    images.splice(index, 1);

    // Remove from annotationsData
    delete annotationsData[imageObj.id];

    // Remove the thumbnail from the DOM using data-image-id
    const thumbnailsContainer = document.getElementById('thumbnailsContainer');
    const thumbWrappers = thumbnailsContainer.getElementsByClassName('thumbnail-wrapper');
    for (let thumb of thumbWrappers) {
        if (parseInt(thumb.dataset.imageId, 10) === imageObj.id) {
            thumbnailsContainer.removeChild(thumb);
            break;
        }
    }

    // Update image counters and navigation buttons
    updateImageCounter();
    updateNavigationButtons();

    // Adjust currentImageIndex
    if (currentImageIndex === index) {
        // If the deleted image was the current image
        if (images.length > 0) {
            // Load the previous image if exists, else the next one
            currentImageIndex = index > 0 ? index - 1 : 0;
            loadImage(currentImageIndex);
        } else {
            // No images left
            currentImageIndex = -1;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            updateImageCounter();
            updateNavigationButtons();
            redraw();
        }
    } else if (currentImageIndex > index) {
        // If a preceding image was deleted, adjust the currentImageIndex
        currentImageIndex--;
    }
}

function toNormalized(x, y) {
    return {
        x: (x - imageDisplayInfo.x) / imageDisplayInfo.width,
        y: (y - imageDisplayInfo.y) / imageDisplayInfo.height,
    };
}

function fromNormalized(xNorm, yNorm) {
    return {
        x: xNorm * imageDisplayInfo.width + imageDisplayInfo.x,
        y: yNorm * imageDisplayInfo.height + imageDisplayInfo.y,
    };
}

function toNormalizedSize(width, height) {
    return {
        width: width / imageDisplayInfo.width,
        height: height / imageDisplayInfo.height,
    };
}

function fromNormalizedSize(widthNorm, heightNorm) {
    return {
        width: widthNorm * imageDisplayInfo.width,
        height: heightNorm * imageDisplayInfo.height,
    };
}

function showWarning(message) {
    // Create the warning toast element
    const warningToast = document.createElement('div');
    warningToast.classList.add('warning-toast');
    warningToast.textContent = message;

    // Append the toast to the body
    document.body.appendChild(warningToast);

    // Automatically remove the toast after 3 seconds
    setTimeout(() => {
        warningToast.classList.add('fade-out');
        // Remove the element after the fade-out transition
        warningToast.addEventListener('transitionend', () => {
            warningToast.remove();
        });
    }, 3000);
}



// Call this function once during initialization
setCanvasSize();

window.addEventListener('resize', () => {
    setCanvasSize();
    if (currentImageIndex !== -1) {
        loadImage(currentImageIndex);
    }
});

// Ensure initial canvas sizing
document.addEventListener('DOMContentLoaded', () => {
    setCanvasSize();
    if (currentImageIndex !== -1) {
        loadImage(currentImageIndex);
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Delete' || e.key === 'Del') {
        if (selectedAnnotation) {
            deleteAnnotation(selectedAnnotation);
        }
    }
});

// Function to delete the selected annotation
function deleteAnnotation(annotation) {
    const imageObj = images[currentImageIndex];
    if (!imageObj) return;

    const annIndex = annotations.findIndex(ann => ann.id === annotation.id);
    if (annIndex !== -1) {
        annotations.splice(annIndex, 1);
        annotationsData[imageObj.id] = annotations;
        selectedAnnotation = null;
        saveAnnotations();
        redraw();
        console.log(`Annotation ID ${annotation.id} deleted.`);
    } else {
        console.warn(`Annotation ID ${annotation.id} not found.`);
    }
}

// Initialize with no classes
updateClassList();
updateStatus()