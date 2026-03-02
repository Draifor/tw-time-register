import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, ListTodo, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { getTimeStats, TimeStats, minutesToHoursMinutes } from '../services/timesService';

function HomePage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<TimeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await getTimeStats();
        setStats(data);
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadStats();
  }, []);

  const formatTime = (minutes: number) => {
    const { hours, minutes: mins } = minutesToHoursMinutes(minutes);
    return `${hours}h ${mins.toString().padStart(2, '0')}m`;
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('home.title')}</h1>
        <p className="text-muted-foreground text-lg">{t('home.subtitle')}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>{t('home.timeRegistration')}</CardTitle>
            </div>
            <CardDescription>{t('home.timeRegistrationDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/worktime">
              <Button className="w-full">
                {t('home.startRegistering')}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <ListTodo className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>{t('home.taskManagement')}</CardTitle>
            </div>
            <CardDescription>{t('home.taskManagementDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/tasks">
              <Button variant="outline" className="w-full">
                {t('home.viewTasks')}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('home.quickStats')}</CardTitle>
          <CardDescription>{t('home.statsSummary')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 rounded-lg bg-muted">
              {isLoading ? (
                <Skeleton className="h-8 w-16 mx-auto mb-1" />
              ) : (
                <div className="text-2xl font-bold">{formatTime(stats?.todayMinutes || 0)}</div>
              )}
              <div className="text-sm text-muted-foreground">{t('home.today')}</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              {isLoading ? (
                <Skeleton className="h-8 w-16 mx-auto mb-1" />
              ) : (
                <div className="text-2xl font-bold">{formatTime(stats?.weekMinutes || 0)}</div>
              )}
              <div className="text-sm text-muted-foreground">{t('home.thisWeek')}</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              {isLoading ? (
                <Skeleton className="h-8 w-20 mx-auto mb-1" />
              ) : (
                <div
                  className={`text-2xl font-bold ${
                    (stats?.pendingEntries || 0) > 0 ? 'text-yellow-600 dark:text-yellow-400' : ''
                  }`}
                >
                  {stats?.pendingEntries || 0}
                </div>
              )}
              <div className="text-sm text-muted-foreground">{t('home.pendingEntries')}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default HomePage;
