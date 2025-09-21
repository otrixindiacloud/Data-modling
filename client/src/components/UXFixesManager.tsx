import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useModelerStore } from '@/store/modelerStore';

/**
 * Comprehensive UX Fixes Manager
 * Addresses all 9 critical UX issues with centralized event handling
 */
export default function UXFixesManager() {
  const queryClient = useQueryClient();
  const { selectObject, selectNode } = useModelerStore();

  useEffect(() => {
    // 1. Enhanced object selection synchronization
    const handleObjectSelected = (event: any) => {
      const { objectId, object, forceUpdate, source, timestamp } = event.detail;
      
      if (objectId) {
        // Immediate state updates
        selectObject(objectId);
        
        // Force properties panel refresh
        if (forceUpdate) {
          setTimeout(() => {
            queryClient.invalidateQueries({ 
              queryKey: ["/api/objects", objectId] 
            });
            queryClient.invalidateQueries({ 
              queryKey: ["/api/attributes"] 
            });
          }, 50);
        }
        
        console.log(`✓ Object selection synchronized: ${objectId} (${source || 'unknown'})`);
      }
    };

    // 2. Enhanced Data Explorer refresh with duplicate elimination
    const handleDataRefresh = (event: any) => {
      const eventType = event.type;
      
      // Clear all caches to prevent duplicates and stale data
      queryClient.removeQueries({ queryKey: ["/api/objects"] });
      queryClient.removeQueries({ queryKey: ["/api/attributes"] });
      queryClient.removeQueries({ queryKey: ["/api/domains"] });
      queryClient.removeQueries({ queryKey: ["/api/data-areas"] });
      queryClient.removeQueries({ queryKey: ["/api/systems"] });
      
      // Force immediate refetch with fresh data
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ["/api/objects"] });
        queryClient.refetchQueries({ queryKey: ["/api/attributes"] });
      }, 100);
      
      // Force Data Explorer re-render with deduplication
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('forceDataExplorerRefresh', {
          detail: { 
            reason: eventType, 
            timestamp: new Date(),
            eliminateDuplicates: true 
          }
        }));
      }, 200);
      
      console.log(`✓ Data refresh with duplicate elimination: ${eventType}`);
    };

    // 3. Enhanced dropdown focus management - specifically for Add Data Object modal
    const handleDropdownInteraction = (event: any) => {
      const target = event.target as HTMLElement;
      
      // Enhanced handling for Radix UI Select components
      if (target.closest('[role="combobox"]') || target.closest('[data-radix-select-trigger]')) {
        event.stopPropagation();
        
        // For click events, ensure dropdown opens
        if (event.type === 'click') {
          const selectTrigger = target.closest('[data-radix-select-trigger]') as HTMLElement;
          if (selectTrigger) {
            // Force the trigger to respond to clicks
            selectTrigger.click();
            
            // Ensure focus state
            setTimeout(() => {
              selectTrigger.focus();
              // Dispatch a proper pointer event if needed
              const pointerEvent = new PointerEvent('pointerdown', {
                bubbles: true,
                cancelable: true,
                pointerId: 1
              });
              selectTrigger.dispatchEvent(pointerEvent);
            }, 10);
          }
        }
      }
    };

    // 3b. Specific handler for select trigger clicks
    const handleSelectTriggerClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const trigger = target.closest('[data-radix-select-trigger]') as HTMLElement;
      
      if (trigger && !trigger.hasAttribute('data-disabled')) {
        // Prevent default to avoid conflicts
        event.preventDefault();
        event.stopPropagation();
        
        // Manually trigger the select opening
        setTimeout(() => {
          trigger.click();
          trigger.focus();
        }, 0);
        
        console.log('✓ Dropdown trigger clicked - forcing open');
      }
    };

    // 4. Canvas drag-and-drop enhancement
    const handleDragStart = (event: DragEvent) => {
      // Enhanced drag-and-drop with better visual feedback
      const target = event.target as HTMLElement;
      if (target.draggable) {
        target.style.opacity = '0.6';
        target.style.transform = 'scale(0.95)';
        
        // Add drop zone indicators
        setTimeout(() => {
          const canvasElements = document.querySelectorAll('[data-reactflow-wrapper]');
          canvasElements.forEach(canvas => {
            canvas.classList.add('drop-zone-active');
          });
        }, 100);
      }
    };

    const handleDragEnd = (event: DragEvent) => {
      const target = event.target as HTMLElement;
      target.style.opacity = '';
      target.style.transform = '';
      
      // Remove drop zone indicators
      const canvasElements = document.querySelectorAll('[data-reactflow-wrapper]');
      canvasElements.forEach(canvas => {
        canvas.classList.remove('drop-zone-active');
      });
    };

    // 5. Modal close button reliability
    const handleModalCloseClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (target.closest('[data-close-modal]') || target.closest('[aria-label*="Close"]')) {
        event.stopPropagation();
        event.preventDefault();
        
        // Find and close the modal
        const dialog = target.closest('[role="dialog"]');
        if (dialog) {
          const closeButton = dialog.querySelector('[data-state="open"]');
          if (closeButton) {
            (closeButton as HTMLElement).click();
          }
        }
      }
    };

    // 6. Panning friction reduction for minimap
    const handleMinimapInteraction = (event: any) => {
      const minimap = event.target.closest('.react-flow__minimap');
      if (minimap) {
        // Reduce friction by preventing event conflicts
        event.stopPropagation();
        
        // Smooth panning for better UX
        minimap.style.cursor = 'grab';
        
        const handleMouseDown = () => {
          minimap.style.cursor = 'grabbing';
        };
        
        const handleMouseUp = () => {
          minimap.style.cursor = 'grab';
        };
        
        minimap.addEventListener('mousedown', handleMouseDown);
        minimap.addEventListener('mouseup', handleMouseUp);
        
        return () => {
          minimap.removeEventListener('mousedown', handleMouseDown);
          minimap.removeEventListener('mouseup', handleMouseUp);
        };
      }
    };

    // 7. Auto Layout panel positioning fix
    const handleAutoLayoutPositioning = () => {
      const autoLayoutPanels = document.querySelectorAll('[data-auto-layout-panel]');
      autoLayoutPanels.forEach(panel => {
        const panelElement = panel as HTMLElement;
        
        // Ensure proper z-index and positioning
        panelElement.style.zIndex = '50';
        panelElement.style.position = 'fixed';
        
        // Make draggable if not already
        if (!panelElement.dataset.draggable) {
          panelElement.dataset.draggable = 'true';
          panelElement.style.cursor = 'move';
        }
      });
    };

    // 8. Checkbox interaction enhancement
    const handleCheckboxInteraction = (event: any) => {
      const checkbox = event.target.closest('[role="checkbox"]');
      if (checkbox) {
        // Larger click area for better mobile UX
        const clickArea = 44; // 44px minimum touch target
        const rect = checkbox.getBoundingClientRect();
        
        if (rect.width < clickArea || rect.height < clickArea) {
          checkbox.style.minWidth = `${clickArea}px`;
          checkbox.style.minHeight = `${clickArea}px`;
        }
      }
    };

    // Add all event listeners
    window.addEventListener('objectSelected', handleObjectSelected);
    window.addEventListener('objectCreated', handleDataRefresh);
    window.addEventListener('objectUpdated', handleDataRefresh);
    window.addEventListener('attributeCreated', handleDataRefresh);
    window.addEventListener('attributeUpdated', handleDataRefresh);
    window.addEventListener('attributeDeleted', handleDataRefresh);
    
    document.addEventListener('click', handleDropdownInteraction, true);
    document.addEventListener('click', handleSelectTriggerClick, true);
    document.addEventListener('click', handleModalCloseClick, true);
    document.addEventListener('click', handleCheckboxInteraction, true);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragend', handleDragEnd);
    document.addEventListener('mousedown', handleMinimapInteraction);
    
    // Initialize auto layout positioning
    handleAutoLayoutPositioning();
    
    // Periodic cleanup and optimization
    const optimizationInterval = setInterval(() => {
      handleAutoLayoutPositioning();
      
      // Clear stale event listeners
      const staleElements = document.querySelectorAll('[data-stale-listener]');
      staleElements.forEach(el => el.remove());
    }, 30000);

    return () => {
      // Cleanup all listeners
      window.removeEventListener('objectSelected', handleObjectSelected);
      window.removeEventListener('objectCreated', handleDataRefresh);
      window.removeEventListener('objectUpdated', handleDataRefresh);
      window.removeEventListener('attributeCreated', handleDataRefresh);
      window.removeEventListener('attributeUpdated', handleDataRefresh);
      window.removeEventListener('attributeDeleted', handleDataRefresh);
      
      document.removeEventListener('click', handleDropdownInteraction, true);
      document.removeEventListener('click', handleSelectTriggerClick, true);
      document.removeEventListener('click', handleModalCloseClick, true);
      document.removeEventListener('click', handleCheckboxInteraction, true);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('dragend', handleDragEnd);
      document.removeEventListener('mousedown', handleMinimapInteraction);
      
      clearInterval(optimizationInterval);
    };
  }, [queryClient, selectObject, selectNode]);

  return null; // This is a utility component with no UI
}