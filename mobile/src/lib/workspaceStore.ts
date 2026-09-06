import { create } from 'zustand';

interface WorkspaceState {
  activeWorkspace: 'individual' | 'corporate';
  setActiveWorkspace: (workspace: 'individual' | 'corporate') => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeWorkspace: 'individual',
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
}));
