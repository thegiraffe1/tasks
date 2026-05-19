export type TabKey = 'tasks' | 'availability' | 'calendar';

interface NavigationProps {
  currentTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

export function Navigation({ currentTab, onTabChange }: NavigationProps) {
  return (
    <nav className="tab-navigation">
      <button 
        className={`tab-btn ${currentTab === 'tasks' ? 'active' : ''}`}
        onClick={() => onTabChange('tasks')}
      >
        Tasks
      </button>
      <button 
        className={`tab-btn ${currentTab === 'availability' ? 'active' : ''}`}
        onClick={() => onTabChange('availability')}
      >
        Availability
      </button>
      <button 
        className={`tab-btn ${currentTab === 'calendar' ? 'active' : ''}`}
        onClick={() => onTabChange('calendar')}
      >
        Calendar
      </button>
    </nav>
  );
}
