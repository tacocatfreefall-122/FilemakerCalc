// Global variables
let currentPage = 'menu';
let simplePairCount = 0;
let itemCount = 0;
let pairCounts = {};
let calculationHistory = [];

// Auto-save configuration
const AUTOSAVE_KEY = 'calculator_autosave';
const HISTORY_KEY = 'calculator_history';
const MAX_HISTORY = 2;

// Helper function to detect mobile devices
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Helper function to detect iOS specifically
function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

// Input validation functions for quantities (integers only)
function validateQuantityInput(input) {
    const cursorPosition = input.selectionStart;
    const originalValue = input.value;
    let value = originalValue;

    // Check if user is trying to enter a decimal point
    if (originalValue.includes('.') || originalValue.includes(',')) {
        showNotification('Quantities must be whole numbers only. Decimals are not allowed.', 'error');
        // Remove the decimal and any digits after it
        value = originalValue.replace(/[.,].*/, '');
        input.value = value;
        
        // Set cursor to end of the cleaned value
        const newPosition = value.length;
        input.setSelectionRange(newPosition, newPosition);
        return;
    }

    // Remove any non-digit characters (no decimal points allowed for quantities)
    value = value.replace(/[^\d]/g, '');

    // Only update if the value actually changed
    if (value !== originalValue) {
        input.value = value;
        
        // Calculate how many characters were removed before the cursor
        let removedBeforeCursor = 0;
        for (let i = 0; i < cursorPosition && i < originalValue.length; i++) {
            if (!/\d/.test(originalValue[i])) {
                removedBeforeCursor++;
            }
        }
        
        // Set new cursor position
        const newPosition = Math.max(0, cursorPosition - removedBeforeCursor);
        input.setSelectionRange(newPosition, newPosition);
    }
}

// Input validation functions for weights (allow 1 decimal place)
function validateWeightInput(input) {
    const cursorPosition = input.selectionStart;
    const originalValue = input.value;
    let value = originalValue;

    // Remove any non-digit characters except decimal point
    value = value.replace(/[^\d.]/g, '');

    // Remove extra decimal points (keep only the first one)
    const parts = value.split('.');
    if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
    }

    // Limit to 1 decimal place
    if (parts.length === 2 && parts[1].length > 1) {
        value = parts[0] + '.' + parts[1].substring(0, 1);
    }

    // Only update if the value actually changed
    if (value !== originalValue) {
        input.value = value;
        
        // Calculate how many characters were removed before the cursor
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
        
        // Set new cursor position
        const newPosition = Math.max(0, cursorPosition - removedBeforeCursor);
        input.setSelectionRange(newPosition, newPosition);
    }
}

function handleQuantityKeydown(event) {
    const input = event.target;
    
    // Allow: backspace, delete, tab, escape, enter
    if ([8, 9, 27, 13, 46].indexOf(event.keyCode) !== -1 ||
        // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        (event.ctrlKey === true && [65, 67, 86, 88].indexOf(event.keyCode) !== -1)) {
        return;
    }
    
    // Ensure that it is a number only (no decimal points for quantities)
    if ((event.shiftKey || (event.keyCode < 48 || event.keyCode > 57)) && 
        (event.keyCode < 96 || event.keyCode > 105)) {
        event.preventDefault();
        return;
    }
}

function handleWeightKeydown(event) {
    const input = event.target;
    const key = event.key;
    
    // Allow: backspace, delete, tab, escape, enter
    if ([8, 9, 27, 13, 46].indexOf(event.keyCode) !== -1 ||
        // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        (event.ctrlKey === true && [65, 67, 86, 88].indexOf(event.keyCode) !== -1)) {
        return;
    }
    
    // Ensure that it is a number or decimal point and stop the keypress
    if ((event.shiftKey || (event.keyCode < 48 || event.keyCode > 57)) && 
        (event.keyCode < 96 || event.keyCode > 105) && 
        event.keyCode !== 190 && event.keyCode !== 110) {
        event.preventDefault();
        return;
    }
    
    // Only allow one decimal point
    if ((key === '.' || event.keyCode === 190 || event.keyCode === 110) && input.value.indexOf('.') !== -1) {
        event.preventDefault();
        return;
    }
    
    // Limit decimal places to 1
    const currentValue = input.value;
    const decimalIndex = currentValue.indexOf('.');
    if (decimalIndex !== -1 && currentValue.length - decimalIndex > 1 && 
        input.selectionStart > decimalIndex) {
        event.preventDefault();
        return;
    }
}

// Better mobile focus handling
function focusInputSafely(input, delay = 100) {
    if (!input) return;
    
    setTimeout(() => {
        input.focus();
        
        // For iOS, we need to trigger the keyboard differently
        if (isIOS()) {
            input.click();
            // Scroll the input into view
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        // Set cursor to end of input
        const length = input.value.length;
        input.setSelectionRange(length, length);
    }, delay);
}

// Auto-save functions
function saveToLocalStorage() {
    try {
        const appState = {
            currentPage,
            simplePairCount,
            itemCount,
            pairCounts,
            timestamp: new Date().toISOString(),
            // Save simple calculator data
            simplePairs: getSimplePairsData(),
            // Save complex calculator data
            complexItems: getComplexItemsData(),
            periodSelect: document.getElementById('periodSelect')?.value || 'Pre-Historic'
        };
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(appState));
        console.log('Data auto-saved successfully');
    } catch (error) {
        console.error('Failed to save data:', error);
    }
}

function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem(AUTOSAVE_KEY);
        if (saved) {
            const appState = JSON.parse(saved);
            
            // Show recovery notification
            const lastSave = new Date(appState.timestamp);
            if (confirm(`Found saved data from ${lastSave.toLocaleString()}. Would you like to restore it?`)) {
                restoreAppState(appState);
                return true;
            }
        }
    } catch (error) {
        console.error('Failed to load saved data:', error);
    }
    return false;
}

function getSimplePairsData() {
    const pairs = [];
    document.querySelectorAll('#simplePairs .pair-container').forEach(pair => {
        const pairId = pair.id.split('-')[1];
        const quantity = document.getElementById(`simpleNum1-${pairId}`)?.value || '';
        const weight = document.getElementById(`simpleNum2-${pairId}`)?.value || '';
        if (quantity || weight) {
            pairs.push({ id: pairId, quantity, weight });
        }
    });
    return pairs;
}

function getComplexItemsData() {
    const items = [];
    document.querySelectorAll('.item-section').forEach(itemSection => {
        const itemId = itemSection.id;
        const itemName = itemSection.querySelector('.item-title')?.textContent || '';
        const pairs = [];
        
        for (let i = 1; i <= (pairCounts[itemId] || 0); i++) {
            const quantity = document.getElementById(`num1-${itemId}-${i}`)?.value || '';
            const weight = document.getElementById(`num2-${itemId}-${i}`)?.value || '';
            if (quantity || weight) {
                pairs.push({ id: i, quantity, weight });
            }
        }
        
        if (pairs.length > 0 || itemName) {
            items.push({ id: itemId, name: itemName, pairs });
        }
    });
    return items;
}

function restoreAppState(appState) {
    // Restore global variables
    currentPage = appState.currentPage || 'menu';
    simplePairCount = appState.simplePairCount || 0;
    itemCount = appState.itemCount || 0;
    pairCounts = appState.pairCounts || {};
    
    // Restore period select
    if (document.getElementById('periodSelect')) {
        document.getElementById('periodSelect').value = appState.periodSelect || 'Pre-Historic';
    }
    
    // Restore simple calculator
    if (appState.simplePairs && appState.simplePairs.length > 0) {
        document.getElementById('simplePairs').innerHTML = '';
        simplePairCount = 0;
        
        appState.simplePairs.forEach(pairData => {
            addSimpleNumberPair();
            document.getElementById(`simpleNum1-${simplePairCount}`).value = pairData.quantity;
            document.getElementById(`simpleNum2-${simplePairCount}`).value = pairData.weight;
        });
    }
    
    // Restore complex calculator
    if (appState.complexItems && appState.complexItems.length > 0) {
        document.getElementById('itemSections').innerHTML = '';
        itemCount = 0;
        pairCounts = {};
        
        appState.complexItems.forEach(itemData => {
            // Restore item
            itemCount++;
            const itemId = itemData.id || `item-${itemCount}`;
            pairCounts[itemId] = 0;
            
            const container = document.getElementById('itemSections');
            const itemDiv = document.createElement('div');
            itemDiv.className = 'item-section';
            itemDiv.id = itemId;
            itemDiv.innerHTML = `
                <div class="item-header">
                    <div class="item-title">${itemData.name}</div>
                    <button class="remove-btn" onclick="removeItem('${itemId}')">Remove Item</button>
                </div>
                <div id="pairs-${itemId}"></div>
                <button class="add-btn" onclick="addNumberPair('${itemId}')">+ Add Number Pair</button>
            `;
            container.appendChild(itemDiv);
            
            // Restore pairs for this item
            itemData.pairs.forEach(pairData => {
                addNumberPair(itemId);
                document.getElementById(`num1-${itemId}-${pairCounts[itemId]}`).value = pairData.quantity;
                document.getElementById(`num2-${itemId}-${pairCounts[itemId]}`).value = pairData.weight;
            });
        });
    }
    
    // Show the correct page
    showPage(currentPage);
    
    // Show success message
    showNotification('Data restored successfully!', 'success');
}

// Calculation History functions
function saveCalculationToHistory(type, results) {
    try {
        const calculation = {
            id: Date.now(),
            type: type, // 'simple' or 'complex'
            timestamp: new Date().toISOString(),
            results: results,
            data: type === 'simple' ? getSimplePairsData() : getComplexItemsData()
        };
        
        // Load existing history
        const existingHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        
        // Add new calculation to beginning of array
        existingHistory.unshift(calculation);
        
        // Keep only the last MAX_HISTORY calculations
        const trimmedHistory = existingHistory.slice(0, MAX_HISTORY);
        
        // Save back to localStorage
        localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmedHistory));
        calculationHistory = trimmedHistory;
        
        updateHistoryUI();
        console.log('Calculation saved to history');
    } catch (error) {
        console.error('Failed to save calculation to history:', error);
    }
}

function loadCalculationHistory() {
    try {
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        calculationHistory = history;
        updateHistoryUI();
    } catch (error) {
        console.error('Failed to load calculation history:', error);
        calculationHistory = [];
    }
}

function updateHistoryUI() {
    // Add history buttons to each page if they don't exist
    addHistoryButtonsToPages();
}

function addHistoryButtonsToPages() {
    // Add to simple page
    const simpleContainer = document.querySelector('#simplePage .container');
    if (simpleContainer && !document.getElementById('simpleHistorySection')) {
        const historySection = createHistorySection('simple');
        const calculateSection = simpleContainer.querySelector('div[style*="text-align: center"]');
        simpleContainer.insertBefore(historySection, calculateSection);
    }
    
    // Add to complex page
    const complexContainer = document.querySelector('#complexPage .container');
    if (complexContainer && !document.getElementById('complexHistorySection')) {
        const historySection = createHistorySection('complex');
        const stickyButtons = complexContainer.querySelector('.sticky-buttons');
        complexContainer.insertBefore(historySection, stickyButtons);
    }
}

function createHistorySection(type) {
    const section = document.createElement('div');
    section.id = `${type}HistorySection`;
    section.className = 'history-section';
    section.style.cssText = 'margin: 20px 0; padding: 15px; background-color: #f0f0f0; border-radius: 5px; border-left: 4px solid #2196F3;';
    
    const relevantHistory = calculationHistory.filter(calc => calc.type === type);
    
    if (relevantHistory.length === 0) {
        section.innerHTML = `
            <h4 style="margin: 0 0 10px 0; color: #666;">Recent Calculations</h4>
            <p style="margin: 0; color: #999; font-style: italic;">No recent calculations found</p>
        `;
    } else {
        const historyItems = relevantHistory.map((calc, index) => {
            const date = new Date(calc.timestamp).toLocaleString();
            const resultSummary = type === 'simple' 
                ? `Qty: ${calc.results.totalQuantity}, Weight: ${calc.results.totalWeight}`
                : `${calc.results.length} items calculated`;
            
            return `
                <div style="margin: 10px 0; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${date}</strong><br>
                        <small style="color: #666;">${resultSummary}</small>
                    </div>
                    <button onclick="restoreCalculation(${calc.id})" style="background-color: #2196F3; padding: 8px 12px; font-size: 12px;">
                        Restore
                    </button>
                </div>
            `;
        }).join('');
        
        section.innerHTML = `
            <h4 style="margin: 0 0 15px 0; color: #333;">Recent Calculations</h4>
            ${historyItems}
        `;
    }
    
    return section;
}

function restoreCalculation(calculationId) {
    const calculation = calculationHistory.find(calc => calc.id === calculationId);
    if (!calculation) {
        showNotification('Calculation not found!', 'error');
        return;
    }
    
    if (!confirm(`This will replace your current data with the calculation from ${new Date(calculation.timestamp).toLocaleString()}. Continue?`)) {
        return;
    }
    
    if (calculation.type === 'simple') {
        restoreSimpleCalculation(calculation);
    } else {
        restoreComplexCalculation(calculation);
    }
    
    showNotification('Calculation restored successfully!', 'success');
}

function restoreSimpleCalculation(calculation) {
    // Clear current data
    document.getElementById('simplePairs').innerHTML = '';
    document.getElementById('simpleResults').style.display = 'none';
    simplePairCount = 0;
    
    // Restore data
    calculation.data.forEach(pairData => {
        addSimpleNumberPair();
        document.getElementById(`simpleNum1-${simplePairCount}`).value = pairData.quantity;
        document.getElementById(`simpleNum2-${simplePairCount}`).value = pairData.weight;
    });
    
    // Show results
    document.getElementById('simpleTotalQuantity').textContent = calculation.results.totalQuantity;
    document.getElementById('simpleTotalWeight').textContent = calculation.results.totalWeight;
    document.getElementById('simpleResults').style.display = 'block';
}

function restoreComplexCalculation(calculation) {
    // Clear current data
    resetAll();
    
    // Restore items
    calculation.data.forEach(itemData => {
        itemCount++;
        const itemId = `item-${itemCount}`;
        pairCounts[itemId] = 0;
        
        const container = document.getElementById('itemSections');
        const itemDiv = document.createElement('div');
        itemDiv.className = 'item-section';
        itemDiv.id = itemId;
        itemDiv.innerHTML = `
            <div class="item-header">
                <div class="item-title">${itemData.name}</div>
                <button class="remove-btn" onclick="removeItem('${itemId}')">Remove Item</button>
            </div>
            <div id="pairs-${itemId}"></div>
            <button class="add-btn" onclick="addNumberPair('${itemId}')">+ Add Number Pair</button>
        `;
        container.appendChild(itemDiv);
        
        // Restore pairs
        itemData.pairs.forEach(pairData => {
            addNumberPair(itemId);
            document.getElementById(`num1-${itemId}-${pairCounts[itemId]}`).value = pairData.quantity;
            document.getElementById(`num2-${itemId}-${pairCounts[itemId]}`).value = pairData.weight;
        });
    });
    
    // Show results
    const resultsGrid = document.getElementById('complexResultsGrid');
    resultsGrid.innerHTML = calculation.results.map(result => `
        <div class="item-result">
            <h4>${result.name}</h4>
            <div class="result-item">Quantity: ${result.quantity}</div>
            <div class="result-item">Weight: ${result.weight.toFixed(1)}</div>
        </div>
    `).join('');
    document.getElementById('complexResults').style.display = 'block';
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        max-width: 300px;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#4CAF50';
            break;
        case 'error':
            notification.style.backgroundColor = '#f44336';
            break;
        default:
            notification.style.backgroundColor = '#2196F3';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Fade in
    setTimeout(() => notification.style.opacity = '1', 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

// Auto-save on input changes
function setupAutoSave() {
    let saveTimeout;
    
    function triggerAutoSave() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveToLocalStorage, 1000); // Save after 1 second of inactivity
    }
    
    // Save on input changes
    document.addEventListener('input', triggerAutoSave);
    document.addEventListener('change', triggerAutoSave);
    
    // Save periodically (every 30 seconds)
    setInterval(saveToLocalStorage, 30000);
    
    // Save before page unload
    window.addEventListener('beforeunload', saveToLocalStorage);
}

// Navigation functions
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId + 'Page').classList.add('active');
    currentPage = pageId;

    // Adjust body padding for complex page
    if (pageId === 'complex') {
        document.body.style.paddingBottom = '80px';
    } else {
        document.body.style.paddingBottom = '20px';
    }
    
    // Update history UI when switching pages
    updateHistoryUI();
    
    // Auto-save page change
    setTimeout(saveToLocalStorage, 100);
}

function goToMenu() {
    showPage('menu');
    // Reset password section
    document.getElementById('passwordSection').style.display = 'none';
    document.getElementById('passwordInput').value = '';
    document.getElementById('errorMessage').textContent = '';
}

function goToSimple() {
    showPage('simple');
    // Add first pair automatically if none exist
    if (simplePairCount === 0) {
        addSimpleNumberPair();
    }
}

function showPasswordInput() {
    document.getElementById('passwordSection').style.display = 'block';
    document.getElementById('passwordInput').focus();
}

function handlePasswordEnter(event) {
    if (event.key === 'Enter') {
        checkPassword();
    }
}

function checkPassword() {
    const password = document.getElementById('passwordInput').value;
    const errorDiv = document.getElementById('errorMessage');

    if (password === '1625') {
        showPage('complex');
        // Auto-focus on new item input
        document.getElementById('newItemName').focus();
    } else {
        errorDiv.textContent = 'Incorrect password. Please try again.';
        document.getElementById('passwordInput').value = '';
        document.getElementById('passwordInput').focus();
    }
}

// Simple Calculator Functions
function addSimpleNumberPair() {
    simplePairCount++;
    const container = document.getElementById('simplePairs');
    const pairDiv = document.createElement('div');
    pairDiv.className = 'pair-container';
    pairDiv.id = `simplePair-${simplePairCount}`;
    pairDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4 style="margin: 0;">Pair ${simplePairCount}</h4>
            <button class="remove-btn" onclick="removeSimplePair(${simplePairCount})">Remove</button>
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
                       oninput="validateWeightInput(this)"
                       onkeydown="handleWeightKeydown(event); handleSimpleEnterKey(event, ${simplePairCount}, 2)">
            </div>
        </div>
    `;
    container.appendChild(pairDiv);

    // Auto-focus on the first input field of the new pair with better mobile handling
    const firstInput = document.getElementById(`simpleNum1-${simplePairCount}`);
    focusInputSafely(firstInput, isIOS() ? 200 : 50);
}

function removeSimplePair(pairId) {
    const pair = document.getElementById(`simplePair-${pairId}`);
    if (pair) {
        pair.remove();
        saveToLocalStorage(); // Auto-save after removal
    }
}

function handleSimpleEnterKey(event, currentPair, currentField) {
    if (event.key === 'Enter') {
        event.preventDefault();

        let nextInput = null;

        if (currentField === 1) {
            // Move from quantity to weight in same pair
            nextInput = document.getElementById(`simpleNum2-${currentPair}`);
        } else if (currentField === 2) {
            // Create new pair and focus on its first input
            addSimpleNumberPair();
            nextInput = document.getElementById(`simpleNum1-${simplePairCount}`);
        }

        if (nextInput) {
            focusInputSafely(nextInput, isIOS() ? 300 : 100);
        }
    }
}

function calculateSimple() {
    let totalQuantity = 0;
    let totalWeight = 0;
    let hasData = false;

    // Get all existing pairs
    document.querySelectorAll('#simplePairs .pair-container').forEach(pair => {
        const pairId = pair.id.split('-')[1];
        const num1Input = document.getElementById(`simpleNum1-${pairId}`);
        const num2Input = document.getElementById(`simpleNum2-${pairId}`);

        if (num1Input && num1Input.value) {
            // Parse quantity as integer
            const qty = parseInt(num1Input.value) || 0;
            totalQuantity += qty;
            hasData = true;
        }
        if (num2Input && num2Input.value) {
            totalWeight += parseFloat(num2Input.value) || 0;
            hasData = true;
        }
    });

    if (hasData) {
        // Format quantity as integer
        const formattedQuantity = totalQuantity.toString();
        
        // Format weight to 1 decimal place (no trailing zeros)
        const formattedWeight = totalWeight % 1 === 0 ? 
            totalWeight.toString() : 
            totalWeight.toFixed(1);
        
        document.getElementById('simpleTotalQuantity').textContent = formattedQuantity;
        document.getElementById('simpleTotalWeight').textContent = formattedWeight;
        document.getElementById('simpleResults').style.display = 'block';

        // Save to history
        const results = { 
            totalQuantity: formattedQuantity, 
            totalWeight: formattedWeight 
        };
        saveCalculationToHistory('simple', results);
        
        // Update history UI
        updateHistoryUI();

        // Scroll to results
        document.getElementById('simpleResults').scrollIntoView({ behavior: 'smooth' });
        
        showNotification('Calculation completed and saved!', 'success');
    } else {
        showNotification('Please add some data before calculating', 'error');
    }
}

function resetSimple() {
    if (document.querySelectorAll('#simplePairs .pair-container').length > 0) {
        if (!confirm('This will clear all your current data. Are you sure?')) {
            return;
        }
    }
    
    document.getElementById('simplePairs').innerHTML = '';
    document.getElementById('simpleResults').style.display = 'none';
    simplePairCount = 0;
    // Add first pair automatically after reset
    addSimpleNumberPair();
    
    // Clear autosave
    saveToLocalStorage();
    showNotification('Simple calculator reset', 'info');
}

// Complex Calculator Functions
function addNewItem() {
    const dropdown = document.getElementById('newItemName');
    const customInput = document.getElementById('customItemName');
    const periodSelect = document.getElementById('periodSelect');
    let itemName = '';

    if (dropdown.value === 'custom') {
        itemName = customInput.value.trim();
    } else {
        itemName = dropdown.value.trim();
    }

    if (!itemName) {
        showNotification('Please select or enter an item name', 'error');
        return;
    }

    // Add period prefix to item name
    const period = periodSelect.value;
    itemName = `${period} ${itemName}`;

    itemCount++;
    const itemId = `item-${itemCount}`;
    pairCounts[itemId] = 0;

    const container = document.getElementById('itemSections');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'item-section';
    itemDiv.id = itemId;
    itemDiv.innerHTML = `
        <div class="item-header">
            <div class="item-title">${itemName}</div>
            <button class="remove-btn" onclick="removeItem('${itemId}')">Remove Item</button>
        </div>
        <div id="pairs-${itemId}"></div>
        <button class="add-btn" onclick="addNumberPair('${itemId}')">+ Add Number Pair</button>
    `;
    container.appendChild(itemDiv);

    // Clear the inputs
    document.getElementById('newItemName').value = '';
    document.getElementById('customItemName').value = '';
    document.getElementById('customItemName').style.display = 'none';

    // Add first pair automatically and focus on it
    addNumberPair(itemId);
}

function removeItem(itemId) {
    const item = document.getElementById(itemId);
    if (item) {
        item.remove();
        delete pairCounts[itemId];
        saveToLocalStorage(); // Auto-save after removal
    }
}

function handleDropdownChange() {
    const dropdown = document.getElementById('newItemName');
    const customInput = document.getElementById('customItemName');

    if (dropdown.value === 'custom') {
        customInput.style.display = 'block';
        customInput.focus();
    } else {
        customInput.style.display = 'none';
        customInput.value = '';
    }
}

function handleNewItemEnter(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addNewItem();
    }
}

function addNumberPair(itemId) {
    pairCounts[itemId]++;
    const pairId = pairCounts[itemId];
    const container = document.getElementById(`pairs-${itemId}`);
    const pairDiv = document.createElement('div');
    pairDiv.className = 'pair-container';
    pairDiv.id = `pair-${itemId}-${pairId}`;
    pairDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4 style="margin: 0;">Pair ${pairId}</h4>
            <button class="remove-btn" onclick="removePair('${itemId}', ${pairId})">Remove</button>
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
                       oninput="validateWeightInput(this)"
                       onkeydown="handleWeightKeydown(event); handleEnterKey(event, '${itemId}', ${pairId}, 2)">
            </div>
        </div>
    `;
    container.appendChild(pairDiv);

    // Auto-focus on the first input field of the new pair with better mobile handling
    const firstInput = document.getElementById(`num1-${itemId}-${pairId}`);
    focusInputSafely(firstInput, isIOS() ? 200 : 50);
}

function removePair(itemId, pairId) {
    const pair = document.getElementById(`pair-${itemId}-${pairId}`);
    if (pair) {
        pair.remove();
        saveToLocalStorage(); // Auto-save after removal
    }
}

function handleEnterKey(event, itemId, currentPair, currentField) {
    if (event.key === 'Enter') {
        event.preventDefault();

        let nextInput = null;

        if (currentField === 1) {
            // Move from quantity to weight in same pair
            nextInput = document.getElementById(`num2-${itemId}-${currentPair}`);
        } else if (currentField === 2) {
            // Move from weight to quantity in next pair, or create new pair
            let nextPair = currentPair + 1;
            nextInput = document.getElementById(`num1-${itemId}-${nextPair}`);

            if (!nextInput) {
                // Create new pair if it doesn't exist
                addNumberPair(itemId);
                nextInput = document.getElementById(`num1-${itemId}-${pairCounts[itemId]}`);
            }
        }

        if (nextInput) {
            focusInputSafely(nextInput, isIOS() ? 300 : 100);
        }
    }
}

function calculateAll() {
    const results = [];
    let hasData = false;

    // Calculate totals for each item
    document.querySelectorAll('.item-section').forEach(itemSection => {
        const itemId = itemSection.id;
        const itemName = itemSection.querySelector('.item-title').textContent;
        let totalQuantity = 0;
        let totalWeight = 0;

        // Get all pairs for this item
        for (let i = 1; i <= pairCounts[itemId]; i++) {
            const num1Input = document.getElementById(`num1-${itemId}-${i}`);
            const num2Input = document.getElementById(`num2-${itemId}-${i}`);

            if (num1Input && num1Input.value) {
                // Parse quantity as integer
                const qty = parseInt(num1Input.value) || 0;
                totalQuantity += qty;
                hasData = true;
            }
            if (num2Input && num2Input.value) {
                totalWeight += parseFloat(num2Input.value) || 0;
                hasData = true;
            }
        }

        if (hasData) {
            // Format quantity as integer
            const formattedQuantity = totalQuantity;
            
            // Format weight to 1 decimal place (no trailing zeros)
            const formattedWeight = totalWeight % 1 === 0 ? 
                totalWeight : 
                Math.round(totalWeight * 10) / 10; // Round to 1 decimal place
            
            results.push({
                name: itemName,
                quantity: formattedQuantity,
                weight: formattedWeight
            });
        }
    });

    // Display results
    if (results.length > 0) {
        const resultsGrid = document.getElementById('complexResultsGrid');
        resultsGrid.innerHTML = results.map(result => `
            <div class="item-result">
                <h4>${result.name}</h4>
                <div class="result-item">Quantity: ${result.quantity}</div>
                <div class="result-item">Weight: ${result.weight % 1 === 0 ? result.weight.toString() : result.weight.toFixed(1)}</div>
            </div>
        `).join('');

        document.getElementById('complexResults').style.display = 'block';

        // Save to history
        saveCalculationToHistory('complex', results);
        
        // Update history UI
        updateHistoryUI();

        // Scroll to top to show results
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        showNotification('Calculation completed and saved!', 'success');
    } else {
        showNotification('Please add some data before calculating', 'error');
    }
}

function resetAll() {
    if (document.querySelectorAll('.item-section').length > 0) {
        if (!confirm('This will clear all your current data. Are you sure?')) {
            return;
        }
    }
    
    document.getElementById('itemSections').innerHTML = '';
    document.getElementById('complexResults').style.display = 'none';
    itemCount = 0;
    pairCounts = {};
    document.getElementById('newItemName').value = '';
    document.getElementById('customItemName').value = '';
    document.getElementById('customItemName').style.display = 'none';
    
    // Clear autosave
    saveToLocalStorage();
    showNotification('Complex calculator reset', 'info');
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Load calculation history
    loadCalculationHistory();
    
    // Try to restore saved data
    const restored = loadFromLocalStorage();
    
    if (!restored) {
        // No saved data, start fresh
        showPage('menu');
    }
    
    // Setup auto-save
    setupAutoSave();
    
    console.log('Calculator app initialized successfully');
});

// Clear data functions (for manual cleanup if needed)
function clearAllSavedData() {
    if (confirm('This will permanently delete all saved calculations and auto-saved data. This cannot be undone. Are you sure?')) {
        localStorage.removeItem(AUTOSAVE_KEY);
        localStorage.removeItem(HISTORY_KEY);
        calculationHistory = [];
        updateHistoryUI();
        showNotification('All saved data cleared', 'info');
    }
}