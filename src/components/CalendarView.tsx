import { useState, useMemo, useEffect } from 'react';
import type { Task } from '@/types/task';
import type { Availability } from '@/types/availability';
import { getDynamicAvailableTimeHours, formatTime12Hour } from '@/types/availability';
import { remainingEstimateHours } from '@/lib/cumulativeDisplayOrder';
import { DayModal } from './DayModal';
import './CalendarView.css';

const RATIO_THRESHOLDS = {
  GOOD: 1.25,
  WARNING: 1.1,
  DANGER: 1.0
};

function getRatioStatusClass(avail: number, task: number, dateStr: string, maxDeadline: string | null): string {
  if (maxDeadline && dateStr > maxDeadline) return '';
  if (task === 0 && avail === 0) return '';
  if (task === 0) return 'ratio-green';
  
  const ratio = avail / task;
  if (ratio >= RATIO_THRESHOLDS.GOOD) return 'ratio-green';
  if (ratio < RATIO_THRESHOLDS.DANGER) return 'ratio-red';
  if (ratio < RATIO_THRESHOLDS.WARNING) return 'ratio-yellow';
  return ''; 
}

type ViewMode = 'week' | 'month';

function getMonthDays(year: number, month: number) {
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  
  const days = [];
  
  const startDayOfWeek = firstDayOfMonth.getDay();
  for (let i = startDayOfWeek; i > 0; i--) {
    days.push(new Date(year, month, 1 - i));
  }
  
  const numDays = lastDayOfMonth.getDate();
  for (let i = 1; i <= numDays; i++) {
    days.push(new Date(year, month, i));
  }
  
  const endDayOfWeek = lastDayOfMonth.getDay();
  for (let i = 1; i < 7 - endDayOfWeek; i++) {
    days.push(new Date(year, month + 1, i));
  }
  
  return days;
}

function getWeekDays(date: Date) {
  const startOfWeek = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
  
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + i);
    days.push(d);
  }
  return days;
}

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface CalendarViewProps {
  tasks: Task[];
  availabilities: Availability[];
}

export function CalendarView({ tasks, availabilities }: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [currentDate, setCurrentDate] = useState(() => new Date(today));

  const days = useMemo(() => {
    if (viewMode === 'week') {
      return getWeekDays(currentDate);
    } else {
      return getMonthDays(currentDate.getFullYear(), currentDate.getMonth());
    }
  }, [viewMode, currentDate]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handlePrev = () => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (viewMode === 'month') {
        d.setMonth(d.getMonth() - 1);
      } else {
        d.setDate(d.getDate() - 7);
      }
      return d;
    });
  };

  const handleNext = () => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (viewMode === 'month') {
        d.setMonth(d.getMonth() + 1);
      } else {
        d.setDate(d.getDate() + 7);
      }
      return d;
    });
  };

  const handleToday = () => {
    setCurrentDate(new Date(today));
  };

  let title = '';
  if (viewMode === 'month') {
    title = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  } else {
    const startOfWeek = days[0];
    title = `Week of ${monthNames[startOfWeek.getMonth()]} ${startOfWeek.getDate()}`;
  }

  const tasksByDateMap = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.deadline) continue;
      if (!map.has(t.deadline)) map.set(t.deadline, []);
      map.get(t.deadline)!.push(t);
    }
    return map;
  }, [tasks]);

  const availByDateMap = useMemo(() => {
    const map = new Map<string, Availability[]>();
    for (const a of availabilities) {
      if (!a.date) continue;
      if (!map.has(a.date)) map.set(a.date, []);
      map.get(a.date)!.push(a);
    }
    return map;
  }, [availabilities]);

  const maxTaskDeadline = useMemo(() => {
    return tasks.reduce((max, t) => {
      if (!t.deadline) return max;
      if (!max || t.deadline > max) return t.deadline;
      return max;
    }, null as string | null);
  }, [tasks]);

  const cumulativeTaskByDate = useMemo(() => {
    const map = new Map<string, number>();
    const uniqueDates = Array.from(new Set(days.map(toLocalDateString)));
    
    for (const dateStr of uniqueDates) {
      const cumTask = tasks
        .filter(t => !t.completion && !t.missed && t.deadline && t.deadline <= dateStr)
        .reduce((sum, t) => sum + remainingEstimateHours(t), 0);
      map.set(dateStr, cumTask);
    }
    return map;
  }, [tasks, days]);

  const cumulativeAvailByDate = useMemo(() => {
    const map = new Map<string, number>();
    const uniqueDates = Array.from(new Set(days.map(toLocalDateString)));
    
    for (const dateStr of uniqueDates) {
      const cumAvail = availabilities
        .filter(a => a.date && a.date <= dateStr)
        .reduce((sum, a) => sum + getDynamicAvailableTimeHours(a, now), 0);
      map.set(dateStr, cumAvail);
    }
    return map;
  }, [availabilities, days, now]);

  return (
    <div className={`calendar-view view-${viewMode}`}>
      <div className="calendar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h2 className="calendar-title">{title}</h2>
          <div className="calendar-nav">
            <button className="btn secondary btn-sm" onClick={handlePrev}>&larr;</button>
            <button className="btn secondary btn-sm" onClick={handleToday}>Today</button>
            <button className="btn secondary btn-sm" onClick={handleNext}>&rarr;</button>
          </div>
        </div>
        <div className="view-toggle">
          <button 
            className={`btn ${viewMode === 'week' ? 'primary' : 'secondary'}`}
            onClick={() => setViewMode('week')}
          >
            Week
          </button>
          <button 
            className={`btn ${viewMode === 'month' ? 'primary' : 'secondary'}`}
            onClick={() => setViewMode('month')}
          >
            Month
          </button>
        </div>
      </div>

      <div className="calendar-grid">
        {dayNames.map(day => (
          <div key={day} className="calendar-day-header">
            {day}
          </div>
        ))}
        {days.map((date, idx) => {
          const isToday = date.getTime() === today.getTime();
          const isCurrentMonth = date.getMonth() === currentDate.getMonth();
          const dateStr = toLocalDateString(date);
          
          const dayTasks = tasksByDateMap.get(dateStr) || [];
          const completedTasksCount = dayTasks.filter(t => t.completion).length;
          const uncompletedTasksCount = dayTasks.length - completedTasksCount;
          const dayAvails = availByDateMap.get(dateStr) || [];
          
          const totalAvailHours = dayAvails.reduce((sum, a) => sum + getDynamicAvailableTimeHours(a, now), 0);
          const formattedTotalHours = Math.round(totalAvailHours * 100) / 100;

          const cumTask = cumulativeTaskByDate.get(dateStr) ?? 0;
          const cumAvail = cumulativeAvailByDate.get(dateStr) ?? 0;
          const ratioClass = getRatioStatusClass(cumAvail, cumTask, dateStr, maxTaskDeadline);

          return (
            <div 
              key={idx} 
              className={`calendar-day-cell ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${ratioClass}`}
              onClick={() => setSelectedDay(dateStr)}
              style={{ cursor: 'pointer' }}
            >
              <div className="day-number-wrapper">
                <span className={`day-number ${isToday ? 'highlight' : ''}`}>
                  {date.getDate()}
                </span>
              </div>
              
              <div className={`day-tasks-skeleton ${viewMode === 'month' ? 'month-mode' : ''}`}>
                {viewMode === 'month' ? (
                  dayTasks.length > 0 && (
                    <div className={`skeleton-task more-indicator ${uncompletedTasksCount === 0 ? 'all-completed' : ''}`}>
                      {completedTasksCount === 0 
                        ? `${uncompletedTasksCount} tasks` 
                        : uncompletedTasksCount === 0 
                        ? `${completedTasksCount} done` 
                        : `${uncompletedTasksCount} tasks | ${completedTasksCount} done`}
                    </div>
                  )
                ) : (
                  <>
                    {dayTasks.map(t => (
                      <div key={t.id} className={`skeleton-task priority-${t.priority.toLowerCase()}`} title={t.name}>
                        {t.name}
                      </div>
                    ))}
                  </>
                )}
              </div>
              
              <div className="day-availability-skeleton">
                {viewMode === 'month' ? (
                  totalAvailHours > 0 && <div className="skeleton-slot more-indicator">Total: {formattedTotalHours}h</div>
                ) : (
                  <>
                    {dayAvails.map(a => {
                      const hrs = getDynamicAvailableTimeHours(a, now);
                      const formattedHrs = Math.round(hrs * 100) / 100;
                      const displayTime = formatTime12Hour(a.startTime);
                      return (
                        <div key={a.id} className="skeleton-slot" title={`${displayTime} (${formattedHrs}h)`}>
                          <span className="slot-time">{displayTime} </span>
                          <span className="slot-duration">({formattedHrs}h)</span>
                        </div>
                      );
                    })}
                    {totalAvailHours > 0 && <div className="skeleton-slot more-indicator">Total: {formattedTotalHours}h</div>}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <DayModal 
        open={selectedDay !== null}
        dateStr={selectedDay}
        tasks={tasks}
        availabilities={availabilities}
        onClose={() => setSelectedDay(null)}
      />
    </div>
  );
}
