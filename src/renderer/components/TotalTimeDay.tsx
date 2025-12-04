import React from 'react';
import { useWatch, Control } from 'react-hook-form';
import { Clock } from 'lucide-react';
import { Card, CardContent } from './ui/card';

interface TotalTimeDayProps {
  control: Control<any>;
}

function TotalTimeDay({ control }: TotalTimeDayProps) {
  const result = useWatch({
    control,
    name: 'entries'
  });

  const totalTime = React.useMemo(() => {
    if (!result || !Array.isArray(result)) {
      return { hours: 0, minutes: 0 };
    }
    return result.reduce(
      (acc: { hours: number; minutes: number }, field: any) => {
        const hours = field.hours?.[0]?.getHours() ?? 0;
        const minutes = field.hours?.[0]?.getMinutes() ?? 0;
        acc.hours += hours;
        acc.minutes += minutes;
        return acc;
      },
      { hours: 0, minutes: 0 }
    );
  }, [result]);

  // Convert excess minutes to hours
  const normalizedHours = totalTime.hours + Math.floor(totalTime.minutes / 60);
  const normalizedMinutes = totalTime.minutes % 60;

  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardContent className="py-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Time Today</p>
            <p className="text-2xl font-bold">
              {normalizedHours}h {normalizedMinutes.toString().padStart(2, '0')}m
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default TotalTimeDay;
