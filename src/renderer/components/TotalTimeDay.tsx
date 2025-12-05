import React, { useEffect, useState } from 'react';
import { useWatch } from 'react-hook-form';
import { Clock, Database, FileEdit } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { getDailyTimeInfo, minutesToHoursMinutes, DailyTimeInfo } from '../services/timesService';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface TotalTimeDayProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
}

function TotalTimeDay({ control }: TotalTimeDayProps) {
  const entries = useWatch({
    control,
    name: 'entries'
  });

  const [dailyInfo, setDailyInfo] = useState<DailyTimeInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get the first entry's date (assuming all entries are for the same day in the form)
  const currentDate = entries?.[0]?.date || new Date().toISOString().split('T')[0];

  // Fetch saved time from DB whenever date changes
  useEffect(() => {
    const fetchDailyInfo = async () => {
      setIsLoading(true);
      try {
        const info = await getDailyTimeInfo(currentDate);
        setDailyInfo(info);
      } catch (error) {
        console.error('Error fetching daily info:', error);
        setDailyInfo(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDailyInfo();
  }, [currentDate]);

  // Calculate draft time from form entries
  const draftTime = React.useMemo(() => {
    if (!entries || !Array.isArray(entries)) {
      return { hours: 0, minutes: 0, totalMinutes: 0 };
    }

    const result = entries.reduce(
      (acc: { hours: number; minutes: number }, field) => {
        // Only count entries for the current date
        if (field.date !== currentDate) return acc;

        const hours = field.hours?.[0]?.getHours() ?? 0;
        const minutes = field.hours?.[0]?.getMinutes() ?? 0;
        acc.hours += hours;
        acc.minutes += minutes;
        return acc;
      },
      { hours: 0, minutes: 0 }
    );

    // Normalize minutes to hours
    const totalMinutes = result.hours * 60 + result.minutes;
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
      totalMinutes
    };
  }, [entries, currentDate]);

  // Calculate totals
  const savedMinutes = dailyInfo?.totalMinutes ?? 0;
  const totalMinutes = savedMinutes + draftTime.totalMinutes;
  const maxMinutes = dailyInfo?.maxMinutes ?? 0;
  const remainingMinutes = Math.max(0, maxMinutes - totalMinutes);

  const total = minutesToHoursMinutes(totalMinutes);
  const saved = minutesToHoursMinutes(savedMinutes);
  const remaining = minutesToHoursMinutes(remainingMinutes);
  const maxTime = minutesToHoursMinutes(maxMinutes);

  // Determine status color
  const getStatusColor = () => {
    if (totalMinutes > maxMinutes) return 'text-red-600 dark:text-red-400'; // Over limit
    if (totalMinutes >= maxMinutes) return 'text-green-600 dark:text-green-400'; // Complete
    if (totalMinutes >= maxMinutes * 0.75) return 'text-yellow-600 dark:text-yellow-400'; // Almost there
    return 'text-primary';
  };

  const isOverLimit = totalMinutes > maxMinutes;
  const overMinutes = isOverLimit ? totalMinutes - maxMinutes : 0;
  const over = minutesToHoursMinutes(overMinutes);

  return (
    <TooltipProvider>
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-3">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-full bg-primary/10">
              <Clock className={`h-5 w-5 ${getStatusColor()}`} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Total: {currentDate}</p>
              <p className={`text-2xl font-bold ${getStatusColor()}`}>
                {isLoading ? '...' : `${total.hours}h ${total.minutes.toString().padStart(2, '0')}m`}
              </p>
            </div>

            {/* Breakdown */}
            <div className="flex gap-3 text-sm">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-muted-foreground cursor-help">
                    <Database className="h-3 w-3" />
                    <span>
                      {saved.hours}h{saved.minutes.toString().padStart(2, '0')}m
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Saved in database</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-muted-foreground cursor-help">
                    <FileEdit className="h-3 w-3" />
                    <span>
                      {draftTime.hours}h{draftTime.minutes.toString().padStart(2, '0')}m
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Draft (not saved)</p>
                </TooltipContent>
              </Tooltip>

              {maxMinutes > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`flex items-center gap-1 cursor-help ${
                        isOverLimit
                          ? 'text-red-600 dark:text-red-400 font-semibold'
                          : remainingMinutes === 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-muted-foreground'
                      }`}
                    >
                      <span>
                        {isOverLimit
                          ? `⚠ +${over.hours}h${over.minutes.toString().padStart(2, '0')}m over`
                          : remainingMinutes === 0
                            ? '✓ Complete'
                            : `${remaining.hours}h${remaining.minutes.toString().padStart(2, '0')}m left`}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Max for day: {maxTime.hours}h{maxTime.minutes.toString().padStart(2, '0')}m
                      {isOverLimit && ' - You are registering overtime!'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

export default TotalTimeDay;
