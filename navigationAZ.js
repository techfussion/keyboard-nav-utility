/**
 * Keyboard Navigation Utility for Accessibility
 * A standalone JavaScript function that enables keyboard-only navigation
 * between key structural elements on any webpage.
 * 
 * @author NavigationAZ
 * @version 1.0.0
 */

function initKeyboardNav() {
    'use strict';

    // Prevent multiple initializations
    if (window.keyboardNavInitialized) {
        console.warn('Keyboard navigation already initialized');
        return;
    }

    // Navigation state management
    const state = {
        direction: 'forward', // 'forward' | 'backward'
        currentIndices: {
            headers: -1,
            links: -1,
            landmarks: -1
        },
        elements: {
            headers: [],
            links: [],
            landmarks: []
        },
        lastFocusedElement: null,
        isScanning: false
    };

    // ARIA landmark roles for semantic navigation
    const LANDMARK_ROLES = [
        'banner', 'navigation', 'main', 'complementary', 'contentinfo',
        'form', 'search', 'region', 'application', 'document'
    ];

    // Semantic HTML elements that are landmarks
    const LANDMARK_SELECTORS = [
        'nav', 'main', 'aside', 'header', 'footer', 'section', 'form'
    ];

    /**
     * Inject CSS styles for focus indication
     */
    function injectStyles() {
        const styleId = 'keyboard-nav-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .keyboard-nav-focus {
                outline: 3px solid #ff6b35 !important;
                outline-offset: 2px !important;
                background-color: rgba(255, 107, 53, 0.15) !important;
                box-shadow: 0 0 0 1px rgba(255, 107, 53, 0.4), 
                           0 0 8px rgba(255, 107, 53, 0.3) !important;
                position: relative !important;
                z-index: 2147483647 !important;
                border-radius: 2px !important;
                transition: none !important;
            }
            
            .keyboard-nav-focus::before {
                content: '';
                position: absolute !important;
                top: -5px !important;
                left: -5px !important;
                right: -5px !important;
                bottom: -5px !important;
                border: 2px solid #ff6b35 !important;
                border-radius: 4px !important;
                pointer-events: none !important;
                z-index: -1 !important;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Check if an element is visible and focusable
     */
    function isElementVisible(element) {
        if (!element || !element.offsetParent) return false;
        
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        if (style.opacity === '0') return false;
        
        return true;
    }

    /**
     * Check if an element is focusable
     */
    function isFocusable(element) {
        if (!element) return false;
        
        // Skip disabled elements
        if (element.disabled) return false;
        
        // Skip elements with negative tabindex (unless they're naturally focusable)
        const tabIndex = element.getAttribute('tabindex');
        if (tabIndex === '-1' && !['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) {
            return false;
        }
        
        return true;
    }

    /**
     * Check if element has meaningful content or accessible name
     */
    function hasAccessibleContent(element) {
        // Check for text content
        const textContent = element.textContent?.trim();
        if (textContent && textContent.length > 0) return true;
        
        // Check for ARIA label
        if (element.getAttribute('aria-label')?.trim()) return true;
        if (element.getAttribute('aria-labelledby')) return true;
        
        // Check for alt text on images
        if (element.tagName === 'IMG' && element.getAttribute('alt')?.trim()) return true;
        
        // Check for title attribute
        if (element.getAttribute('title')?.trim()) return true;
        
        return false;
    }

    /**
     * Scan and collect all navigable elements
     */
    function scanElements() {
        if (state.isScanning) return;
        state.isScanning = true;

        try {
            // Scan headers (h1-h6)
            const headerElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
                .filter(el => isElementVisible(el) && hasAccessibleContent(el))
                .sort((a, b) => {
                    const aRect = a.getBoundingClientRect();
                    const bRect = b.getBoundingClientRect();
                    // Sort by vertical position first, then horizontal
                    if (Math.abs(aRect.top - bRect.top) > 5) {
                        return aRect.top - bRect.top;
                    }
                    return aRect.left - bRect.left;
                });

            // Scan links (anchor tags with href)
            const linkElements = Array.from(document.querySelectorAll('a[href]'))
                .filter(el => isElementVisible(el) && isFocusable(el) && hasAccessibleContent(el))
                .sort((a, b) => {
                    const aRect = a.getBoundingClientRect();
                    const bRect = b.getBoundingClientRect();
                    if (Math.abs(aRect.top - bRect.top) > 5) {
                        return aRect.top - bRect.top;
                    }
                    return aRect.left - bRect.left;
                });

            // Scan landmarks (semantic elements + ARIA roles)
            const landmarkElements = [];
            
            // Add semantic HTML landmarks
            LANDMARK_SELECTORS.forEach(selector => {
                const elements = Array.from(document.querySelectorAll(selector));
                elements.forEach(el => {
                    if (isElementVisible(el) && !landmarkElements.includes(el)) {
                        landmarkElements.push(el);
                    }
                });
            });

            // Add ARIA landmark roles
            LANDMARK_ROLES.forEach(role => {
                const elements = Array.from(document.querySelectorAll(`[role="${role}"]`));
                elements.forEach(el => {
                    if (isElementVisible(el) && !landmarkElements.includes(el)) {
                        landmarkElements.push(el);
                    }
                });
            });

            // Sort landmarks by document order
            landmarkElements.sort((a, b) => {
                const position = a.compareDocumentPosition(b);
                if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
                if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
                return 0;
            });

            // Update state
            state.elements.headers = headerElements;
            state.elements.links = linkElements;
            state.elements.landmarks = landmarkElements;

            console.log(`Scanned elements: ${headerElements.length} headers, ${linkElements.length} links, ${landmarkElements.length} landmarks`);

        } catch (error) {
            console.error('Error scanning elements:', error);
        } finally {
            state.isScanning = false;
        }
    }

    /**
     * Remove focus highlight from previously focused element
     */
    function removeFocusHighlight() {
        if (state.lastFocusedElement) {
            state.lastFocusedElement.classList.remove('keyboard-nav-focus');
        }
    }

    /**
     * Add focus highlight to element
     */
    function addFocusHighlight(element) {
        if (element) {
            element.classList.add('keyboard-nav-focus');
            state.lastFocusedElement = element;
        }
    }

    /**
     * Focus element with proper highlighting
     */
    function focusElement(element) {
        if (!element) return false;

        try {
            removeFocusHighlight();
            
            // Make element focusable if it's not naturally focusable
            if (!element.hasAttribute('tabindex') && !['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) {
                element.setAttribute('tabindex', '-1');
            }
            
            element.focus();
            addFocusHighlight(element);
            
            // Scroll element into view
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
            
            return true;
        } catch (error) {
            console.error('Error focusing element:', error);
            return false;
        }
    }

    /**
     * Navigate to next/previous element in array
     */
    function navigateInArray(elementType) {
        const elements = state.elements[elementType];
        if (!elements || elements.length === 0) return false;

        let currentIndex = state.currentIndices[elementType];
        
        if (state.direction === 'forward') {
            currentIndex = (currentIndex + 1) % elements.length;
        } else {
            currentIndex = currentIndex <= 0 ? elements.length - 1 : currentIndex - 1;
        }

        const targetElement = elements[currentIndex];
        if (focusElement(targetElement)) {
            state.currentIndices[elementType] = currentIndex;
            return true;
        }

        return false;
    }

    /**
     * Check if current focus is on a form field
     */
    function isFormFieldFocused() {
        const activeElement = document.activeElement;
        if (!activeElement) return false;

        // Check tag names
        const formTags = ['INPUT', 'TEXTAREA', 'SELECT'];
        if (formTags.includes(activeElement.tagName)) return true;

        // Check contentEditable
        if (activeElement.contentEditable === 'true') return true;

        // Check ARIA roles
        const role = activeElement.getAttribute('role');
        if (['textbox', 'searchbox', 'combobox', 'spinbutton'].includes(role)) return true;

        return false;
    }

    /**
     * Handle keyboard events
     */
    function handleKeyDown(event) {
        // Ignore if form field is focused
        if (isFormFieldFocused()) return;

        const key = event.key;
        let handled = false;

        switch (key) {
            case 'ArrowUp':
                state.direction = 'backward';
                handled = true;
                break;
                
            case 'ArrowDown':
                state.direction = 'forward';
                handled = true;
                break;
                
            case 'h':
            case 'H':
                handled = navigateInArray('headers');
                break;
                
            case 'l':
            case 'L':
                handled = navigateInArray('links');
                break;
                
            case 'm':
            case 'M':
                handled = navigateInArray('landmarks');
                break;
        }

        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    /**
     * Debounced DOM scan function
     */
    let scanTimeout;
    function debouncedScan() {
        clearTimeout(scanTimeout);
        scanTimeout = setTimeout(scanElements, 100);
    }

    /**
     * Set up MutationObserver for dynamic DOM changes
     */
    function setupDOMObserver() {
        if (!window.MutationObserver) {
            console.warn('MutationObserver not supported, dynamic DOM updates will not be detected');
            return;
        }

        const observer = new MutationObserver((mutations) => {
            let shouldRescan = false;

            mutations.forEach((mutation) => {
                // Check for added/removed nodes
                if (mutation.type === 'childList') {
                    const hasRelevantChanges = Array.from(mutation.addedNodes)
                        .concat(Array.from(mutation.removedNodes))
                        .some(node => {
                            if (node.nodeType !== Node.ELEMENT_NODE) return false;
                            
                            // Check if node or its descendants contain navigable elements
                            const element = node;
                            return element.matches('h1, h2, h3, h4, h5, h6, a[href], nav, main, aside, header, footer, section, form, [role]') ||
                                   element.querySelector('h1, h2, h3, h4, h5, h6, a[href], nav, main, aside, header, footer, section, form, [role]');
                        });
                    
                    if (hasRelevantChanges) shouldRescan = true;
                }

                // Check for attribute changes that affect navigation
                if (mutation.type === 'attributes') {
                    const relevantAttributes = ['role', 'aria-label', 'aria-labelledby', 'href', 'tabindex', 'hidden', 'style', 'class'];
                    if (relevantAttributes.includes(mutation.attributeName)) {
                        shouldRescan = true;
                    }
                }
            });

            if (shouldRescan) {
                debouncedScan();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['role', 'aria-label', 'aria-labelledby', 'href', 'tabindex', 'hidden', 'style', 'class']
        });

        return observer;
    }

    /**
     * Clean up event listeners and observers
     */
    function cleanup() {
        document.removeEventListener('keydown', handleKeyDown, true);
        removeFocusHighlight();
        
        // Remove injected styles
        const style = document.getElementById('keyboard-nav-styles');
        if (style) style.remove();
        
        window.keyboardNavInitialized = false;
    }

    /**
     * Initialize the keyboard navigation system
     */
    function initialize() {
        try {
            // Inject CSS styles
            injectStyles();

            // Initial element scan
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', scanElements);
            } else {
                scanElements();
            }

            // Set up keyboard event listeners
            document.addEventListener('keydown', handleKeyDown, true);

            // Set up DOM observer for dynamic changes
            setupDOMObserver();

            // Handle page unload
            window.addEventListener('beforeunload', cleanup);

            // Mark as initialized
            window.keyboardNavInitialized = true;

            console.log('Keyboard navigation utility initialized successfully');

        } catch (error) {
            console.error('Failed to initialize keyboard navigation:', error);
        }
    }

    // Initialize immediately
    initialize();

    // Return public API for advanced usage
    return {
        scan: scanElements,
        getElements: () => ({ ...state.elements }),
        getState: () => ({ ...state }),
        cleanup: cleanup
    };
}

// Export for various module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = initKeyboardNav;
} else if (typeof define === 'function' && define.amd) {
    define([], function() { return initKeyboardNav; });
} else {
    window.initKeyboardNav = initKeyboardNav;
}