import React from 'react';
import { useWatch } from 'react-hook-form';

function TotalTimeDay({ control }) {
  const result = useWatch({
    control,
    name: 'entries'
  });

  const totalTime = React.useMemo(() => {
    console.log(result);
    return result.reduce(
      (acc, field) => {
        const hours = field.hours[0]?.getHours() ?? 0;
        const minutes = field.hours[0]?.getMinutes() ?? 0;
        console.log('Este', hours, minutes);
        acc.hours += hours;
        acc.minutes += minutes;

        return acc;
      },
      { hours: 0, minutes: 0 }
    );
  }, [result]);

  console.log(totalTime);

  return (
    <div>
      <h2>Total Time</h2>
      <p>
        {totalTime.hours} hours and {totalTime.minutes} minutes
      </p>
    </div>
  );
}

export default TotalTimeDay;
