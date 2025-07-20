import { useState, useCallback, useMemo } from 'react';
import { RecordingResponse } from '../services/recordingAPI';

interface BatchSelectionState {
  selectedIds: Set<number>;
  selectAll: boolean;
  isSelecting: boolean;
}

interface BatchSelectionActions {
  toggleSelection: (id: number) => void;
  toggleSelectAll: (allIds: number[]) => void;
  clearSelection: () => void;
  setSelecting: (selecting: boolean) => void;
  selectMultiple: (ids: number[]) => void;
}

export interface UseBatchSelectionReturn extends BatchSelectionState, BatchSelectionActions {
  selectedCount: number;
  isAllSelected: (totalCount: number) => boolean;
  isIndeterminate: (totalCount: number) => boolean;
  getSelectedRecordings: (recordings: RecordingResponse[]) => RecordingResponse[];
}

export const useBatchSelection = (): UseBatchSelectionReturn => {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);

  const toggleSelection = useCallback((id: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const toggleSelectAll = useCallback((allIds: number[]) => {
    setSelectedIds(prev => {
      const currentlySelected = allIds.filter(id => prev.has(id));
      if (currentlySelected.length === allIds.length) {
        // 如果全部选中，则取消全选
        const newSet = new Set(prev);
        allIds.forEach(id => newSet.delete(id));
        return newSet;
      } else {
        // 否则全选当前页
        const newSet = new Set(prev);
        allIds.forEach(id => newSet.add(id));
        return newSet;
      }
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelecting(false);
  }, []);

  const setSelecting = useCallback((selecting: boolean) => {
    setIsSelecting(selecting);
    if (!selecting) {
      setSelectedIds(new Set());
    }
  }, []);

  const selectMultiple = useCallback((ids: number[]) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      ids.forEach(id => newSet.add(id));
      return newSet;
    });
  }, []);

  const selectedCount = selectedIds.size;
  const selectAll = useMemo(() => selectedIds.size > 0, [selectedIds.size]);

  const isAllSelected = useCallback((totalCount: number) => {
    return selectedIds.size === totalCount && totalCount > 0;
  }, [selectedIds.size]);

  const isIndeterminate = useCallback((totalCount: number) => {
    return selectedIds.size > 0 && selectedIds.size < totalCount;
  }, [selectedIds.size]);

  const getSelectedRecordings = useCallback((recordings: RecordingResponse[]) => {
    return recordings.filter(recording => selectedIds.has(recording.id));
  }, [selectedIds]);

  return {
    selectedIds,
    selectAll,
    isSelecting,
    selectedCount,
    toggleSelection,
    toggleSelectAll,
    clearSelection,
    setSelecting,
    selectMultiple,
    isAllSelected,
    isIndeterminate,
    getSelectedRecordings,
  };
};