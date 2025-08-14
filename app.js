// Global variables
let currentPage = 'menu';
let simplePairCount = 0;
let itemCount = 0;
let pairCounts = {};
let calculationHistory = [];

// Auto-save configuration
const AUTOSAVE_KEY = 'calculator_autosave';
const HISTORY_KEY = 'calculator_history';
const MAX_HISTORY = 5;

// DOM cache for better performance
const domCache = {
    simplePairs: null,
    itemSections: null,
    simpleResults: null,
    complexResults: null,
    init() {
        this.simplePairs = document.getElementById('simplePairs');
        this.itemSections = document.getElementById('itemSections');
        this.simpleResults = document.getElementById('simpleResults');
        this.complexResults = document.getElementById('complexResults');
    }
};

// Auto-save state management
let autoSaveState = {
    timeout: null,
    isScheduled: false,
    lastSave: 0,
    isSaving: false
};

// Enhanced mobile detection
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           window.innerWidth <= 768;
}

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isAndroid() {
    return /Android/i.test(navigator.userAgent);
}

// Enhanced input validation for quantities (integers only)
function validateQuantityInput(input) {
    if (!input) return;
    
    const cursorPosition = input.selectionStart;
    const originalValue = input.value;
    let value = originalValue;

    // Remove negative signs
    value = value.replace(/-/g, '');

    // Check for decimal attempts and show mobile-friendly warning
    if (originalValue.includes('.') || originalValue.includes(',')) {
        showNotification('Quantities must be whole numbers only', 'error');
        value = originalValue.replace(/[.,].*/, '');
        input.value = value;
        
        // Mobile-friendly cursor positioning
        setTimeout(() => {
            const newPosition = value.length;
            input.setSelectionRange(newPosition, newPosition);
        }, 10);
        return;
    }

    // Remove any non-digit characters
    value = value.replace(/[^\d]/g, '');

    // Limit to reasonable length for mobile display
    if (value.length > 8) {
        value = value.substring(0, 8);
        showNotification('Maximum 8 digits allowed', 'error');
    }

    if (value !== originalValue) {
        input.value = value;
        
        // Better cursor positioning for mobile
        setTimeout(() => {
            let removedBeforeCursor = 0;
            for (let i = 0; i < cursorPosition && i < originalValue.length; i++) {
                if (!/\d/.test(originalValue[i])) {
                    removedBeforeCursor++;
                }
            }
            const newPosition = Math.max(0, Math.min(value.length, cursorPosition - removedBeforeCursor));
            input.setSelectionRange(newPosition, newPosition);
        }, 10);
    }
}

// Enhanced input validation for weights (allow 1 decimal place)
function validateWeightInput(input) {
    if (!input) return;
    
    const cursorPosition = input.selectionStart;
    const originalValue = input.value;
    let value = originalValue;

    // Remove negative signs
    value = value.replace(/-/g, '');

    // Remove any non-digit characters except decimal point
    value = value.replace(/[^\d.]/g, '');

    // Handle multiple decimal points
    const parts = value.split('.');
    if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
    }

    // Handle leading decimal point
    if (value.startsWith('.')) {
        value = '0' + value;
    }

    // Limit to 1 decimal place
    if (parts.length === 2 && parts[1].length > 1) {
        value = parts[0] + '.' + parts[1].substring(0, 1);
    }

    // Limit total length for mobile display
    if (value.length > 10) {
        value = value.substring(0, 10);
        showNotification('Maximum 10 characters allowed', 'error');
    }

    if (value !== originalValue) {
        input.value = value;
        
        // Mobile-optimized cursor positioning
        setTimeout(() => {
            let removedBeforeCursor = 0;
            const originalChars = originalValue.split('');
            const newChars = value.split('');
            let newIndex = 0;

            for (let i = 0; i < cursorPosition && i < originalChars.length; i++) {
                if (newIndex < newChars.length && originalChars[i] === newChars[newIndex]) {
                    newIndex++;
                } else {
                    removedBeforeCursor++;
                }
            }

            const newPosition = Math.max(0, Math.min(value.length, cursorPosition - removedBeforeCursor));
            input.setSelectionRange(newPosition, newPosition);
        }, 10);
    }
}

// Enhanced mobile-friendly keydown handlers
function handleQuantityKeydown(event) {
    const allowedKeys = [8, 9, 27, 13, 46, 37, 38, 39, 40];
    if (allowedKeys.includes(event.keyCode) ||
        (event.ctrlKey && [65, 67, 86, 88, 90].includes(event.keyCode))) {
        return;
    }

    // Prevent decimal point entry
    if (event.keyCode === 190 || event.keyCode === 110 || event.key === '.') {
        event.preventDefault();
        navigator.vibrate && navigator.vibrate(50);
        return;
    }

    // Only allow numbers
    if ((event.shiftKey || (event.keyCode < 48 || event.keyCode > 57)) && 
        (event.keyCode < 96 || event.keyCode > 105)) {
        event.preventDefault();
        navigator.vibrate && navigator.vibrate(50);
        return;
    }
}

function handleWeightKeydown(event) {
    const allowedKeys = [8, 9, 27, 13, 46, 37, 38, 39, 40];
    if (allowedKeys.includes(event.keyCode) ||
        (event.ctrlKey && [65, 67, 86, 88, 90].includes(event.keyCode))) {
        return;
    }

    // Handle decimal point
    if ((event.key === '.' || event.keyCode === 190 || event.keyCode === 110) && 
        event.target.value.indexOf('.') !== -1) {
        event.preventDefault();
        navigator.vibrate && navigator.vibrate(50);
        return;
    }

    // Only allow numbers and decimal point
    if ((event.shiftKey || (event.keyCode < 48 || event.keyCode > 57)) && 
        (event.keyCode < 96 || event.keyCode > 105) && 
        event.keyCode !== 190 && event.keyCode !== 110) {
        event.preventDefault();
        navigator.vibrate && navigator.vibrate(50);
        return;
    }

    // Limit decimal places to 1
    const currentValue = event.target.value;
    const decimalIndex = currentValue.indexOf('.');
    if (decimalIndex !== -1 && currentValue.length - decimalIndex > 1 && 
        event.target.selectionStart > decimalIndex && 
        !allowedKeys.includes(event.keyCode)) {
        event.preventDefault();
        navigator.vibrate && navigator.vibrate(50);
        return;
    }
}

// Enhanced mobile focus handling with iOS optimization
function focusInputSafely(input, delay = 150) {
    if (!input) return;

    // For desktop, just focus normally
    if (!isMobile()) {
        input.focus();
        return;
    }

    // Ensure element exists and is visible
    if (!document.contains(input)) return;

    // iOS requires user interaction to open keyboard
    if (isIOS()) {
        setTimeout(() => {
            try {
                input.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'nearest'
                });

                input.focus();
                input.click();
                
                // Set cursor to end
                const length = input.value.length;
                input.setSelectionRange(length, length);
                
            } catch (error) {
                console.warn('iOS focus error:', error);
                input.focus();
            }
        }, 50);
    } else {
        // Android and other mobile browsers
        setTimeout(() => {
            try {
                input.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'nearest'
                });
                
                setTimeout(() => {
                    input.focus();
                    
                    // Set cursor to end
                    const length = input.value.length;
                    input.setSelectionRange(length, length);
                    
                    // Haptic feedback
                    navigator.vibrate && navigator.vibrate(25);
                }, 100);
            } catch (error) {
                console.warn('Focus error:', error);
            }
        }, delay);
    }
}

// iOS-specific keyboard handling
function handleIOSKeyboardBehavior(input) {
    if (!isIOS()) return;
    
    input.addEventListener('touchstart', function(e) {
        setTimeout(() => {
            this.focus();
        }, 10);
    });
    
    input.addEventListener('keydown', function(e) {
        if (e.keyCode === 9) {
            e.preventDefault();
            handleIOSNavigation(this);
        }
    });
}

// iOS-specific navigation handler
function handleIOSNavigation(currentInput) {
    const inputId = currentInput.id;
    
    if (inputId.includes('simpleNum1-')) {
        const pairId = inputId.split('-')[1];
        const nextInput = document.getElementById(`simpleNum2-${pairId}`);
        if (nextInput) {
            focusInputSafely(nextInput, 50);
        }
    } else if (inputId.includes('simpleNum2-')) {
        addSimpleNumberPair();
    } else if (inputId.includes('num1-')) {
        const parts = inputId.split('-');
        const itemId = parts[1];
        const pairId = parts[2];
        const nextInput = document.getElementById(`num2-${itemId}-${pairId}`);
        if (nextInput) {
            focusInputSafely(nextInput, 50);
        }
    } else if (inputId.includes('num2-')) {
        const parts = inputId.split('-');
        const itemId = parts[1];
        addNumberPair(itemId);
    }
}

// iOS keyboard detection and handling
function setupIOSKeyboardHandling() {
    if (!isIOS()) return;
    
    document.addEventListener('input', function(e) {
        if (e.target.matches('input[type="number"]')) {
            const input = e.target;
            const value = input.value;
            
            if (input.id.includes('Num1') || input.id.includes('num1')) {
                if (value && parseInt(value) > 0) {
                    showIOSNavigationHint(input);
                }
            }
        }
    });
    
    document.addEventListener('blur', function(e) {
        if (e.target.matches('input[type="number"]') && isIOS()) {
            setTimeout(() => {
                const activeElement = document.activeElement;
                if (activeElement === document.body || activeElement === document.documentElement) {
                    handleIOSAutoAdvance(e.target);
                }
            }, 100);
        }
    });
}

function showIOSNavigationHint(input) {
    const existingHint = input.parentNode.querySelector('.ios-hint');
    if (existingHint) existingHint.remove();
    
    const hint = document.createElement('div');
    hint.className = 'ios-hint';
    hint.innerHTML = `
        <small style="color: #007AFF; font-size: 12px; margin-top: 4px; display: block;">
            📱 Tap "Next" or "Done" to continue
        </small>
    `;
    
    input.parentNode.appendChild(hint);
    
    setTimeout(() => {
        if (hint && hint.parentNode) {
            hint.parentNode.removeChild(hint);
        }
    }, 3000);
}

function handleIOSAutoAdvance(input) {
    const inputId = input.id;
    const value = input.value.trim();
    
    if (!value) return;
    
    if (inputId.includes('simpleNum1-') || inputId.includes('num1-')) {
        handleIOSNavigation(input);
    } else if (inputId.includes('simpleNum2-') || inputId.includes('num2-')) {
        showIOSNewPairOption(input);
    }
}

function showIOSNewPairOption(input) {
    const existingOption = document.querySelector('.ios-new-pair-option');
    if (existingOption) existingOption.remove();
    
    const option = document.createElement('div');
    option.className = 'ios-new-pair-option';
    option.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #007AFF;
        color: white;
        border-radius: 50%;
        width: 60px;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 122, 255, 0.4);
        z-index: 1000;
        animation: bounceIn 0.3s ease;
        touch-action: manipulation;
    `;
    option.innerHTML = '➕';
    option.title = 'Add new pair';
    
    option.addEventListener('click', function() {
        const inputId = input.id;
        if (inputId.includes('simple')) {
            addSimpleNumberPair();
        } else {
            const parts = inputId.split('-');
            const itemId = parts[1];
            addNumberPair(itemId);
        }
        
        this.remove();
        navigator.vibrate && navigator.vibrate([50, 50, 50]);
    });
    
    document.body.appendChild(option);
    
    setTimeout(() => {
        if (option && option.parentNode) {
            option.remove();
        }
    }, 5000);
}

// Enhanced mobile notification system
function showNotification(message, type = 'info', duration = 3000) {
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 10px;
        right: 10px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        opacity: 0;
        transform: translateY(-20px);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        font-size: 14px;
        text-align: center;
    `;

    switch (type) {
        case 'success':
            notification.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
            break;
        case 'error':
            notification.style.background = 'linear-gradient(135deg, #f44336, #d32f2f)';
            break;
        default:
            notification.style.background = 'linear-gradient(135deg, #2196F3, #1976D2)';
    }

    notification.textContent = message;
    document.body.appendChild(notification);

    requestAnimationFrame(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    });

    if (type === 'error' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
    } else if (navigator.vibrate) {
        navigator.vibrate(50);
    }

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, duration);
}

// Navigation functions
function showPage(pageId) {
    try {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        const targetPage = document.getElementById(pageId + 'Page');
        if (targetPage) {
            targetPage.classList.add('active');
            currentPage = pageId;

            if (pageId === 'complex') {
                document.body.style.paddingBottom = '100px';
            } else {
                document.body.style.paddingBottom = '20px';
            }

            window.scrollTo(0, 0);
        }
    } catch (error) {
        console.error('Error showing page:', error);
    }
}

function goToMenu() {
    showPage('menu');
    const passwordSection = document.getElementById('passwordSection');
    const passwordInput = document.getElementById('passwordInput');
    const errorMessage = document.getElementById('errorMessage');
    
    if (passwordSection) passwordSection.style.display = 'none';
    if (passwordInput) passwordInput.value = '';
    if (errorMessage) errorMessage.textContent = '';
}

function goToSimple() {
    showPage('simple');
    if (simplePairCount === 0) {
        setTimeout(() => addSimpleNumberPair(), 100);
    }
}

function showPasswordInput() {
    const passwordSection = document.getElementById('passwordSection');
    const passwordInput = document.getElementById('passwordInput');
    
    if (passwordSection) {
        passwordSection.style.display = 'block';
        setTimeout(() => focusInputSafely(passwordInput, 200), 100);
    }
}

function handlePasswordEnter(event) {
    if (event.key === 'Enter') {
        checkPassword();
    }
}

function checkPassword() {
    const passwordInput = document.getElementById('passwordInput');
    const errorDiv = document.getElementById('errorMessage');
    const password = passwordInput?.value || '';

    if (password === '1625') {
        showPage('complex');
        setTimeout(() => {
            const newItemSelect = document.getElementById('newItemName');
            if (newItemSelect) focusInputSafely(newItemSelect, 300);
        }, 500);
    } else {
        if (errorDiv) errorDiv.textContent = 'Incorrect password. Please try again.';
        if (passwordInput) {
            passwordInput.value = '';
            focusInputSafely(passwordInput, 100);
        }
        navigator.vibrate && navigator.vibrate([100, 50, 100]);
    }
}

// Simple Calculator Functions
function addSimpleNumberPair() {
    simplePairCount++;
    const container = domCache.simplePairs || document.getElementById('simplePairs');
    if (!container) return;

    const pairDiv = document.createElement('div');
    pairDiv.className = 'pair-container';
    pairDiv.id = `simplePair-${simplePairCount}`;
    pairDiv.innerHTML = `
        <div class="pair-header">
            <h4>Pair ${simplePairCount}</h4>
            <button class="remove-btn" onclick="removeSimplePair(${simplePairCount})" type="button">Remove</button>
        </div>
        <div class="number-inputs">
            <div class="input-group">
                <label for="simpleNum1-${simplePairCount}">Quantity:</label>
                <input type="number" 
                       id="simpleNum1-${simplePairCount}" 
                       step="1" 
                       min="0" 
                       inputmode="numeric"
                       placeholder="Enter quantity" 
                       autocomplete="off"
                       oninput="validateQuantityInput(this)"
                       onkeydown="handleQuantityKeydown(event); handleSimpleEnterKey(event, ${simplePairCount}, 1)">
            </div>
            <div class="input-group">
                <label for="simpleNum2-${simplePairCount}">Weight:</label>
                <input type="number" 
                       id="simpleNum2-${simplePairCount}" 
                       step="0.1" 
                       inputmode="decimal"
                       placeholder="Enter weight" 
                       autocomplete="off"
                       oninput="validateWeightInput(this)"
                       onkeydown="handleWeightKeydown(event); handleSimpleEnterKey(event, ${simplePairCount}, 2)">
            </div>
        </div>
    `;
    container.appendChild(pairDiv);

    const quantityInput = document.getElementById(`simpleNum1-${simplePairCount}`);
    const weightInput = document.getElementById(`simpleNum2-${simplePairCount}`);

    if (isIOS()) {
        handleIOSKeyboardBehavior(quantityInput);
        handleIOSKeyboardBehavior(weightInput);
        quantityInput.focus();
        quantityInput.click();
    } else {
        focusInputSafely(quantityInput, 100);
    }
}

function removeSimplePair(pairId) {
    try {
        const pair = document.getElementById(`simplePair-${pairId}`);
        if (pair) {
            const inputs = pair.querySelectorAll('input');
            inputs.forEach(input => {
                input.oninput = null;
                input.onkeydown = null;
            });
            
            pair.remove();
            navigator.vibrate && navigator.vibrate(50);
        }
    } catch (error) {
        console.error('Error removing simple pair:', error);
    }
}

function handleSimpleEnterKey(event, currentPair, currentField) {
    if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault();

        let nextInput = null;

        if (currentField === 1) {
            nextInput = document.getElementById(`simpleNum2-${currentPair}`);
        } else if (currentField === 2) {
            addSimpleNumberPair();
            nextInput = document.getElementById(`simpleNum1-${simplePairCount}`);
        }

        if (nextInput) {
            focusInputSafely(nextInput, isIOS() ? 100 : 50);
        }
    } else if (isIOS() && event.keyCode === 9) {
        event.preventDefault();
        handleIOSNavigation(event.target);
    }
}

function calculateSimple() {
    try {
        let totalQuantity = 0;
        let totalWeight = 0;
        let hasData = false;

        const pairs = document.querySelectorAll('#simplePairs .pair-container');
        pairs.forEach(pair => {
            const pairId = pair.id.split('-')[1];
            const num1Input = document.getElementById(`simpleNum1-${pairId}`);
            const num2Input = document.getElementById(`simpleNum2-${pairId}`);

            if (num1Input?.value) {
                const qty = parseInt(num1Input.value) || 0;
                totalQuantity += qty;
                hasData = true;
            }
            if (num2Input?.value) {
                totalWeight += parseFloat(num2Input.value) || 0;
                hasData = true;
            }
        });

        if (hasData) {
            const formattedQuantity = totalQuantity.toString();
            const formattedWeight = totalWeight % 1 === 0 ? 
                totalWeight.toString() : 
                totalWeight.toFixed(1);

            const totalQtyEl = document.getElementById('simpleTotalQuantity');
            const totalWeightEl = document.getElementById('simpleTotalWeight');
            
            if (totalQtyEl) totalQtyEl.textContent = formattedQuantity;
            if (totalWeightEl) totalWeightEl.textContent = formattedWeight;
            
            if (domCache.simpleResults) {
                domCache.simpleResults.style.display = 'block';
                domCache.simpleResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }

            showNotification('Calculation completed!', 'success');
        } else {
            showNotification('Please add some data before calculating', 'error');
        }
    } catch (error) {
        console.error('Simple calculation error:', error);
        showNotification('Calculation error occurred', 'error');
    }
}

function resetSimple(skipConfirm = false) {
    try {
        const hasPairs = document.querySelectorAll('#simplePairs .pair-container').length > 0;
        
        if (!skipConfirm && hasPairs) {
            if (!confirm('This will clear all your current data. Are you sure?')) {
                return;
            }
        }

        if (domCache.simplePairs) domCache.simplePairs.innerHTML = '';
        if (domCache.simpleResults) domCache.simpleResults.style.display = 'none';
        
        simplePairCount = 0;
        setTimeout(() => addSimpleNumberPair(), 100);
        showNotification('Simple calculator reset', 'info');
    } catch (error) {
        console.error('Reset simple error:', error);
    }
}

// Complex Calculator Functions
function createItemSection(itemId, itemName) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'item-section';
    itemDiv.id = itemId;
    itemDiv.innerHTML = `
        <div class="item-header">
            <div class="item-title">${itemName}</div>
            <button class="remove-btn" onclick="removeItem('${itemId}')" type="button">Remove Item</button>
        </div>
        <div id="pairs-${itemId}"></div>
        <button class="add-btn" onclick="addNumberPair('${itemId}')" type="button">+ Add Number Pair</button>
    `;
    return itemDiv;
}

function addNewItem() {
    try {
        const dropdown = document.getElementById('newItemName');
        const customInput = document.getElementById('customItemName');
        const periodSelect = document.getElementById('periodSelect');
        
        let itemName = '';

        if (dropdown?.value === 'custom') {
            itemName = customInput?.value?.trim() || '';
        } else {
            itemName = dropdown?.value?.trim() || '';
        }

        if (!itemName) {
            showNotification('Please select or enter an item name', 'error');
            focusInputSafely(dropdown?.value === 'custom' ? customInput : dropdown, 100);
            return;
        }

        const period = periodSelect?.value || 'Pre-Historic';
        itemName = `${period} ${itemName}`;

        itemCount++;
        const itemId = `item-${itemCount}`;
        pairCounts[itemId] = 0;

        const container = domCache.itemSections || document.getElementById('itemSections');
        if (container) {
            const itemDiv = createItemSection(itemId, itemName);
            container.appendChild(itemDiv);
        }

        if (dropdown) dropdown.value = '';
        if (customInput) {
            customInput.value = '';
            customInput.style.display = 'none';
        }

        setTimeout(() => {
            addNumberPair(itemId);
            showNotification('Item added successfully', 'success');
        }, 100);
        
    } catch (error) {
        console.error('Error adding new item:', error);
        showNotification('Error adding item', 'error');
    }
}

function removeItem(itemId) {
    try {
        const item = document.getElementById(itemId);
        if (item) {
            const inputs = item.querySelectorAll('input');
            inputs.forEach(input => {
                input.onInput = null;
                input.onkeydown = null;
            });
            
            item.remove();
            delete pairCounts[itemId];
            navigator.vibrate && navigator.vibrate(50);
        }
    } catch (error) {
        console.error('Error removing item:', error);
    }
}

function handleDropdownChange() {
    const dropdown = document.getElementById('newItemName');
    const customInput = document.getElementById('customItemName');

    if (dropdown?.value === 'custom') {
        if (customInput) {
            customInput.style.display = 'block';
            focusInputSafely(customInput, 100);
        }
    } else {
        if (customInput) {
            customInput.style.display = 'none';
            customInput.value = '';
        }
    }
}

function handleNewItemEnter(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addNewItem();
    }
}

function addNumberPair(itemId) {
    try {
        if (!pairCounts[itemId]) pairCounts[itemId] = 0;
        
        pairCounts[itemId]++;
        const pairId = pairCounts[itemId];
        const container = document.getElementById(`pairs-${itemId}`);
        
        if (!container) return;

        const pairDiv = document.createElement('div');
        pairDiv.className = 'pair-container';
        pairDiv.id = `pair-${itemId}-${pairId}`;
        pairDiv.innerHTML = `
            <div class="pair-header">
                <h4>Pair ${pairId}</h4>
                <button class="remove-btn" onclick="removePair('${itemId}', ${pairId})" type="button">Remove</button>
            </div>
            <div class="number-inputs">
                <div class="input-group">
                    <label for="num1-${itemId}-${pairId}">Quantity:</label>
                    <input type="number" 
                           id="num1-${itemId}-${pairId}" 
                           step="1" 
                           min="0" 
                           inputmode="numeric"
                           placeholder="Enter quantity" 
                           autocomplete="off"
                           oninput="validateQuantityInput(this)"
                           onkeydown="handleQuantityKeydown(event); handleEnterKey(event, '${itemId}', ${pairId}, 1)">
                </div>
                <div class="input-group">
                    <label for="num2-${itemId}-${pairId}">Weight:</label>
                    <input type="number" 
                           id="num2-${itemId}-${pairId}" 
                           step="0.1" 
                           inputmode="decimal"
                           placeholder="Enter weight" 
                           autocomplete="off"
                           oninput="validateWeightInput(this)"
                           onkeydown="handleWeightKeydown(event); handleEnterKey(event, '${itemId}', ${pairId}, 2)">
                </div>
            </div>
        `;
        container.appendChild(pairDiv);

        const quantityInput = document.getElementById(`num1-${itemId}-${pairId}`);
        const weightInput = document.getElementById(`num2-${itemId}-${pairId}`);

        if (isIOS()) {
            handleIOSKeyboardBehavior(quantityInput);
            handleIOSKeyboardBehavior(weightInput);
            quantityInput.focus();
            quantityInput.click();
        } else {
            focusInputSafely(quantityInput, 100);
        }
    } catch (error) {
        console.error('Error adding number pair:', error);
    }
}

function removePair(itemId, pairId) {
    try {
        const pair = document.getElementById(`pair-${itemId}-${pairId}`);
        if (pair) {
            const inputs = pair.querySelectorAll('input');
            inputs.forEach(input => {
                input.onInput = null;
                input.onkeydown = null;
            });
            
            pair.remove();
            navigator.vibrate && navigator.vibrate(50);
        }
    } catch (error) {
        console.error('Error removing pair:', error);
    }
}

function handleEnterKey(event, itemId, currentPair, currentField) {
    if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault();

        let nextInput = null;

        if (currentField === 1) {
            nextInput = document.getElementById(`num2-${itemId}-${currentPair}`);
        } else if (currentField === 2) {
            addNumberPair(itemId);
            nextInput = document.getElementById(`num1-${itemId}-${pairCounts[itemId]}`);
        }

        if (nextInput) {
            focusInputSafely(nextInput, isIOS() ? 100 : 50);
        }
    } else if (isIOS() && event.keyCode === 9) {
        event.preventDefault();
        handleIOSNavigation(event.target);
    }
}

function calculateAll() {
    try {
        const results = [];
        let hasData = false;

        document.querySelectorAll('.item-section').forEach(itemSection => {
            const itemId = itemSection.id;
            const itemNameEl = itemSection.querySelector('.item-title');
            const itemName = itemNameEl?.textContent || '';
            let totalQuantity = 0;
            let totalWeight = 0;
            let itemHasData = false;

            for (let i = 1; i <= (pairCounts[itemId] || 0); i++) {
                const num1Input = document.getElementById(`num1-${itemId}-${i}`);
                const num2Input = document.getElementById(`num2-${itemId}-${i}`);

                if (num1Input?.value) {
                    const qty = parseInt(num1Input.value) || 0;
                    totalQuantity += qty;
                    itemHasData = true;
                    hasData = true;
                }
                if (num2Input?.value) {
                    totalWeight += parseFloat(num2Input.value) || 0;
                    itemHasData = true;
                    hasData = true;
                }
            }

            if (itemHasData) {
                const formattedWeight = totalWeight % 1 === 0 ? 
                    totalWeight : 
                    Math.round(totalWeight * 10) / 10;

                results.push({
                    name: itemName,
                    quantity: totalQuantity,
                    weight: formattedWeight
                });
            }
        });

        if (results.length > 0) {
            const resultsGrid = document.getElementById('complexResultsGrid');
            if (resultsGrid) {
                resultsGrid.innerHTML = results.map(result => `
                    <div class="item-result">
                        <h4>${result.name}</h4>
                        <div class="result-item">Quantity: ${result.quantity}</div>
                        <div class="result-item">Weight: ${result.weight % 1 === 0 ? result.weight.toString() : result.weight.toFixed(1)}</div>
                    </div>
                `).join('');
            }

            if (domCache.complexResults) {
                domCache.complexResults.style.display = 'block';
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            showNotification('Calculation completed!', 'success');
        } else {
            showNotification('Please add some data before calculating', 'error');
        }
    } catch (error) {
        console.error('Calculate all error:', error);
        showNotification('Calculation error occurred', 'error');
    }
}

function resetAll(skipConfirm = true) {
    try {
        const hasItems = document.querySelectorAll('.item-section').length > 0;
        
        if (!skipConfirm && hasItems) {
            if (!confirm('This will clear all your current data. Are you sure?')) {
                return;
            }
        }

        if (domCache.itemSections) domCache.itemSections.innerHTML = '';
        if (domCache.complexResults) domCache.complexResults.style.display = 'none';
        
        itemCount = 0;
        pairCounts = {};
        
        const newItemName = document.getElementById('newItemName');
        const customItemName = document.getElementById('customItemName');
        
        if (newItemName) newItemName.value = '';
        if (customItemName) {
            customItemName.value = '';
            customItemName.style.display = 'none';
        }

        showNotification('Complex calculator reset', 'info');
    } catch (error) {
        console.error('Reset all error:', error);
    }
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', function() {
    try {
        // Initialize DOM cache
        domCache.init();
        
        // Show menu page
        showPage('menu');

        // Setup iOS-specific keyboard handling
        if (isIOS()) {
            setupIOSKeyboardHandling();
            
            // Add iOS-specific styles
            const style = document.createElement('style');
            style.textContent = `
                @keyframes bounceIn {
                    0% { transform: scale(0.3); opacity: 0; }
                    50% { transform: scale(1.05); }
                    70% { transform: scale(0.9); }
                    100% { transform: scale(1); opacity: 1; }
                }
                
                .ios-hint {
                    animation: fadeIn 0.3s ease;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                input[type="number"] {
                    font-size: 16px !important;
                    -webkit-appearance: none;
                    border-radius: 8px;
                }
                
                input[type="number"]:focus {
                    -webkit-user-select: text;
                    user-select: text;
                }
                
                .ios-new-pair-option {
                    animation: bounceIn 0.3s ease !important;
                }
            `;
            document.head.appendChild(style);
        }

        // Add mobile-specific event listeners
        if (isMobile()) {
            window.addEventListener('orientationchange', () => {
                setTimeout(() => {
                    window.scrollTo(0, 0);
                    const activeElement = document.activeElement;
                    if (activeElement && activeElement.matches('input')) {
                        activeElement.blur();
                        setTimeout(() => focusInputSafely(activeElement, 100), 200);
                    }
                }, 500);
            });

            let lastTouchEnd = 0;
            document.addEventListener('touchend', (event) => {
                const now = Date.now();
                if (now - lastTouchEnd <= 300) {
                    if (event.target.matches('input, button, select')) {
                        event.preventDefault();
                    }
                }
                lastTouchEnd = now;
            }, false);

            if (isIOS()) {
                document.addEventListener('touchstart', function(e) {
                    if (e.target.matches('input[type="number"]')) {
                        document.querySelectorAll('.ios-hint, .ios-new-pair-option').forEach(el => el.remove());
                    }
                });

                document.addEventListener('keydown', function(e) {
                    if (e.keyCode === 9 && e.target.matches('input[type="number"]')) {
                        e.preventDefault();
                        handleIOSNavigation(e.target);
                    }
                });
            }
        }

        console.log('Calculator app initialized successfully');
        
    } catch (error) {
        console.error('Initialization error:', error);
        showNotification('App initialization error', 'error');
    }
});
