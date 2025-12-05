import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Plus, Trash2, Calendar, Clock, Briefcase, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import {
  getWorkSettings,
  updateWorkSettings,
  getHolidays,
  addHoliday,
  deleteHoliday,
  Holiday
} from '../services/timesService';
import { useForm, Controller } from 'react-hook-form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '../components/ui/alert-dialog';

const DAYS_OF_WEEK = [
  { id: 1, key: 'monday', label: 'Monday', labelEs: 'Lunes' },
  { id: 2, key: 'tuesday', label: 'Tuesday', labelEs: 'Martes' },
  { id: 3, key: 'wednesday', label: 'Wednesday', labelEs: 'Miércoles' },
  { id: 4, key: 'thursday', label: 'Thursday', labelEs: 'Jueves' },
  { id: 5, key: 'friday', label: 'Friday', labelEs: 'Viernes' },
  { id: 6, key: 'saturday', label: 'Saturday', labelEs: 'Sábado' },
  { id: 7, key: 'sunday', label: 'Sunday', labelEs: 'Domingo' }
];

interface SettingsFormData {
  defaultStartTime: string;
  maxHoursMonday: number;
  maxHoursTuesday: number;
  maxHoursWednesday: number;
  maxHoursThursday: number;
  maxHoursFriday: number;
  workDays: number[];
}

interface NewHolidayForm {
  date: string;
  description: string;
}

export default function SettingsPage() {
  const { i18n } = useTranslation();
  const isSpanish = i18n.language === 'es';

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHoliday, setNewHoliday] = useState<NewHolidayForm>({ date: '', description: '' });

  const { control, handleSubmit, reset, watch, setValue } = useForm<SettingsFormData>({
    defaultValues: {
      defaultStartTime: '09:00',
      maxHoursMonday: 9,
      maxHoursTuesday: 9,
      maxHoursWednesday: 9,
      maxHoursThursday: 9,
      maxHoursFriday: 8,
      workDays: [1, 2, 3, 4, 5]
    }
  });

  const workDays = watch('workDays');

  // Load settings and holidays on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [settings, holidayList] = await Promise.all([getWorkSettings(), getHolidays()]);

        reset({
          defaultStartTime: settings.defaultStartTime,
          maxHoursMonday: settings.maxHoursMonday,
          maxHoursTuesday: settings.maxHoursTuesday,
          maxHoursWednesday: settings.maxHoursWednesday,
          maxHoursThursday: settings.maxHoursThursday,
          maxHoursFriday: settings.maxHoursFriday,
          workDays: settings.workDays
        });

        setHolidays(holidayList);
      } catch (error) {
        console.error('Error loading settings:', error);
        toast.error('Error loading settings');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [reset]);

  const onSubmit = async (data: SettingsFormData) => {
    setIsSaving(true);
    try {
      await updateWorkSettings(data);
      toast.success(isSpanish ? 'Configuración guardada' : 'Settings saved');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(isSpanish ? 'Error al guardar' : 'Error saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleWorkDay = (dayId: number) => {
    const current = workDays || [];
    if (current.includes(dayId)) {
      setValue(
        'workDays',
        current.filter((d) => d !== dayId)
      );
    } else {
      setValue('workDays', [...current, dayId].sort());
    }
  };

  const handleAddHoliday = async () => {
    if (!newHoliday.date || !newHoliday.description) {
      toast.error(isSpanish ? 'Complete todos los campos' : 'Please fill all fields');
      return;
    }

    try {
      await addHoliday(newHoliday.date, newHoliday.description);
      const updatedHolidays = await getHolidays();
      setHolidays(updatedHolidays);
      setNewHoliday({ date: '', description: '' });
      toast.success(isSpanish ? 'Festivo agregado' : 'Holiday added');
    } catch (error) {
      console.error('Error adding holiday:', error);
      toast.error(isSpanish ? 'Error al agregar festivo' : 'Error adding holiday');
    }
  };

  const handleDeleteHoliday = async (holidayId: number) => {
    try {
      const deleted = await deleteHoliday(holidayId);
      if (deleted) {
        setHolidays(holidays.filter((h) => h.holidayId !== holidayId));
        toast.success(isSpanish ? 'Festivo eliminado' : 'Holiday deleted');
      } else {
        toast.error(isSpanish ? 'No se puede eliminar festivos del sistema' : 'Cannot delete system holidays');
      }
    } catch (error) {
      console.error('Error deleting holiday:', error);
      toast.error(isSpanish ? 'Error al eliminar' : 'Error deleting holiday');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{isSpanish ? 'Configuración' : 'Settings'}</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-48 bg-muted rounded-lg" />
          <div className="h-48 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{isSpanish ? 'Configuración' : 'Settings'}</h1>
        <p className="text-muted-foreground">
          {isSpanish ? 'Configura tu horario de trabajo y festivos' : 'Configure your work schedule and holidays'}
        </p>
      </div>

      {/* Language Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {isSpanish ? 'Idioma' : 'Language'}
          </CardTitle>
          <CardDescription>
            {isSpanish ? 'Selecciona el idioma de la interfaz' : 'Select the interface language'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              type="button"
              variant={i18n.language === 'es' ? 'default' : 'outline'}
              className="gap-2"
              onClick={async () => {
                i18n.changeLanguage('es');
                await window.Main.setLanguage('es');
              }}
            >
              🇪🇸 Español
            </Button>
            <Button
              type="button"
              variant={i18n.language === 'en' ? 'default' : 'outline'}
              className="gap-2"
              onClick={async () => {
                i18n.changeLanguage('en');
                await window.Main.setLanguage('en');
              }}
            >
              🇬🇧 English
            </Button>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Work Schedule Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {isSpanish ? 'Horario de Trabajo' : 'Work Schedule'}
            </CardTitle>
            <CardDescription>
              {isSpanish
                ? 'Define tu hora de inicio y horas máximas por día'
                : 'Define your start time and maximum hours per day'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Default Start Time */}
            <div className="grid gap-2 max-w-xs">
              <Label htmlFor="defaultStartTime">
                {isSpanish ? 'Hora de inicio por defecto' : 'Default start time'}
              </Label>
              <Controller
                name="defaultStartTime"
                control={control}
                render={({ field }) => <Input type="time" id="defaultStartTime" {...field} className="w-32" />}
              />
            </div>

            <Separator />

            {/* Max Hours Per Day */}
            <div className="space-y-4">
              <Label>{isSpanish ? 'Horas máximas por día' : 'Maximum hours per day'}</Label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {DAYS_OF_WEEK.slice(0, 5).map((day) => {
                  const fieldName = `maxHours${day.label}` as keyof SettingsFormData;
                  return (
                    <div key={day.id} className="space-y-2">
                      <Label htmlFor={fieldName} className="text-sm text-muted-foreground">
                        {isSpanish ? day.labelEs : day.label}
                      </Label>
                      <Controller
                        name={fieldName}
                        control={control}
                        render={({ field }) => (
                          <Input
                            type="number"
                            id={fieldName}
                            min={0}
                            max={24}
                            value={typeof field.value === 'number' ? field.value : 0}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                            className="w-full"
                          />
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Work Days Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              {isSpanish ? 'Días Laborales' : 'Work Days'}
            </CardTitle>
            <CardDescription>
              {isSpanish ? 'Selecciona los días que trabajas' : 'Select the days you work'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = workDays?.includes(day.id);
                return (
                  <Button
                    key={day.id}
                    type="button"
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleWorkDay(day.id)}
                    className="min-w-[100px]"
                  >
                    {isSpanish ? day.labelEs : day.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving} className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving
              ? isSpanish
                ? 'Guardando...'
                : 'Saving...'
              : isSpanish
                ? 'Guardar Configuración'
                : 'Save Settings'}
          </Button>
        </div>
      </form>

      {/* Holidays Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {isSpanish ? 'Días Festivos' : 'Holidays'}
          </CardTitle>
          <CardDescription>
            {isSpanish ? 'Los días festivos no cuentan como días laborales' : 'Holidays are not counted as work days'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add New Holiday */}
          <div className="flex flex-wrap gap-4 items-end p-4 bg-muted/50 rounded-lg">
            <div className="space-y-2">
              <Label>{isSpanish ? 'Fecha' : 'Date'}</Label>
              <Input
                type="date"
                className="w-[180px]"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday((prev) => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className="flex-1 min-w-[200px] space-y-2">
              <Label>{isSpanish ? 'Descripción' : 'Description'}</Label>
              <Input
                placeholder={isSpanish ? 'Nombre del festivo' : 'Holiday name'}
                value={newHoliday.description}
                onChange={(e) => setNewHoliday((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <Button type="button" onClick={handleAddHoliday} className="gap-2">
              <Plus className="h-4 w-4" />
              {isSpanish ? 'Agregar' : 'Add'}
            </Button>
          </div>

          <Separator />

          {/* Holidays List */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {holidays.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {isSpanish ? 'No hay festivos registrados' : 'No holidays registered'}
              </p>
            ) : (
              holidays.map((holiday) => (
                <div
                  key={holiday.holidayId}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-medium w-28">{holiday.holidayDate}</div>
                    <div className="text-sm">{holiday.description}</div>
                    {!holiday.isCustom && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                        {isSpanish ? 'Sistema' : 'System'}
                      </span>
                    )}
                  </div>
                  {holiday.isCustom && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{isSpanish ? '¿Eliminar festivo?' : 'Delete holiday?'}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {isSpanish
                              ? `¿Estás seguro de eliminar "${holiday.description}"?`
                              : `Are you sure you want to delete "${holiday.description}"?`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{isSpanish ? 'Cancelar' : 'Cancel'}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteHoliday(holiday.holidayId)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {isSpanish ? 'Eliminar' : 'Delete'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
