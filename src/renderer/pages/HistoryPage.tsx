import React from 'react';
import { useTranslation } from 'react-i18next';
import TimeLogsTable from '../components/TimeLogsTable';

function HistoryPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('history.title')}</h1>
        <p className="text-muted-foreground">{t('history.subtitle')}</p>
      </div>

      <TimeLogsTable />
    </div>
  );
}

export default HistoryPage;
